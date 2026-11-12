"""Illustrated PDF export with ReportLab."""
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import Image, PageBreak, Paragraph, SimpleDocTemplate, Spacer

from engine.config import GENRES
from engine.paths import MEDIA_ROOT

GOLD = HexColor("#8a6a12")
INK = HexColor("#2c221e")
TITLE = ParagraphStyle("t", fontName="Times-Bold", fontSize=28, leading=34, alignment=TA_CENTER, textColor=INK)
SUB = ParagraphStyle("s", fontName="Times-Italic", fontSize=13, leading=18, alignment=TA_CENTER, textColor=GOLD)
BODY = ParagraphStyle("b", fontName="Times-Roman", fontSize=13.5, leading=20, alignment=TA_JUSTIFY, textColor=INK)
SMALL = ParagraphStyle("m", fontName="Helvetica", fontSize=8, leading=11, alignment=TA_CENTER, textColor=GOLD)


def _img(url, size: float):
    if not url or "/api/media/" not in url:
        return Spacer(1, size)
    path = MEDIA_ROOT / Path(url.split("/api/media/", 1)[1])
    return Image(str(path), width=size, height=size) if path.exists() else Spacer(1, size)


def _bg(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(HexColor("#fdf8ee"))
    canvas.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
    canvas.setStrokeColor(GOLD)
    canvas.setLineWidth(0.6)
    canvas.rect(1.2 * cm, 1.2 * cm, A4[0] - 2.4 * cm, A4[1] - 2.4 * cm)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(GOLD)
    canvas.drawCentredString(A4[0] / 2, 0.7 * cm, f"Storybook · página {doc.page}")
    canvas.restoreState()


def build_pdf(story: dict) -> bytes:
    genre = next((g["name"] for g in GENRES if g["id"] == story["genre"]), story["genre"])
    cfg = story.get("config") or {}
    models_line = " · ".join(m.split("/")[-1] for m in (cfg.get("text_model"), cfg.get("image_model"), cfg.get("tts_model")) if m)
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=2.4 * cm, rightMargin=2.4 * cm,
                            topMargin=2.2 * cm, bottomMargin=2.2 * cm, title=story["title"])
    flow = [Spacer(1, 1.5 * cm), Paragraph(escape(story["title"]), TITLE), Spacer(1, 0.4 * cm),
            Paragraph(f"Un cuento de {escape(genre.lower())} · idea original: «{escape(story['idea'])}»", SUB),
            Spacer(1, 1 * cm), _img(story.get("cover"), 12 * cm), Spacer(1, 1 * cm),
            Paragraph(f"Generado localmente con modelos abiertos ({escape(models_line)}). Contenido creado por IA.", SMALL),
            PageBreak()]
    for sc in story["scenes"]:
        flow += [Paragraph(f"Escena {sc['index']} de {len(story['scenes'])}", SUB), Spacer(1, 0.4 * cm),
                 _img(sc.get("image"), 13 * cm), Spacer(1, 0.7 * cm), Paragraph(escape(sc["text"]), BODY), PageBreak()]
    doc.build(flow[:-1], onFirstPage=_bg, onLaterPages=_bg)
    return buf.getvalue()
