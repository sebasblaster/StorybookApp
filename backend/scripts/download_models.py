"""Pre-download every model used by Storybook so the app runs offline afterwards.

Usage:  python scripts/download_models.py [--profile ligero|equilibrado|calidad|all]
Then set HF_HUB_OFFLINE=1 in backend/.env to guarantee no network access.
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from huggingface_hub import snapshot_download  # noqa: E402

from engine.config import CLIP_MODEL, IP_ADAPTER_REPO, PROFILES  # noqa: E402

TEXT_PATTERNS = ["*.json", "*.safetensors", "*.txt"]
# Only the fp16 weights of each diffusers component (avoids the 7 GB single-file checkpoint of SDXL-Turbo).
IMAGE_PATTERNS = ["model_index.json", "*/*.json", "*/*.txt", "tokenizer*/*", "scheduler/*",
                  "unet/*fp16.safetensors", "vae/*fp16.safetensors", "text_encoder*/*fp16.safetensors"]
IP_PATTERNS = ["sdxl_models/ip-adapter_sdxl.safetensors", "sdxl_models/image_encoder/model.safetensors"]
CLIP_PATTERNS = ["*.json", "*.txt", "*.safetensors", "*.bin"]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--profile", default="ligero", choices=[*PROFILES, "all"])
    args = ap.parse_args()
    names = list(PROFILES) if args.profile == "all" else [args.profile]
    repos: dict[str, list[str] | None] = {CLIP_MODEL: CLIP_PATTERNS}
    for name in names:
        p = PROFILES[name]
        repos[p["text_model"]] = TEXT_PATTERNS
        repos[p["image_model"]] = IMAGE_PATTERNS
        repos[p["tts_model"]] = None
        if p["ip_adapter"]:
            repos[IP_ADAPTER_REPO] = IP_PATTERNS
    for repo, patterns in repos.items():
        print(f"Downloading {repo}")
        snapshot_download(repo, allow_patterns=patterns)
    print("Listo. Todos los modelos están en la caché local de Hugging Face.")
    print("Ahora agrega HF_HUB_OFFLINE=1 a backend/.env para trabajar sin conexión.")


if __name__ == "__main__":
    main()
