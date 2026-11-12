"""Narrative generation with a local instruction-tuned LLM (Qwen2.5)."""
import re
import unicodedata

from engine import models
from engine.config import GENRES, NARRATIVE_ARC, SOUND_TAGS

GENRE_NAMES = {g["id"]: g["name"] for g in GENRES}

SYSTEM = (
    "Eres un autor profesional de cuentos ilustrados en español neutro. "
    "Usas español latinoamericano neutro, sin voseo ni regionalismos, y evitas modismos locales. "
    "Escribes prosa evocadora, clara y coherente, sin listas ni títulos dentro del texto. "
    "La idea explícita del usuario es el requisito principal: no la sustituyas por otra historia. "
    "Respetas exactamente el formato de etiquetas que se te pide."
)

MIN_WORDS = 55  # below this the scene is extended once
MIN_ACCEPTABLE = 35  # below this (after extension) the scene is regenerated once


def chat(cfg: dict, user: str, max_new_tokens: int, seed: int) -> tuple[str, int]:
    import torch

    tok, model = models.llm(cfg["text_model"], cfg.get("text_quant"))
    torch.manual_seed(seed)
    msgs = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}]
    prompt = tok.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True)
    inputs = tok([prompt], return_tensors="pt").to(model.device)
    temperature = cfg["temperature"]
    with torch.no_grad():
        out = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            do_sample=temperature > 0,
            temperature=max(temperature, 0.01),
            top_p=0.9,
            repetition_penalty=1.1,
            pad_token_id=tok.eos_token_id,
        )
    new = out[0][inputs.input_ids.shape[1]:]
    return tok.decode(new, skip_special_tokens=True).strip(), int(new.shape[0])


def _norm(s: str) -> str:
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().upper()


def parse_labels(raw: str, labels: list[str]) -> dict:
    """Tolerant 'LABEL: value' parser (handles markdown, accents, multi-line values)."""
    out: dict[str, str] = {}
    current = None
    for line in raw.replace("**", "").splitlines():
        m = re.match(r"^\s*[-#*]*\s*([A-Za-zÁÉÍÓÚáéíóúÑñ_ ]{3,20})\s*:\s*(.*)$", line)
        key = _norm(m.group(1)).replace(" ", "_") if m else None
        if key in labels:
            current = key
            out[current] = m.group(2).strip()
        elif current and line.strip():
            out[current] = (out[current] + " " + line.strip()).strip()
    return out


