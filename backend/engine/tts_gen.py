"""Spanish narration with Meta MMS-TTS (VITS) running locally."""
import re

import numpy as np
from scipy.io import wavfile

from engine import models


def _prepare(text: str) -> list[str]:
    text = text.replace("—", ", ").replace("…", ".").replace("«", "").replace("»", "")
    return [s.strip() for s in re.split(r"(?<=[.!?;:])\s+", text) if s.strip()]


def synthesize(model_id: str, text: str, path: str, seed: int) -> float:
    import torch

    tok, model = models.tts(model_id)
    model.speaking_rate = 0.95
    rate = model.config.sampling_rate
    pause = np.zeros(int(rate * 0.28), dtype=np.float32)
    chunks = []
    for k, s in enumerate(_prepare(text)):
        inputs = tok(s.lower(), return_tensors="pt").to(model.device)
        if inputs["input_ids"].shape[1] < 2:
            continue
        torch.manual_seed(seed + k)
        with torch.no_grad():
            wav = model(**inputs).waveform[0].float().cpu().numpy()
        chunks += [wav, pause]
    audio = np.concatenate(chunks) if chunks else np.zeros(rate, dtype=np.float32)
    audio = audio / max(1e-6, float(np.abs(audio).max())) * 0.9
    wavfile.write(path, rate, (audio * 32767).astype(np.int16))
    return round(len(audio) / rate, 2)
