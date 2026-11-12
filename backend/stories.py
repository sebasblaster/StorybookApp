"""Story, sharing, export and experiment routes."""
import os
import platform
import random
import shutil
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field

import db
import jobs
from auth import CurrentUser
from engine import models as engine_models
from engine.config import GENRE_IDS, GENRES, PROFILES, build_config, default_profile, device
from engine.paths import MEDIA_ROOT
from engine.pipeline import TOTAL_STEPS

router = APIRouter(prefix="/api")


class CreateStoryIn(BaseModel):
    idea: str = Field(min_length=3, max_length=500)
    genre: str
    profile: Optional[str] = None
    seed: Optional[int] = Field(default=None, ge=0, le=2**31 - 1)
    image_steps: Optional[int] = Field(default=None, ge=1, le=8)
    temperature: float = Field(default=0.8, ge=0.0, le=1.5)
    consistency: bool = True
    ip_adapter: Optional[bool] = None  # None = use the profile default (only SDXL profiles support it)


class PatchStoryIn(BaseModel):
    favorite: Optional[bool] = None
    title: Optional[str] = Field(default=None, min_length=1, max_length=140)


class RegenIn(BaseModel):
    seed: Optional[int] = Field(default=None, ge=0, le=2**31 - 1)


class EditSceneIn(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


class CompareIn(BaseModel):
    idea: str = Field(min_length=3, max_length=500)
    genre: str
    profile: Optional[str] = None
    seed: Optional[int] = Field(default=None, ge=0, le=2**31 - 1)


class RetryStoryIn(BaseModel):
    profile: Optional[str] = None


SCENE_FIELDS = ["index", "text", "image", "image_prompt", "image_seed", "sound_tag", "sound_name",
                "audio", "audio_duration", "ambient", "regenerating", "audio_regenerating", "audio_error",
                "audio_stale", "text_versions"]


def story_out(s: dict, owner: bool = True) -> dict:
    scene_fields = SCENE_FIELDS if owner else [field for field in SCENE_FIELDS if field not in {
        "audio_regenerating", "audio_error", "audio_stale", "text_versions",
    }]
    out = {
        "id": s["id"], "title": s.get("title") or "Cuento en preparación", "idea": s["idea"],
        "genre": s["genre"], "cover": s.get("cover"), "created_at": s["created_at"],
        "status": s["status"], "stage": s.get("stage"), "progress": s.get("progress", 0),
        "total_steps": TOTAL_STEPS, "error": s.get("error"),
        "protagonist": (s.get("plan") or {}).get("protagonist"),
        "scenes": [{k: sc.get(k) for k in scene_fields} for sc in s.get("scenes", [])],
        "config": s["config"], "metrics": s.get("metrics"),
    }
    if owner:
        out.update(favorite=s.get("favorite", False), share_token=s.get("share_token"))
    return out


def _own(story_id: str, user: dict) -> dict:
    s = db.get_story(story_id, user["id"])
    if not s:
        raise HTTPException(status_code=404, detail="Cuento no encontrado")
    return s


def _public(token: str) -> dict:
    s = db.by_share_token(token)
    if not s:
        raise HTTPException(status_code=404, detail="Este enlace no existe o fue desactivado")
    return s


def _profile_availability_error(profile: str) -> str | None:
    min_vram = PROFILES[profile].get("min_vram_gb")
    if min_vram:
        try:
            import torch
        except ImportError:
            return f"El perfil '{profile}' requiere una GPU NVIDIA compatible con CUDA y al menos {min_vram} GB de VRAM."
        if device() != "cuda" or not torch.cuda.is_available():
            return f"El perfil '{profile}' requiere una GPU NVIDIA compatible con CUDA y al menos {min_vram} GB de VRAM."
        vram_gb = torch.cuda.get_device_properties(0).total_memory / 1e9
        if vram_gb < min_vram:
            return f"El perfil '{profile}' requiere al menos {min_vram} GB de VRAM; este equipo tiene {vram_gb:.1f} GB."

    if os.environ.get("HF_HUB_OFFLINE") == "1":
        from huggingface_hub import scan_cache_dir

        cached = {repo.repo_id for repo in scan_cache_dir().repos}
        required_models = [
            PROFILES[profile][key]
            for key in ("text_model", "image_model", "tts_model")
        ]
        if PROFILES[profile].get("ip_adapter"):
            required_models.append(PROFILES[profile]["ip_adapter_model"])
        missing = [model for model in required_models if model not in cached]
        if missing:
            models = ", ".join(missing)
            return (
                f"El perfil '{profile}' necesita modelos no descargados: {models}. "
                f"Descárgalos con: python scripts/download_models.py --profile {profile}"
            )
    return None


# ---------- system ----------
@router.get("/health")
def health():
    return {"ok": True}


@router.get("/genres")
def list_genres():
    return GENRES


@router.get("/system")
def system_info(user: dict = CurrentUser):
    info = {"device": device(), "gpu": None, "vram_gb": None, "torch": None, "cuda": None,
            "offline": os.environ.get("HF_HUB_OFFLINE") == "1", "default_profile": default_profile(),
            "profiles": PROFILES, "cached_models": {}, "loaded_models": engine_models.loaded(),
            "queue_size": jobs.size(), "cpu": platform.processor() or platform.machine(), "cpu_count": os.cpu_count(),
            "python": platform.python_version(), "os": platform.platform()}
    try:
        import torch

        info.update(torch=torch.__version__, cuda=torch.version.cuda)
        if device() == "cuda":
            p = torch.cuda.get_device_properties(0)
            info.update(gpu=p.name, vram_gb=round(p.total_memory / 1e9, 1))
    except ImportError:
        pass
    try:
        from huggingface_hub import scan_cache_dir

        info["cached_models"] = {r.repo_id: round(r.size_on_disk / 1e9, 2) for r in scan_cache_dir().repos}
    except Exception:
        pass
    return info


# ---------- stories ----------
@router.post("/stories")
def create_story(body: CreateStoryIn, user: dict = CurrentUser):
    if body.genre not in GENRE_IDS:
        raise HTTPException(status_code=400, detail="Género no válido")
    if body.profile and body.profile not in PROFILES:
        raise HTTPException(status_code=400, detail="Perfil no válido")
    profile = body.profile or default_profile()
    availability_error = _profile_availability_error(profile)
    if availability_error:
        raise HTTPException(status_code=503, detail=availability_error)
    cfg = build_config(body.profile, body.seed, body.image_steps, body.temperature, body.consistency, body.ip_adapter)
    s = db.create_story(user["id"], body.idea.strip(), body.genre, cfg)
    jobs.submit("story", s["id"])
    return story_out(s)


@router.get("/stories")
def list_stories(user: dict = CurrentUser):
    return [story_out(s) for s in db.list_stories(user["id"], with_scenes=False)]


@router.get("/stories/{story_id}")
def get_story(story_id: str, user: dict = CurrentUser):
    s = _own(story_id, user)
    out = story_out(s)
    if s["status"] == "queued":
        out["queue_position"] = db.queue_position(s["created_at"])
    return out


@router.patch("/stories/{story_id}")
def patch_story(story_id: str, body: PatchStoryIn, user: dict = CurrentUser):
    s = _own(story_id, user)
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    db.update_story(s["id"], **fields)
    return story_out(db.get_story(s["id"]))


@router.delete("/stories/{story_id}")
def delete_story(story_id: str, user: dict = CurrentUser):
    s = _own(story_id, user)
    if s["status"] == "generating":
        raise HTTPException(status_code=409, detail="Esperá a que termine la generación para borrarlo")
    db.delete_story(s["id"])
    shutil.rmtree(MEDIA_ROOT / s["media_key"], ignore_errors=True)
    return {"ok": True}


@router.post("/stories/{story_id}/retry")
def retry_story(story_id: str, body: Optional[RetryStoryIn] = None, user: dict = CurrentUser):
    s = _own(story_id, user)
    if s["status"] != "error":
        raise HTTPException(status_code=409, detail="Solo se pueden reintentar cuentos con error")
    config = s["config"]
    profile = body.profile if body and body.profile else config.get("profile", default_profile())
    if profile not in PROFILES:
        raise HTTPException(status_code=400, detail="Perfil no válido")
    availability_error = _profile_availability_error(profile)
    if availability_error:
        raise HTTPException(status_code=503, detail=availability_error)
    if body and body.profile:
        config = build_config(
            profile=profile,
            seed=config.get("seed"),
            image_steps=config.get("image_steps"),
            temperature=config.get("temperature", 0.8),
            consistency=config.get("consistency", True),
        )
    db.update_story(s["id"], config=config, status="queued", stage="En cola", error=None)
    jobs.submit("story", s["id"])
    return {"ok": True}


@router.post("/stories/{story_id}/scenes/{index}/regenerate")
def regenerate_scene_image(story_id: str, index: int, body: RegenIn, user: dict = CurrentUser):
    s = _own(story_id, user)
    if s["status"] != "done" or not 1 <= index <= len(s["scenes"]):
        raise HTTPException(status_code=409, detail="La escena no está lista para regenerarse")
    seed = body.seed if body.seed is not None else random.randint(0, 999_999)
    db.update_scene(s["id"], index - 1, regenerating=True)
    jobs.submit("image", s["id"], index - 1, seed)
    return {"ok": True, "seed": seed}


@router.patch("/stories/{story_id}/scenes/{index}")
def edit_scene(story_id: str, index: int, body: EditSceneIn, user: dict = CurrentUser):
    s = _own(story_id, user)
    if s["status"] != "done" or not 1 <= index <= len(s["scenes"]):
        raise HTTPException(status_code=409, detail="La escena no está lista para editarse")
    scene = s["scenes"][index - 1]
    if scene.get("regenerating") or scene.get("audio_regenerating"):
        raise HTTPException(status_code=409, detail="Esperá a que terminen las tareas de esta escena")
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="El texto de la escena no puede quedar vacío")
    versions = scene.get("text_versions", [])
    changed = text != scene["text"]
    if changed:
        versions = [*versions, {
            "text": scene["text"],
            "saved_at": datetime.now(timezone.utc).isoformat(),
        }][-20:]
    db.update_scene(s["id"], index - 1, text=text, text_versions=versions, audio_error=None,
                    audio_stale=scene.get("audio_stale", False) or changed)
    return story_out(db.get_story(s["id"]))


