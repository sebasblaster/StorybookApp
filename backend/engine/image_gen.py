"""Local illustration generation with SD-Turbo / SDXL-Turbo (diffusers), optional IP-Adapter."""
import logging

from engine import models
from engine.config import GENRE_STYLE

log = logging.getLogger("storybook.image")


def _token_ids(tokenizer, prompt: str) -> list:
    tokenize = getattr(tokenizer, "tokenize", None)
    convert_tokens_to_ids = getattr(tokenizer, "convert_tokens_to_ids", None)
    if callable(tokenize) and callable(convert_tokens_to_ids):
        return convert_tokens_to_ids(tokenize(prompt))
    return tokenizer.encode(prompt, add_special_tokens=False)


def build_prompt(genre: str, plan: dict, image_en: str, consistency: bool) -> str:
    parts = [GENRE_STYLE[genre]]
    if consistency:
        parts.append(f"main character: {plan['protagonist_en']}")
    parts.append(image_en)
    if consistency:
        parts.append(plan["setting_en"])
    return ", ".join(p for p in parts if p)


def fit_prompt(prompt: str, tokenizers: list) -> str:
    tokenizers = [tokenizer for tokenizer in tokenizers if tokenizer is not None]
    if not tokenizers:
        return prompt

    max_tokens = min(min(int(tokenizer.model_max_length), 77) - 2 for tokenizer in tokenizers)
    primary = tokenizers[0]
    token_ids = _token_ids(primary, prompt)
    if len(token_ids) <= max_tokens:
        return prompt

    original_length = len(token_ids)
    while any(len(_token_ids(tokenizer, prompt)) > max_tokens for tokenizer in tokenizers):
        token_ids = _token_ids(primary, prompt)
        if not token_ids:
            break
        prompt = primary.decode(token_ids[:-1], skip_special_tokens=True)
    log.warning("Image prompt shortened from %s tokens to fit CLIP's %s-token input", original_length, max_tokens)
    return prompt


def generate(cfg: dict, prompt: str, seed: int, path: str, ref_image=None):
    """Render one illustration and return the PIL image and effective prompt.

    With cfg["ip_adapter"] the first scene is used as visual reference for the rest
    (ref_image=None on scene 1 -> adapter scale 0, a neutral grey image is passed because
    diffusers requires an image whenever an adapter is loaded).
    """
    import torch
    from PIL import Image

    use_ip = bool(cfg.get("ip_adapter"))
    pipe = models.image_pipe(cfg["image_model"], ip_adapter=use_ip)
    tokenizers = [pipe.tokenizer, getattr(pipe, "tokenizer_2", None)]
    prompt = fit_prompt(prompt, tokenizers)
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
    return img, prompt
