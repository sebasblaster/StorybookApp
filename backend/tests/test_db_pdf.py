import tests._env  # noqa: F401

import unittest

from PIL import Image

import db
from engine.paths import MEDIA_ROOT
from engine.pdf_export import build_pdf


class DbLayer(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        db.init()
        cls.user = db.create_user(f"t{id(cls)}@x.com", "Tester", "hash")

    def test_story_lifecycle(self):
        s = db.create_story(self.user["id"], "una idea", "fantasia", {"seed": 1, "consistency": True})
        self.assertEqual(s["status"], "queued")
        self.assertEqual(s["config"]["seed"], 1)
        db.update_story(s["id"], status="generating", progress=3, title="Hola & <adiós>",
                        scenes=[{"index": 1, "text": "x", "image": "/api/media/k/a.jpg"}], favorite=True)
        g = db.get_story(s["id"], self.user["id"])
        self.assertEqual((g["status"], g["progress"], g["favorite"]), ("generating", 3, True))
        self.assertEqual(g["scenes"][0]["text"], "x")
        db.update_scene(s["id"], 0, image="/api/media/k/b.jpg", regenerating=False)
        self.assertEqual(db.get_story(s["id"])["cover"], "/api/media/k/b.jpg")
        self.assertIsNone(db.get_story(s["id"], "otro-usuario"))
        self.assertIn(s["id"], db.pending_ids())
        db.delete_story(s["id"])
        self.assertIsNone(db.get_story(s["id"]))

    def test_share_token_only_when_done(self):
        s = db.create_story(self.user["id"], "i", "terror", {})
        db.update_story(s["id"], share_token="abc123tok")
        self.assertIsNone(db.by_share_token("abc123tok"))  # not done yet
        db.update_story(s["id"], status="done")
        self.assertEqual(db.by_share_token("abc123tok")["id"], s["id"])

    def test_unique_email(self):
        db.create_user("dup@x.com", "A", "h")
        with self.assertRaises(Exception):
            db.create_user("dup@x.com", "B", "h")


class Pdf(unittest.TestCase):
    def test_pdf_with_special_characters(self):
        folder = MEDIA_ROOT / "pdfkey"
        folder.mkdir(parents=True, exist_ok=True)
        Image.new("RGB", (64, 64), (90, 40, 120)).save(folder / "s.jpg")
        url = "/api/media/pdfkey/s.jpg"
        story = {"title": "Luces & sombras <1>", "genre": "terror", "idea": "un faro & el mar", "cover": url,
                 "config": {"text_model": "Qwen/Qwen2.5-3B-Instruct"},
                 "scenes": [{"index": i + 1, "text": f"Escena con «comillas» & ñandú {i}.", "image": url} for i in range(5)]}
        pdf = build_pdf(story)
        self.assertTrue(pdf.startswith(b"%PDF"))
        self.assertGreater(len(pdf), 3000)


if __name__ == "__main__":
    unittest.main()
