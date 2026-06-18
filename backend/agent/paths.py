from __future__ import annotations

import os
from pathlib import Path


def warden_data_dir() -> Path:
    base = os.environ.get("LOCALAPPDATA") or os.environ.get("TEMP") or str(Path.home())
    p = Path(base) / "warden"
    p.mkdir(parents=True, exist_ok=True)
    return p
