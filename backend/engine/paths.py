"""Filesystem locations (overridable with STORYBOOK_DATA_DIR)."""
import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.environ.get("STORYBOOK_DATA_DIR", BACKEND_DIR / "data")).resolve()
MEDIA_ROOT = DATA_DIR / "media"
DB_PATH = DATA_DIR / "storybook.db"

DATA_DIR.mkdir(parents=True, exist_ok=True)
MEDIA_ROOT.mkdir(parents=True, exist_ok=True)
