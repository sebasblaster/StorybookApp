"""Unit tests for the generation engine (no model weights needed).  Run:  python -m unittest discover -s tests -v"""
import tests._env  # noqa: F401  (must be first)

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
from scipy.io import wavfile

from engine import ambient_gen, consistency, image_gen
from engine.config import (GENRE_DEFAULT_SOUND, GENRE_STYLE, GENRES, NARRATIVE_ARC, PROFILES, SOUND_TAGS,
                           build_config)
from engine.text_gen import _scene_prompt, clean_text, parse_labels, plan_story, sanitize_scene, write_scene

PLAN = {"protagonist_en": "a girl with a red braid and green cloak", "setting_en": "a floating city"}


class TextParsing(unittest.TestCase):
    def test_parse_plain(self):
        raw = "TITULO: El faro\nPROTAGONISTA: Lía, una niña\nPROTAGONISTA_EN: a girl\nESCENARIO_EN: a cliff"
        p = parse_labels(raw, ["TITULO", "PROTAGONISTA", "PROTAGONISTA_EN", "ESCENARIO_EN"])
        self.assertEqual(p, {"TITULO": "El faro", "PROTAGONISTA": "Lía, una niña", "PROTAGONISTA_EN": "a girl", "ESCENARIO_EN": "a cliff"})

    def test_parse_markdown_accents_multiline(self):
        raw = "**Título:** La torre\n**TEXTO:** Primera línea\ncontinúa aquí.\n- Sonido: lluvia"
        p = parse_labels(raw, ["TITULO", "TEXTO", "SONIDO"])
        self.assertEqual(p["TITULO"], "La torre")
        self.assertEqual(p["TEXTO"], "Primera línea continúa aquí.")
        self.assertEqual(p["SONIDO"], "lluvia")

    def test_clean_text(self):
        self.assertEqual(clean_text('  «Hola   mundo»  '), "Hola mundo")

    def test_sanitize_cuts_label_spam(self):
        raw = "La luna arde. Las hojas crujen bajo sus pies. BOSQUE: VIENTO: NOCHE: FUERTE LÁNGUAS: MAGIA"
        self.assertEqual(sanitize_scene(raw), "La luna arde. Las hojas crujen bajo sus pies.")

    def test_sanitize_caps_length_at_sentence(self):
        out = sanitize_scene(" ".join(["Una frase de cinco palabras."] * 40), max_words=22)
        self.assertLessEqual(len(out.split()), 22)
        self.assertTrue(out.endswith("."))


class SceneGeneration(unittest.TestCase):
    def test_scene_prompt_keeps_user_premise_as_explicit_constraint(self):
        idea = "un fantasma que persigue campistas en un bosque"
        prompt = _scene_prompt(build_config("ligero", seed=4), idea, "terror", {
            "title": "La noche del bosque", "protagonist": "Nilo, un fantasma",
        }, [], 2)
        self.assertIn(f"PREMISA OBLIGATORIA DEL USUARIO (respétala en toda la historia): «{idea}»", prompt)
        self.assertIn("no reemplaza la premisa", prompt)
        self.assertIn("No cambies al protagonista, el objetivo ni la situación central", prompt)

    def test_story_plan_instructs_model_to_anchor_character_in_idea(self):
        with patch("engine.text_gen.chat", return_value=(
            "TITULO: La noche del bosque\nPROTAGONISTA: Nilo, un fantasma\n"
            "PROTAGONISTA_EN: a pale ghost in a tattered coat\nESCENARIO_EN: a moonlit campsite in a dense forest", 10,
        )) as chat:
            plan, _ = plan_story(build_config("ligero", seed=4), "un fantasma que persigue campistas", "terror")
        prompt = chat.call_args.args[1]
        self.assertIn("Idea del usuario: «un fantasma que persigue campistas»", prompt)
        self.assertIn("no la reemplaces por un personaje, objetivo o conflicto distinto", prompt)
        self.assertEqual(plan["protagonist"], "Nilo, un fantasma")

    def test_incomplete_scene_raises_after_retry(self):
        first = {"text": "palabra " * 10}
        retry = {"text": "palabra " * 20}
        with patch("engine.text_gen._attempt", side_effect=[(first, 5), (retry, 5)]) as attempt:
            with self.assertRaisesRegex(RuntimeError, "escena 1.*20 palabras.*35"):
                write_scene({}, "idea", "fantasia", {}, [], 0)
        self.assertEqual(attempt.call_count, 2)


