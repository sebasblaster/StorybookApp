"""Objective visual-consistency metric: cosine similarity between CLIP embeddings of the 5 scenes.

CLIP is used ONLY to measure; it never takes part in generating the story.
Higher mean similarity = scenes look more alike (same character / palette / style).
"""
import numpy as np

from engine import models


def stats_from_embeddings(emb: np.ndarray) -> dict:
    emb = emb / np.linalg.norm(emb, axis=1, keepdims=True)
    sim = emb @ emb.T
    n = len(emb)
    pairs = [float(sim[i, j]) for i in range(n) for j in range(i + 1, n)]
    return {
        "clip_mean": round(float(np.mean(pairs)), 4) if pairs else None,
        "clip_min": round(float(np.min(pairs)), 4) if pairs else None,
        "clip_vs_first": [round(float(sim[0, i]), 4) for i in range(1, n)],
    }


def clip_scores(image_paths: list[str]) -> dict:
    import torch
    from PIL import Image

    proc, model = models.clip()
    imgs = [Image.open(p).convert("RGB") for p in image_paths]
    inputs = proc(images=imgs, return_tensors="pt").to(model.device)
    with torch.no_grad():
        feats = model.get_image_features(**inputs)
    return stats_from_embeddings(feats.float().cpu().numpy())
