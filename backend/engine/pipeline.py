"""End-to-end local generation: plan -> 5 scenes -> images -> voice -> ambient -> consistency metric.

`generate` knows nothing about the database: it reports progress through `emit(**fields)`.
The API worker persists those fields in SQLite; the experiments CLI just prints them.
"""
import logging
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

from engine import ambient_gen, consistency, image_gen, models, text_gen, tts_gen
from engine.config import GENRE_DEFAULT_SOUND, SOUND_TAGS, keep_models_loaded

log = logging.getLogger("storybook.pipeline")
TOTAL_STEPS = 16  # 1 plan + 5 texts + 5 images + 5 audio


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def media_url(key: str, name: str) -> str:
    return f"/api/media/{key}/{name}"


def image_seed(cfg: dict, i: int) -> int:
    # Keep the run reproducible without reusing the same latent composition in every scene.
    return cfg["seed"] + 1000 * (i + 1)


def mentions(protagonist: str, scenes: list) -> int:
    name = protagonist.split(",")[0].split(" ")[0].strip(".:;").lower()
    return sum(1 for sc in scenes if name and name in sc["text"].lower())


def generate(cfg: dict, idea: str, genre: str, folder: Path, key: str, emit: Callable[..., None]) -> dict:
    folder.mkdir(parents=True, exist_ok=True)
    metrics = {"text_s": 0.0, "image_s": [], "tts_s": [], "ambient_s": [], "tokens": 0, "audio_s": [], "scene_words": []}
    t_start = time.time()
    emit(status="generating", stage="Planificando personajes y mundo", progress=0, scenes=[], error=None, started_at=now())

    # ---- 1. text ----
    t = time.time()
    plan, n = text_gen.plan_story(cfg, idea, genre)
    metrics["tokens"] += n
    emit(title=plan["title"], plan=plan, progress=1)

    scenes, previous = [], []
    for i in range(5):
        emit(stage=f"Escribiendo escena {i + 1} de 5")
        sc, n = text_gen.write_scene(cfg, idea, genre, plan, previous, i)
        metrics["tokens"] += n
        sound = sc["sound_tag"] or GENRE_DEFAULT_SOUND[genre]
        scenes.append({
            "index": i + 1, "text": sc["text"], "image_en": sc["image_en"], "raw": sc["raw"],
            "sound_tag": sound, "sound_name": SOUND_TAGS[sound],
            "image": None, "image_prompt": None, "image_seed": None,
            "audio": None, "audio_duration": None, "ambient": None,
        })
        metrics["scene_words"].append(len(sc["text"].split()))
        previous.append(sc["text"])
        emit(scenes=scenes, progress=2 + i)
    metrics["text_s"] = round(time.time() - t, 2)
    if not keep_models_loaded():
        models.unload("llm:")

    # ---- 2. images ----
    ref_image, image_paths = None, []
    for i, scene in enumerate(scenes):
        emit(stage=f"Ilustrando escena {i + 1} de 5")
        seed = image_seed(cfg, i)
        prompt = image_gen.build_prompt(genre, plan, scene["image_en"], cfg["consistency"])
        name = f"scene_{i + 1}_{seed}.jpg"
        t = time.time()
        img = image_gen.generate(cfg, prompt, seed, str(folder / name), ref_image=ref_image)
        if i == 0 and cfg.get("ip_adapter"):
            ref_image = img  # the first illustration defines the character for the rest
        metrics["image_s"].append(round(time.time() - t, 2))
        image_paths.append(str(folder / name))
        scene.update(image=media_url(key, name), image_prompt=prompt, image_seed=seed)
        emit(scenes=scenes, progress=7 + i, cover=scenes[0]["image"])
    if not keep_models_loaded():
        models.unload("img:")

    # ---- 3. voice + ambient ----
    for i, scene in enumerate(scenes):
        emit(stage=f"Narrando y ambientando escena {i + 1} de 5")
        t = time.time()
        dur = tts_gen.synthesize(cfg["tts_model"], scene["text"], str(folder / f"voice_{i + 1}.wav"), cfg["seed"])
        metrics["tts_s"].append(round(time.time() - t, 2))
        metrics["audio_s"].append(dur)
        t = time.time()
        ambient_gen.generate(scene["sound_tag"], GENRE_DEFAULT_SOUND[genre], cfg["seed"] + i, str(folder / f"ambient_{i + 1}.wav"))
        metrics["ambient_s"].append(round(time.time() - t, 2))
        scene.update(audio=media_url(key, f"voice_{i + 1}.wav"), audio_duration=dur,
                     ambient=media_url(key, f"ambient_{i + 1}.wav"))
        emit(scenes=scenes, progress=12 + i)
    if not keep_models_loaded():
        models.unload("tts:")

    # ---- 4. objective consistency metric (never blocks the story) ----
    emit(stage="Midiendo consistencia visual")
    try:
        t = time.time()
        metrics.update(consistency.clip_scores(image_paths))
        metrics["clip_s"] = round(time.time() - t, 2)
    except Exception as exc:  # CLIP missing in the offline cache, etc.
        log.warning("CLIP metric skipped: %s", exc)
        metrics.update(clip_mean=None, clip_min=None, clip_vs_first=[])
    finally:
        models.unload("clip:")

    metrics["total_s"] = round(time.time() - t_start, 2)
    metrics["protagonist_mentions"] = mentions(plan["protagonist"], scenes)
    emit(status="done", stage="Listo", progress=TOTAL_STEPS, metrics=metrics, finished_at=now())
    return {"plan": plan, "scenes": scenes, "metrics": metrics}


def regenerate_scene_image(cfg: dict, genre: str, plan: dict, scene: dict, folder: Path, key: str, idx: int, seed: int,
                           first_image_path: Path | None) -> str:
    """Re-render one illustration. Returns the new media URL."""
    from PIL import Image

    prompt = image_gen.build_prompt(genre, plan, scene["image_en"], cfg["consistency"])
    name = f"scene_{idx + 1}_{seed}.jpg"
    ref = Image.open(first_image_path).convert("RGB") if cfg.get("ip_adapter") and idx > 0 and first_image_path else None
    image_gen.generate(cfg, prompt, seed, str(folder / name), ref_image=ref)
    if not keep_models_loaded():
        models.unload("img:")
    return media_url(key, name)


def regenerate_scene_audio(cfg: dict, scene: dict, folder: Path, key: str, idx: int) -> tuple[str, float]:
    """Re-synthesize narration for an edited scene without rebuilding its ambient audio."""
    name = f"voice_{idx + 1}_{uuid.uuid4().hex[:12]}.wav"
    try:
        duration = tts_gen.synthesize(cfg["tts_model"], scene["text"], str(folder / name), cfg["seed"])
        return media_url(key, name), duration
    finally:
        if not keep_models_loaded():
            models.unload("tts:")