class Config(unittest.TestCase):
    def test_integrity(self):
        ids = {g["id"] for g in GENRES}
        self.assertEqual(len(ids), 6)
        self.assertEqual(set(GENRE_STYLE), ids)
        self.assertEqual(set(GENRE_DEFAULT_SOUND), ids)
        self.assertTrue(all(s in SOUND_TAGS for s in GENRE_DEFAULT_SOUND.values()))
        self.assertEqual(len(NARRATIVE_ARC), 5)

    def test_ip_adapter_only_for_sdxl_with_consistency(self):
        self.assertTrue(build_config("calidad", 1)["ip_adapter"])
        self.assertFalse(build_config("calidad", 1, consistency=False)["ip_adapter"])
        self.assertFalse(build_config("ligero", 1, ip_adapter=True)["ip_adapter"])  # sd-turbo: no adapter available
        self.assertFalse(build_config("equilibrado", 1)["ip_adapter"])

    def test_profiles_have_required_keys(self):
        for p in PROFILES.values():
            for k in ("text_model", "image_model", "tts_model", "image_size", "image_steps"):
                self.assertIn(k, p)

    def test_seed_is_kept(self):
        self.assertEqual(build_config("ligero", 123)["seed"], 123)


class Prompts(unittest.TestCase):
    def test_consistency_on_includes_bible(self):
        p = image_gen.build_prompt("fantasia", PLAN, "a girl on a bridge", True)
        self.assertTrue(p.startswith(GENRE_STYLE["fantasia"]))
        self.assertIn(PLAN["protagonist_en"], p)
        self.assertIn(PLAN["setting_en"], p)

    def test_consistency_off_excludes_bible(self):
        p = image_gen.build_prompt("terror", PLAN, "a lighthouse", False)
        self.assertNotIn(PLAN["protagonist_en"], p)
        self.assertIn("a lighthouse", p)


class Ambient(unittest.TestCase):
    def test_every_ambient_renders_loopable_wav(self):
        with tempfile.TemporaryDirectory() as d:
            for tag in ambient_gen.SYNTHS:
                out = Path(d) / f"{tag}.wav"
                ambient_gen.generate(tag, "magia", 7, str(out))
                sr, data = wavfile.read(out)
                self.assertEqual(sr, ambient_gen.SR, tag)
                self.assertEqual(len(data), int((ambient_gen.DUR - 1.5) * sr), tag)
                self.assertGreater(np.abs(data).max(), 1000, f"{tag} is silent")

    def test_deterministic(self):
        with tempfile.TemporaryDirectory() as d:
            a, b = Path(d) / "a.wav", Path(d) / "b.wav"
            ambient_gen.generate("lluvia", "viento", 3, str(a))
            ambient_gen.generate("lluvia", "viento", 3, str(b))
            self.assertTrue(np.array_equal(wavfile.read(a)[1], wavfile.read(b)[1]))


class ClipStats(unittest.TestCase):
    def test_identical_images_score_one(self):
        e = np.tile(np.array([[1.0, 2.0, 3.0]]), (5, 1))
        s = consistency.stats_from_embeddings(e)
        self.assertAlmostEqual(s["clip_mean"], 1.0, places=3)
        self.assertEqual(len(s["clip_vs_first"]), 4)

    def test_orthogonal_images_score_zero(self):
        s = consistency.stats_from_embeddings(np.eye(5))
        self.assertAlmostEqual(s["clip_mean"], 0.0, places=3)

    def test_similar_beats_dissimilar(self):
        rng = np.random.default_rng(0)
        base = rng.standard_normal(32)
        similar = np.stack([base + 0.1 * rng.standard_normal(32) for _ in range(5)])
        different = rng.standard_normal((5, 32))
        self.assertGreater(consistency.stats_from_embeddings(similar)["clip_mean"],
                           consistency.stats_from_embeddings(different)["clip_mean"])


if __name__ == "__main__":
    unittest.main()
