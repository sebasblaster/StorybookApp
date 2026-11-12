"""Lazy loaders for the local Hugging Face models (cached in HF_HOME)."""
import gc
import logging
import os
import threading

from engine.config import CLIP_MODEL, IP_ADAPTER_REPO, device

log = logging.getLogger("storybook.models")
_lock = threading.RLock()
_cache: dict = {}
_threads_tuned = False


def _dtype():
    import torch

    return torch.float16 if device() == "cuda" else torch.float32


def _tune_threads() -> None:
    """Respect the container CPU quota (cgroup v2) so PyTorch doesn't oversubscribe cores."""
    global _threads_tuned
    if _threads_tuned:
        return
    import torch

    n = int(os.environ.get("STORYBOOK_THREADS", "0"))
    if not n:
        try:
            quota, period = open("/sys/fs/cgroup/cpu.max").read().split()
            n = max(1, int(int(quota) / int(period))) if quota != "max" else os.cpu_count()
        except (OSError, ValueError):
            n = os.cpu_count() or 4
    torch.set_num_threads(n)
    _threads_tuned = True


def loaded() -> list[str]:
    return list(_cache)


def unload(prefix: str) -> None:
    with _lock:
        for k in [k for k in _cache if k.startswith(prefix)]:
            _cache.pop(k)
    gc.collect()
    if device() == "cuda":
        import torch

        torch.cuda.empty_cache()


def llm(model_id: str, quant: str | None = None):
    key = f"llm:{model_id}:{quant}"
    with _lock:
        if key not in _cache:
            import torch
            from transformers import AutoModelForCausalLM, AutoTokenizer

            _tune_threads()
            tok = AutoTokenizer.from_pretrained(model_id)
            model = None
            if quant == "4bit" and device() == "cuda":
                try:
                    from transformers import BitsAndBytesConfig

                    bnb = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4",
                                             bnb_4bit_compute_dtype=torch.float16)
                    model = AutoModelForCausalLM.from_pretrained(model_id, quantization_config=bnb, device_map={"": 0})
                except Exception as exc:  # bitsandbytes missing / unsupported: fall back to fp16
                    log.warning("4-bit loading failed (%s); falling back to fp16", exc)
            if model is None:
                model = AutoModelForCausalLM.from_pretrained(model_id, torch_dtype=_dtype())
                model.to(device())
            model.eval()
            _cache[key] = (tok, model)
        return _cache[key]


def image_pipe(model_id: str, ip_adapter: bool = False):
    key = f"img:{model_id}:{'ip' if ip_adapter else 'plain'}"
    with _lock:
        if key not in _cache:
            from diffusers import AutoPipelineForText2Image

            _tune_threads()
            pipe = AutoPipelineForText2Image.from_pretrained(model_id, torch_dtype=_dtype(), variant="fp16")
            if ip_adapter:
                pipe.load_ip_adapter(IP_ADAPTER_REPO, subfolder="sdxl_models", weight_name="ip-adapter_sdxl.safetensors")
            pipe.to(device())
            pipe.set_progress_bar_config(disable=True)
            _cache[key] = pipe
        return _cache[key]


def tts(model_id: str):
    key = f"tts:{model_id}"
    with _lock:
        if key not in _cache:
            from transformers import AutoTokenizer, VitsModel

            _tune_threads()
            tok = AutoTokenizer.from_pretrained(model_id)
            model = VitsModel.from_pretrained(model_id).to(device()).eval()
            _cache[key] = (tok, model)
        return _cache[key]


def clip():
    key = f"clip:{CLIP_MODEL}"
    with _lock:
        if key not in _cache:
            from transformers import CLIPModel, CLIPProcessor

            _tune_threads()
            proc = CLIPProcessor.from_pretrained(CLIP_MODEL)
            model = CLIPModel.from_pretrained(CLIP_MODEL).to(device()).eval()
            _cache[key] = (proc, model)
        return _cache[key]