@router.post("/stories/{story_id}/scenes/{index}/narrate")
def narrate_scene(story_id: str, index: int, user: dict = CurrentUser):
    s = _own(story_id, user)
    if s["status"] != "done" or not 1 <= index <= len(s["scenes"]):
        raise HTTPException(status_code=409, detail="La escena no está lista para narrarse")
    scene = s["scenes"][index - 1]
    if scene.get("regenerating") or scene.get("audio_regenerating"):
        raise HTTPException(status_code=409, detail="Esta escena ya tiene una tarea en curso")
    db.update_scene(s["id"], index - 1, audio_regenerating=True, audio_error=None)
    jobs.submit("audio", s["id"], index - 1)
    return {"ok": True}


# ---------- sharing ----------
@router.post("/stories/{story_id}/share")
def share_story(story_id: str, user: dict = CurrentUser):
    s = _own(story_id, user)
    token = s.get("share_token") or uuid.uuid4().hex[:16]
    db.update_story(s["id"], share_token=token)
    return {"share_token": token}


@router.delete("/stories/{story_id}/share")
def unshare_story(story_id: str, user: dict = CurrentUser):
    s = _own(story_id, user)
    db.update_story(s["id"], share_token=None)
    return {"ok": True}


@router.get("/public/stories/{token}")
def public_story(token: str):
    return story_out(_public(token), owner=False)


