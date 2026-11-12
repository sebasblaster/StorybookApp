import tests._env  # noqa: F401

import unittest
from unittest.mock import patch

try:
    from fastapi.testclient import TestClient
    import db
    import server
    HAVE_API = True
except ImportError:  # fastapi/httpx not installed
    HAVE_API = False


@unittest.skipUnless(HAVE_API, "fastapi + httpx are required for API tests")
class Api(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ctx = TestClient(server.app)
        cls.c = cls.ctx.__enter__()  # runs lifespan (db.init)
        r = cls.c.post("/api/auth/register", json={"email": "api@test.com", "password": "secret1", "name": "Api"})
        cls.h = {"Authorization": f"Bearer {r.json()['token']}"}

    @classmethod
    def tearDownClass(cls):
        cls.ctx.__exit__(None, None, None)

    def test_auth_rules(self):
        self.assertEqual(self.c.get("/api/stories").status_code, 401)
        self.assertEqual(self.c.post("/api/auth/register", json={"email": "api@test.com", "password": "secret1", "name": "x"}).status_code, 400)
        self.assertEqual(self.c.post("/api/auth/login", json={"email": "api@test.com", "password": "bad-pass"}).status_code, 401)
        self.assertEqual(self.c.get("/api/auth/me", headers=self.h).json()["email"], "api@test.com")

    def test_api_root_and_health(self):
        root = self.c.get("/")
        self.assertEqual(root.status_code, 200)
        self.assertEqual(root.json()["health"], "/api/health")
        self.assertEqual(root.json()["docs"], "/docs")
        self.assertEqual(self.c.get("/api/health").json(), {"ok": True})

    def test_validation(self):
        self.assertEqual(self.c.post("/api/stories", headers=self.h, json={"idea": "ab", "genre": "terror"}).status_code, 422)
        self.assertEqual(self.c.post("/api/stories", headers=self.h, json={"idea": "una idea", "genre": "nope"}).status_code, 400)

    def test_offline_profile_requires_cached_models(self):
        with patch("stories._profile_availability_error", return_value="Falta Qwen/Qwen2.5-3B-Instruct"):
            response = self.c.post(
                "/api/stories",
                headers=self.h,
                json={"idea": "una niña y el bosque", "genre": "fantasia", "profile": "equilibrado"},
            )
        self.assertEqual(response.status_code, 503)
        self.assertIn("Qwen/Qwen2.5-3B-Instruct", response.json()["detail"])

    def test_gpu_profiles_require_cuda(self):
        import stories

        with patch("stories.device", return_value="cpu"):
            error = stories._profile_availability_error("equilibrado")
        self.assertIn("GPU NVIDIA compatible con CUDA", error)

    def test_retry_rejects_missing_models_for_original_profile(self):
        with patch("stories._profile_availability_error", return_value=None), patch("stories.jobs.submit"):
            created = self.c.post(
                "/api/stories",
                headers=self.h,
                json={
                    "idea": "una idea con suficientes caracteres",
                    "genre": "fantasia",
                    "profile": "equilibrado",
                },
            ).json()
        db.update_story(created["id"], status="error", error="modelo faltante")

        with patch("stories._profile_availability_error", return_value="Falta Qwen/Qwen2.5-3B-Instruct"):
            response = self.c.post(f"/api/stories/{created['id']}/retry", headers=self.h)

        self.assertEqual(response.status_code, 503)
        self.assertEqual(db.get_story(created["id"])["status"], "error")

    def test_retry_can_switch_failed_story_to_cached_profile(self):
        with patch("stories._profile_availability_error", return_value=None), patch("stories.jobs.submit"):
            created = self.c.post(
                "/api/stories",
                headers=self.h,
                json={
                    "idea": "una idea con suficientes caracteres",
                    "genre": "fantasia",
                    "profile": "equilibrado",
                },
            ).json()
        db.update_story(created["id"], status="error", error="modelo faltante")

        with patch("stories._profile_availability_error", return_value=None), patch("stories.jobs.submit") as submit:
            response = self.c.post(
                f"/api/stories/{created['id']}/retry",
                headers=self.h,
                json={"profile": "ligero"},
            )

        retried = db.get_story(created["id"])
        self.assertEqual(response.status_code, 200)
        self.assertEqual(retried["status"], "queued")
        self.assertEqual(retried["config"]["profile"], "ligero")
        self.assertEqual(retried["config"]["text_model"], "Qwen/Qwen2.5-1.5B-Instruct")
        submit.assert_called_once_with("story", created["id"])
        db.update_story(created["id"], status="error")

    def _finished_story_with_scene(self):
        created = self.c.post(
            "/api/stories",
            headers=self.h,
            json={"idea": "una idea con suficientes caracteres", "genre": "fantasia", "profile": "ligero"},
        ).json()
        db.update_story(
            created["id"],
            status="done",
            plan={"protagonist": "Lía"},
            scenes=[{
                "index": 1, "text": "Texto original.", "text_versions": [],
                "audio": "/api/media/example/voice_1.wav", "audio_duration": 2.0,
                "ambient": "/api/media/example/ambient_1.wav", "regenerating": False,
            }],
        )
        return created["id"]

    def test_edit_scene_saves_previous_versions_and_marks_audio_stale(self):
        story_id = self._finished_story_with_scene()
        response = self.c.patch(
            f"/api/stories/{story_id}/scenes/1",
            headers=self.h,
            json={"text": "Texto editado."},
        )
        scene = response.json()["scenes"][0]
        self.assertEqual(response.status_code, 200)
        self.assertEqual(scene["text"], "Texto editado.")
        self.assertEqual(scene["text_versions"][0]["text"], "Texto original.")
        self.assertTrue(scene["audio_stale"])

        restored = self.c.patch(
            f"/api/stories/{story_id}/scenes/1",
            headers=self.h,
            json={"text": "Texto original."},
        ).json()["scenes"][0]
        self.assertEqual(restored["text_versions"][-1]["text"], "Texto editado.")

    def test_narrate_scene_queues_audio_job(self):
        story_id = self._finished_story_with_scene()
        with patch("stories.jobs.submit") as submit:
            response = self.c.post(f"/api/stories/{story_id}/scenes/1/narrate", headers=self.h)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(db.get_story(story_id)["scenes"][0]["audio_regenerating"])
        submit.assert_called_once_with("audio", story_id, 0)

    def test_compare_experiment_queues_matched_pair_and_persists_group(self):
        with patch("stories._profile_availability_error", return_value=None), patch("stories.jobs.submit") as submit:
            response = self.c.post(
                "/api/experiments/compare",
                headers=self.h,
                json={"idea": "un zorro que busca la luna", "genre": "fantasia", "profile": "ligero", "seed": 41},
            )
        self.assertEqual(response.status_code, 200)
        pair = response.json()["stories"]
        self.assertEqual(len(pair), 2)
        self.assertEqual([story["config"]["consistency"] for story in pair], [True, False])
        self.assertEqual([story["config"]["seed"] for story in pair], [41, 41])
        self.assertEqual(submit.call_count, 2)
        for story in pair:
            db.update_story(story["id"], status="done")
        saved = self.c.get("/api/experiments/comparisons", headers=self.h).json()
        self.assertEqual(saved[0]["id"], response.json()["comparison_id"])
        self.assertEqual(len(saved[0]["stories"]), 2)

    def test_story_crud_favorite_share_isolation(self):
        r = self.c.post("/api/stories", headers=self.h, json={"idea": "una niña y el bosque", "genre": "fantasia", "seed": 5})
        self.assertEqual(r.status_code, 200)
        s = r.json()
        self.assertEqual((s["status"], s["config"]["seed"]), ("queued", 5))
        self.assertEqual(self.c.get(f"/api/stories/{s['id']}", headers=self.h).json()["queue_position"], 1)
        self.assertTrue(self.c.patch(f"/api/stories/{s['id']}", headers=self.h, json={"favorite": True}).json()["favorite"])
        self.assertEqual(self.c.get(f"/api/stories/{s['id']}/pdf", headers=self.h).status_code, 409)  # not done yet
        other = self.c.post("/api/auth/register", json={"email": "o@test.com", "password": "secret1", "name": "O"}).json()["token"]
        self.assertEqual(self.c.get(f"/api/stories/{s['id']}", headers={"Authorization": f"Bearer {other}"}).status_code, 404)
        self.assertEqual(self.c.delete(f"/api/stories/{s['id']}", headers=self.h).status_code, 200)
        self.assertEqual(self.c.get(f"/api/stories/{s['id']}", headers=self.h).status_code, 404)


if __name__ == "__main__":
    unittest.main()
