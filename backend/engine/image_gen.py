"""Local illustration generation with SD-Turbo / SDXL-Turbo (diffusers), optional IP-Adapter."""
from engine import models
from engine.config import GENRE_STYLE


def build_prompt(genre: str, plan: dict, image_en: str, consistency: bool) -> str:
    parts = [GENRE_STYLE[genre], image_en]
    if consistency:
        parts += [f"main character: {plan['protagonist_en']}", plan["setting_en"]]
    return ", ".join(p for p in parts if p)


def generate(cfg: dict, prompt: str, seed: int, path: str, ref_image=None):
    """Render one illustration and return the PIL image.

    With cfg["ip_adapter"] the first scene is used as visual reference for the rest
    (ref_image=None on scene 1 -> adapter scale 0, a neutral grey image is passed because
    diffusers requires an image whenever an adapter is loaded).
    """
    import torch
    from PIL import Image

    use_ip = bool(cfg.get("ip_adapter"))
    pipe = models.image_pipe(cfg["image_model"], ip_adapter=use_ip)
    gen = torch.Generator(device="cpu").manual_seed(seed)
    size = cfg["image_size"]
    kwargs = {}
    if use_ip:
        pipe.set_ip_adapter_scale(0.6 if ref_image is not None else 0.0)
        kwargs["ip_adapter_image"] = ref_image if ref_image is not None else Image.new("RGB", (224, 224), (128, 128, 128))
    img = pipe(
        prompt=prompt,
        num_inference_steps=cfg["image_steps"],
        guidance_scale=0.0,
        width=size,
        height=size,
        generator=gen,
        **kwargs,
    ).images[0]
    img.save(path, "JPEG", quality=90)
    return img