# ---------- export ----------
def _pdf_response(s: dict) -> Response:
    from engine.pdf_export import build_pdf

    if s["status"] != "done":
        raise HTTPException(status_code=409, detail="El cuento todavía se está generando")
    return Response(build_pdf(s), media_type="application/pdf",
                    headers={"Content-Disposition": 'attachment; filename="storybook.pdf"'})


@router.get("/stories/{story_id}/pdf")
def story_pdf(story_id: str, user: dict = CurrentUser):
    return _pdf_response(_own(story_id, user))


@router.get("/public/stories/{token}/pdf")
def public_pdf(token: str):
    return _pdf_response(_public(token))


# ---------- experiments ----------
@router.get("/experiments")
def experiments(user: dict = CurrentUser):
    return [
        {"id": s["id"], "title": s["title"], "genre": s["genre"], "idea": s["idea"],
         "created_at": s["created_at"], "config": s["config"], "metrics": s.get("metrics")}
        for s in db.list_done(user["id"])
    ]


@router.post("/experiments/compare")
def create_comparison(body: CompareIn, user: dict = CurrentUser):
    if body.genre not in GENRE_IDS:
        raise HTTPException(status_code=400, detail="Género no válido")
    profile = body.profile or "ligero"
    if profile not in PROFILES:
        raise HTTPException(status_code=400, detail="Perfil no válido")
    availability_error = _profile_availability_error(profile)
    if availability_error:
        raise HTTPException(status_code=503, detail=availability_error)

    seed = body.seed if body.seed is not None else random.randint(0, 999_999)
    comparison_id = uuid.uuid4().hex
    stories = []
    for enabled in (True, False):
        config = build_config(profile=profile, seed=seed, consistency=enabled, ip_adapter=False)
        config.update(comparison_id=comparison_id, comparison_strategy="on" if enabled else "off")
        story = db.create_story(user["id"], body.idea.strip(), body.genre, config)
        stories.append(story)
    for story in stories:
        jobs.submit("story", story["id"])
    return {
        "comparison_id": comparison_id,
        "stories": [story_out(story) for story in stories],
    }


@router.get("/experiments/comparisons")
def list_comparisons(user: dict = CurrentUser):
    groups = {}
    for story in db.list_stories(user["id"], with_scenes=True):
        comparison_id = story["config"].get("comparison_id")
        if comparison_id:
            groups.setdefault(comparison_id, []).append(story)
    comparisons = [
        {
            "id": comparison_id,
            "idea": group[0]["idea"],
            "genre": group[0]["genre"],
            "seed": group[0]["config"].get("seed"),
            "stories": [story_out(story) for story in sorted(
                group, key=lambda item: 0 if item["config"].get("comparison_strategy") == "on" else 1
            )],
        }
        for comparison_id, group in groups.items() if len(group) == 2
    ]
    return sorted(comparisons, key=lambda item: item["stories"][0]["created_at"], reverse=True)
