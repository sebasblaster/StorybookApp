"""Import this FIRST in every test: isolates data dir and disables the real worker."""
import os
import sys
import tempfile
from pathlib import Path

os.environ.setdefault("STORYBOOK_DATA_DIR", tempfile.mkdtemp(prefix="storybook_test_"))
os.environ["STORYBOOK_DISABLE_WORKER"] = "1"
os.environ.setdefault("STORYBOOK_DEVICE", "cpu")
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
