"""Genres, styles, sound tags, model profiles and run configuration."""
import os
import random
from functools import lru_cache

GENRES = [
    {"id": "fantasia", "name": "Fantasía", "tagline": "Reinos olvidados y magias antiguas"},
    {"id": "misterio", "name": "Misterio", "tagline": "Pistas entre la niebla y secretos antiguos"},
    {"id": "terror", "name": "Terror", "tagline": "Sombras que susurran en la oscuridad"},
    {"id": "aventura", "name": "Aventura", "tagline": "Expediciones hacia lo desconocido"},
    {"id": "ciencia_ficcion", "name": "Ciencia Ficción", "tagline": "Fronteras cósmicas y realidades sintéticas"},
    {"id": "infantil", "name": "Infantil", "tagline": "Cuentos tiernos para soñar despierto"},
]
GENRE_IDS = {g["id"] for g in GENRES}

# Short, fixed visual style per genre: the backbone of visual continuity.
GENRE_STYLE = {
    "fantasia": "storybook gouache illustration, magical golden light, violet and gold palette",
    "misterio": "noir storybook illustration, amber lamplight, foggy, brown and amber palette",
    "terror": "dark atmospheric storybook illustration, eerie, crimson and black palette, no gore",
    "aventura": "vibrant adventure storybook illustration, emerald and teal palette, epic landscape",
    "ciencia_ficcion": "cinematic sci-fi storybook illustration, cyan neon glow, deep blue palette",
    "infantil": "soft children's picture book watercolor illustration, pastel palette, cute",
}

GENRE_DEFAULT_SOUND = {
    "fantasia": "magia",
    "misterio": "lluvia",
    "terror": "viento",
    "aventura": "bosque",
    "ciencia_ficcion": "espacio",
    "infantil": "caja_musical",
}

SOUND_TAGS = {
    "lluvia": "Lluvia suave",
    "tormenta": "Tormenta con truenos",
    "viento": "Viento ululante",
    "mar": "Oleaje del mar",
    "bosque": "Bosque con pájaros",
    "fuego": "Fuego crepitante",
    "noche": "Noche con grillos",
    "espacio": "Zumbido espacial",
    "cueva": "Cueva con goteo",
    "ciudad": "Rumor de ciudad",
    "magia": "Destellos mágicos",
    "caja_musical": "Caja musical",
}

NARRATIVE_ARC = [
    "Inicio: presenta al protagonista, su mundo y su deseo.",
    "Desarrollo: aparece un desafío o un viaje que lo saca de su rutina.",
    "Conflicto: el problema se complica y surge un obstáculo serio.",
    "Clímax: el momento decisivo donde el protagonista actúa.",
    "Desenlace: cierre emotivo y coherente que resuelve la historia.",
]

CLIP_MODEL = "openai/clip-vit-base-patch32"  # MIT. Only used to MEASURE visual consistency.
IP_ADAPTER_REPO = "h94/IP-Adapter"  # Apache 2.0. SDXL adapter used to keep character identity.

# Licences: Qwen2.5-1.5B / 7B-Instruct = Apache-2.0 · Qwen2.5-3B-Instruct = Qwen Research (non-commercial)
PROFILES = {
    "ligero": {
        "label": "Ligero (CPU)",
        "text_model": "Qwen/Qwen2.5-1.5B-Instruct", "text_quant": None,
        "image_model": "stabilityai/sd-turbo", "image_size": 512, "image_steps": 2, "ip_adapter": False,
        "tts_model": "facebook/mms-tts-spa",
    },
    "equilibrado": {
        "label": "Equilibrado (GPU 8 GB+)",
        "min_vram_gb": 8,
        "text_model": "Qwen/Qwen2.5-3B-Instruct", "text_quant": None,
        "image_model": "stabilityai/sdxl-turbo", "image_size": 512, "image_steps": 4, "ip_adapter": False,
        "tts_model": "facebook/mms-tts-spa",
    },
    "calidad": {
        "label": "Calidad (GPU 12 GB+)",
        "min_vram_gb": 12,
        "text_model": "Qwen/Qwen2.5-7B-Instruct", "text_quant": "4bit",
        "image_model": "stabilityai/sdxl-turbo", "image_size": 768, "image_steps": 4, "ip_adapter": True,
        "ip_adapter_model": IP_ADAPTER_REPO,
        "tts_model": "facebook/mms-tts-spa",
    },
}


@lru_cache
def device() -> str:
    pref = os.environ.get("STORYBOOK_DEVICE", "auto")
    if pref != "auto":
        return pref
    try:
        import torch
    except ImportError:
        return "cpu"
    return "cuda" if torch.cuda.is_available() else "cpu"


def default_profile() -> str:
    env = os.environ.get("STORYBOOK_PROFILE", "")
    if env in PROFILES:
        return env
    return "equilibrado" if device() == "cuda" else "ligero"


def keep_models_loaded() -> bool:
    """Free memory between phases unless the GPU is big (>= 22 GB) or the user forces it."""
    env = os.environ.get("STORYBOOK_KEEP_MODELS", "auto").lower()
    if env in ("true", "1"):
        return True
    if env in ("false", "0") or device() != "cuda":
        return False
    import torch

    return torch.cuda.get_device_properties(0).total_memory >= 22e9


def build_config(profile=None, seed=None, image_steps=None, temperature=0.8, consistency=True, ip_adapter=None) -> dict:
    """Single place that turns user options into the run configuration stored with every story."""
    profile = profile or default_profile()
    p = PROFILES[profile]
    use_ip = p["ip_adapter"] if ip_adapter is None else bool(ip_adapter)
    return {
        "profile": profile, "text_model": p["text_model"], "text_quant": p["text_quant"],
        "image_model": p["image_model"], "tts_model": p["tts_model"], "image_size": p["image_size"],
        "image_steps": image_steps or p["image_steps"], "temperature": temperature,
        "seed": seed if seed is not None else random.randint(0, 999_999),
        # IP-Adapter only exists for SDXL-family checkpoints and only makes sense with consistency on.
        "ip_adapter": bool(use_ip and consistency and "xl" in p["image_model"]),
        "consistency": consistency, "device": device(),
    }
