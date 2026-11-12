"""Single-worker generation queue.

One worker thread runs one job at a time, so two big models are never in memory together.
Pending stories are re-queued automatically if the server restarts.
"""
import logging
import os
import queue
import threading

import db
from engine import pipeline
from engine.paths import MEDIA_ROOT

log = logging.getLogger("storybook.jobs")
_q: queue.Queue = queue.Queue()
_thread: threading.Thread | None = None


def size() -> int:
    return _q.qsize()


def submit(*job) -> None:
    _q.put(job)


def _run_story(story_id: str) -> None:
    s = db.get_story(story_id)
    if not s:
        return
    try:
        pipeline.generate(s["config"], s["idea"], s["genre"], MEDIA_ROOT / s["media_key"], s["media_key"],
                          lambda **f: db.update_story(story_id, **f))
    except Exception as exc:  # surface any model/runtime failure to the UI
        log.exception("generation failed for %s", story_id)
        db.update_story(story_id, status="error", error=f"{type(exc).__name__}: {exc}"[:400])


def _regenerate(story_id: str, idx: int, seed: int) -> None:
    s = db.get_story(story_id)
    if not s:
        return
    try:
        first = None
        if idx > 0 and s["scenes"][0].get("image"):
            first = MEDIA_ROOT / s["scenes"][0]["image"].split("/api/media/", 1)[1]
        url = pipeline.regenerate_scene_image(s["config"], s["genre"], s["plan"], s["scenes"][idx],
                                              MEDIA_ROOT / s["media_key"], s["media_key"], idx, seed, first)
        db.update_scene(story_id, idx, image=url, image_seed=seed, regenerating=False)
    except Exception:
        log.exception("regenerate failed")
        db.update_scene(story_id, idx, regenerating=False)


def _renarrate(story_id: str, idx: int) -> None:
    s = db.get_story(story_id)
    if not s:
        return
    try:
        url, duration = pipeline.regenerate_scene_audio(
            s["config"], s["scenes"][idx], MEDIA_ROOT / s["media_key"], s["media_key"], idx
        )
        db.update_scene(story_id, idx, audio=url, audio_duration=duration,
                        audio_regenerating=False, audio_error=None, audio_stale=False)
    except Exception as exc:
        log.exception("renarrate failed for %s scene %s", story_id, idx + 1)
        db.update_scene(story_id, idx, audio_regenerating=False,
                        audio_error=f"{type(exc).__name__}: {exc}"[:400])


def _loop() -> None:
    while True:
        job = _q.get()
        try:
            if job[0] == "story":
                _run_story(job[1])
            elif job[0] == "image":
                _regenerate(job[1], job[2], job[3])
            elif job[0] == "audio":
                _renarrate(job[1], job[2])
            else:
                raise ValueError(f"Unknown job type: {job[0]}")
        except Exception:
            log.exception("job failed: %s", job)
        finally:
            _q.task_done()


def start() -> None:
    """Start the worker and re-queue stories interrupted by a restart."""
    global _thread
    if os.environ.get("STORYBOOK_DISABLE_WORKER") == "1" or _thread:
        return
    for sid in db.pending_ids():
        db.update_story(sid, status="queued", stage="En cola")
        submit("story", sid)
    _thread = threading.Thread(target=_loop, name="storybook-worker", daemon=True)
    _thread.start()
