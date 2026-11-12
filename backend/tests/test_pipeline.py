"""Pipeline integration tests with model-dependent work replaced by deterministic fakes."""
import tests._env  # noqa: F401

import tempfile
import unittest
from contextlib import ExitStack
from pathlib import Path
from unittest.mock import patch

from engine import pipeline


class PipelineGeneration(unittest.TestCase):
    def test_image_seeds_are_distinct_and_reproducible_in_both_consistency_modes(self):
        for enabled in (True, False):
            with self.subTest(consistency=enabled):
                cfg = {"seed": 42, "consistency": enabled}
                seeds = [pipeline.image_seed(cfg, i) for i in range(5)]
                self.assertEqual(seeds, [1042, 2042, 3042, 4042, 5042])
                self.assertEqual(len(set(seeds)), 5)

    def test_generates_five_complete_scenes_through_each_modality(self):
        plan = {
            "title": "El mapa de Lía",
            "protagonist": "Lía, una exploradora",
            "protagonist_en": "a young explorer with a red scarf",
            "setting_en": "a forest beside a silver river",
        }
        scenes = [
            {"text": f"Lía encuentra una pista en la escena {i}.", "image_en": f"Lía explores place {i}",
             "sound_tag": "lluvia", "raw": ""}
            for i in range(1, 6)
        ]
        events = []
        cfg = {"seed": 42, "consistency": True, "ip_adapter": False, "tts_model": "local-tts"}

        with tempfile.TemporaryDirectory() as temp_dir, ExitStack() as stack:
            plan_story = stack.enter_context(patch.object(pipeline.text_gen, "plan_story", return_value=(plan, 3)))
            write_scene = stack.enter_context(
                patch.object(pipeline.text_gen, "write_scene", side_effect=[(scene, 4) for scene in scenes])
            )
            generate_image = stack.enter_context(patch.object(pipeline.image_gen, "generate"))
            synthesize = stack.enter_context(patch.object(pipeline.tts_gen, "synthesize", return_value=2.5))
            generate_ambient = stack.enter_context(patch.object(pipeline.ambient_gen, "generate"))
            clip_scores = stack.enter_context(
                patch.object(pipeline.consistency, "clip_scores", return_value={"clip_mean": 0.9, "clip_min": 0.8})
            )
            stack.enter_context(patch.object(pipeline, "keep_models_loaded", return_value=False))
            unload = stack.enter_context(patch.object(pipeline.models, "unload"))

            result = pipeline.generate(
                cfg, "Lía busca un mapa", "fantasia", Path(temp_dir), "story-key",
                lambda **fields: events.append(fields),
            )

        self.assertEqual(len(result["scenes"]), 5)
        self.assertEqual([scene["index"] for scene in result["scenes"]], [1, 2, 3, 4, 5])
        self.assertEqual([scene["image_seed"] for scene in result["scenes"]], [1042, 2042, 3042, 4042, 5042])
        self.assertTrue(all(scene["image"].startswith("/api/media/story-key/scene_") for scene in result["scenes"]))
        self.assertTrue(all(scene["audio"].startswith("/api/media/story-key/voice_") for scene in result["scenes"]))
        self.assertTrue(all(scene["ambient"].startswith("/api/media/story-key/ambient_") for scene in result["scenes"]))
        self.assertEqual((plan_story.call_count, write_scene.call_count), (1, 5))
        self.assertEqual((generate_image.call_count, synthesize.call_count, generate_ambient.call_count), (5, 5, 5))
        self.assertEqual(clip_scores.call_count, 1)
        self.assertEqual(result["metrics"]["tokens"], 23)
        self.assertEqual(result["metrics"]["protagonist_mentions"], 5)
        self.assertEqual(result["metrics"]["clip_mean"], 0.9)
        self.assertEqual(events[-1]["status"], "done")
        self.assertEqual(events[-1]["progress"], pipeline.TOTAL_STEPS)
        self.assertEqual([call.args[0] for call in unload.call_args_list], ["llm:", "img:", "tts:", "clip:"])


if __name__ == "__main__":
    unittest.main()
