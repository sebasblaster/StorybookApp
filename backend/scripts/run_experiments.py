"""Run the consistency experiments required by the project (>= 3 idea/genre combos, >= 2 strategies).

For every run it saves: the 5 illustrations, texts, audio, a contact sheet (5 scenes side by side),
metrics (times, tokens, CLIP similarity) and finally a CSV + Markdown comparison table.

    python scripts/run_experiments.py --profile equilibrado
    python scripts/run_experiments.py --profile calidad --strategies on off ip
    python scripts/run_experiments.py --profile ligero --combos 1          # quick smoke test

Strategies: off = no character bible / no context
            on  = bible + context                         ip = on + IP-Adapter reference (SDXL profiles)
All strategies use the same deterministic, distinct seed per scene for a given run seed.
Output: docs/evidencias/<timestamp>/
"""
import argparse
import csv
import json
import sys
import textwrap
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from PIL import Image, ImageDraw  # noqa: E402

from engine import pipeline  # noqa: E402
from engine.config import PROFILES, build_config, device  # noqa: E402

COMBOS = [
    ("una niña que colecciona sonidos del bosque", "fantasia"),
    ("un faro que recuerda a quien no volvió", "terror"),
    ("un osito que quiere aprender a volar con las luciérnagas", "infantil"),
    ("un robot jardinero en una estación espacial abandonada", "ciencia_ficcion"),
]
STRATEGIES = {
    "off": dict(consistency=False, ip_adapter=False),
    "on": dict(consistency=True, ip_adapter=False),
    "ip": dict(consistency=True, ip_adapter=True),
}


def slug(s: str) -> str:
    return "".join(c if c.isalnum() else "_" for c in s.lower())[:30].strip("_")


def contact_sheet(folder: Path, scenes: list[dict], title: str, label: str) -> None:
    size = 256
    sheet = Image.new("RGB", (size * 5, size + 70), (20, 24, 36))
    d = ImageDraw.Draw(sheet)
    d.text((8, 6), f"{title}  [{label}]", fill=(250, 230, 160))
    for i, sc in enumerate(scenes):
        name = sc["image"].rsplit("/", 1)[1]
        im = Image.open(folder / name).convert("RGB").resize((size, size))
        sheet.paste(im, (i * size, 24))
        d.text((i * size + 6, size + 28), f"Escena {i + 1}", fill=(250, 230, 160))
        d.text((i * size + 6, size + 42), sc["sound_tag"], fill=(160, 200, 255))
    sheet.save(folder / "contact_sheet.jpg", quality=92)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--profile", default=None, choices=list(PROFILES))
    ap.add_argument("--strategies", nargs="+", default=["off", "on"], choices=list(STRATEGIES))
    ap.add_argument("--combos", type=int, default=3, help="how many idea/genre combos to run (max 4)")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--steps", type=int, default=None)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    out_root = Path(args.out) if args.out else Path(__file__).resolve().parents[2] / "docs" / "evidencias" / time.strftime("%Y%m%d_%H%M%S")
    out_root.mkdir(parents=True, exist_ok=True)
    rows = []
    for idea, genre in COMBOS[: args.combos]:
        for strat in args.strategies:
            cfg = build_config(args.profile, args.seed, args.steps, 0.8, **STRATEGIES[strat])
            run_dir = out_root / f"{slug(idea)}__{strat}"
            print(f"\n=== {genre} · «{idea}» · estrategia={strat} · perfil={cfg['profile']} ({cfg['device']}) ===")
            state: dict = {}

            def emit(**f):
                state.update(f)
                if "stage" in f:
                    print("  ·", f["stage"])

            try:
                res = pipeline.generate(cfg, idea, genre, run_dir, "exp", emit)
            except Exception as exc:  # keep going: a failed run is itself evidence ("fallos detectados")
                print("  ✗ FALLÓ:", exc)
                rows.append({"idea": idea, "genre": genre, "strategy": strat, "profile": cfg["profile"], "error": str(exc)[:200]})
                continue
            m, scenes = res["metrics"], res["scenes"]
            (run_dir / "story.json").write_text(json.dumps({"idea": idea, "genre": genre, "config": cfg, **res}, ensure_ascii=False, indent=2))
            contact_sheet(run_dir, scenes, res["plan"]["title"], f"{strat} · {cfg['profile']}")
            rows.append({
                "idea": idea, "genre": genre, "strategy": strat, "profile": cfg["profile"], "device": cfg["device"],
                "seed": cfg["seed"], "steps": cfg["image_steps"], "title": res["plan"]["title"],
                "text_s": m["text_s"], "image_s": round(sum(m["image_s"]), 1), "tts_s": round(sum(m["tts_s"]), 1),
                "total_s": m["total_s"], "tokens": m["tokens"], "mentions": m["protagonist_mentions"],
                "words_avg": round(sum(m["scene_words"]) / 5, 1), "clip_mean": m.get("clip_mean"), "clip_min": m.get("clip_min"),
                "error": "",
            })

    if rows:
        cols: list[str] = []
        for r in rows:
            cols += [k for k in r if k not in cols]
        with open(out_root / "resultados.csv", "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=cols)
            w.writeheader()
            w.writerows(rows)
        lines = ["| Género | Estrategia | Perfil | Total (s) | Imagen (s) | Menciones | CLIP medio | CLIP mín |", "|---|---|---|---|---|---|---|---|"]
        for r in rows:
            lines.append(f"| {r['genre']} | {r['strategy']} | {r['profile']} | {r.get('total_s', '—')} | {r.get('image_s', '—')} | "
                         f"{r.get('mentions', '—')}/5 | {r.get('clip_mean', '—')} | {r.get('clip_min', '—')} |"
                         + (f" ⚠ {textwrap.shorten(r['error'], 60)}" if r.get("error") else ""))
        (out_root / "resultados.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
        print("\n" + "\n".join(lines))
    print(f"\nEvidencias guardadas en: {out_root}")
    print(f"Dispositivo: {device()} — copia las hojas de contacto (contact_sheet.jpg) al informe.")


if __name__ == "__main__":
    main()