def clean_text(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip().strip('"«»')


def sanitize_scene(text: str, max_words: int = 140) -> str:
    """Guard against small-model degeneration: label spam, cut-off sentences, runaway length."""
    text = re.split(r"\b[A-ZÁÉÍÓÚÑÇ_]{4,}[A-ZÁÉÍÓÚÑÇ_ ]*:", text)[0]
    sentences = re.findall(r"[^.!?]+[.!?]+[»\"]?", text)
    out: list[str] = []
    for s in sentences:
        if len(" ".join(out + [s]).split()) > max_words:
            break
        out.append(s.strip())
    return clean_text(" ".join(out) if out else text)


def _capitalize(s: str) -> str:
    return s[:1].upper() + s[1:]


def plan_story(cfg: dict, idea: str, genre: str) -> tuple[dict, int]:
    user = (
        f"Idea del usuario: «{idea}»\nGénero: {GENRE_NAMES[genre]}\n\n"
        "Diseña la base de un cuento ilustrado de 5 escenas que desarrolle FIELMENTE la idea del usuario. "
        "La idea determina quién protagoniza y qué situación o conflicto mueve la historia; no la reemplaces "
        "por un personaje, objetivo o conflicto distinto. El género define el tono y la atmósfera, pero no cambia "
        "la premisa. Si la idea menciona varios personajes, conserva sus papeles y relación.\n"
        "Responde SOLO con estas 4 líneas:\n"
        "TITULO: un título original y breve en español\n"
        "PROTAGONISTA: personaje principal que corresponde a la idea, con nombre propio si tiene sentido, y descripción física breve en español\n"
        "PROTAGONISTA_EN: the same physical description in English, 12-20 words, only visual traits (age, hair, clothes, colors)\n"
        "ESCENARIO_EN: the main setting in English, 8-15 words"
    )
    raw, n = chat(cfg, user, 220, cfg["seed"])
    p = parse_labels(raw, ["TITULO", "PROTAGONISTA", "PROTAGONISTA_EN", "ESCENARIO_EN"])
    plan = {
        "title": clean_text(p.get("TITULO") or _capitalize(idea))[:120],
        "protagonist": clean_text(p.get("PROTAGONISTA") or "Una heroína sin nombre")[:200],
        "protagonist_en": clean_text(p.get("PROTAGONISTA_EN") or "a young hero with a cloak")[:200],
        "setting_en": clean_text(p.get("ESCENARIO_EN") or "a mysterious land")[:160],
        "raw": raw,
    }
    return plan, n


def _scene_prompt(cfg, idea, genre, plan, previous, i):
    tags = ", ".join(SOUND_TAGS.keys())
    context = ""
    if cfg["consistency"] and previous:
        context = "Escenas anteriores (mantén personajes, tono y hechos):\n" + "\n".join(
            f"{k + 1}. {t}" for k, t in enumerate(previous)
        ) + "\n\n"
    bible = f"Título: {plan['title']}\nProtagonista: {plan['protagonist']}\n" if cfg["consistency"] else ""
    return (
        f"PREMISA OBLIGATORIA DEL USUARIO (respétala en toda la historia): «{idea}»\n"
        f"Género: {GENRE_NAMES[genre]} (solo determina tono y atmósfera; no reemplaza la premisa)\n{bible}\n{context}"
        "Reglas de continuidad: desarrolla la premisa obligatoria, conserva los personajes y sus papeles, y haz que "
        "el conflicto siga conectado con ella. No cambies al protagonista, el objetivo ni la situación central por "
        "una aventura genérica o una historia diferente. Cada escena debe avanzar la misma historia; el arco narrativo "
        "indica cómo progresa, no autoriza a cambiar de tema.\n"
        f"Escribe la ESCENA {i + 1} de 5. {NARRATIVE_ARC[i]}\n"
        "Responde SOLO con estas 3 líneas:\n"
        "TEXTO: un párrafo de 4 a 6 oraciones completas (70 a 110 palabras) en español, tercera persona, con detalles sensoriales; "
        "deja claro cómo esta escena desarrolla la premisa del usuario\n"
        "IMAGEN_EN: in English, 12-25 words describing only what is visible in this scene (action, place, light), no names\n"
        f"SONIDO: una sola palabra de esta lista: {tags}"
    )


def _attempt(cfg, idea, genre, plan, previous, i, seed_shift: int) -> tuple[dict, int]:
    raw, n = chat(cfg, _scene_prompt(cfg, idea, genre, plan, previous, i), 360, cfg["seed"] + i + 1 + seed_shift)
    p = parse_labels(raw, ["TEXTO", "IMAGEN_EN", "SONIDO"])
    text = sanitize_scene(p.get("TEXTO") or re.sub(r"(IMAGEN_EN|SONIDO).*", "", raw, flags=re.S))
    if len(text.split()) < MIN_WORDS:  # small models often stop early: extend once
        ask = (f"Continúa fielmente la idea del usuario «{idea}» en este cuento de {GENRE_NAMES[genre]}. "
               f"Añade 2 o 3 oraciones nuevas que desarrollen la misma premisa y escena ({NARRATIVE_ARC[i]}), "
               "sin cambiar de protagonista ni de conflicto. Devuelve solo las oraciones nuevas, sin repetir el texto:\n\n"
               f"{text}")
        more, n2 = chat(cfg, ask, 150, cfg["seed"] + 50 + i + seed_shift)
        more = sanitize_scene(re.split(r"\n\s*\n|IMAGEN_EN|SONIDO", more)[0], 80)
        text, n = f"{text} {more}".strip(), n + n2
    sound = _norm(p.get("SONIDO", "")).lower().strip(" .")
    return {
        "text": text,
        "image_en": clean_text(p.get("IMAGEN_EN") or plan["setting_en"])[:220],
        "sound_tag": sound if sound in SOUND_TAGS else None,
        "raw": raw,
    }, n


def write_scene(cfg: dict, idea: str, genre: str, plan: dict, previous: list[str], i: int) -> tuple[dict, int]:
    scene, n = _attempt(cfg, idea, genre, plan, previous, i, 0)
    if len(scene["text"].split()) < MIN_ACCEPTABLE:  # still too short: one retry with another seed
        retry, n2 = _attempt(cfg, idea, genre, plan, previous, i, 997)
        n += n2
        if len(retry["text"].split()) > len(scene["text"].split()):
            scene = retry
    words = len(scene["text"].split())
    if words < MIN_ACCEPTABLE:
        raise RuntimeError(f"No se pudo generar la escena {i + 1}: {words} palabras (mínimo {MIN_ACCEPTABLE})")
    return scene, n
