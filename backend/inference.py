"""Model inference that runs in separate worker processes (denial-of-service defence).

Why processes and not threads: the cleaning step is mostly Python regular expressions, which hold
the GIL, so a slow request in a thread would still stall every other request. A worker process
has its own interpreter, so the API keeps answering while a worker is busy.

Each worker receives the model bytes (already hash-checked by the parent) once, when it starts,
and keeps the loaded model for its whole life: the model is never reloaded per request.
"""
import io
import sys
from pathlib import Path

import joblib

# The library lives in ml/. The saved models refer to it by module name, so ml/ goes on the path.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "ml"))
import prompt_injection_guardrail as pig  # noqa: E402  (must be imported before joblib.load)

_model = None
_category_model = None


def init_worker(model_bytes: bytes, category_bytes: bytes | None):
    """Runs once in each worker process when it starts."""
    global _model, _category_model
    _model = joblib.load(io.BytesIO(model_bytes))
    _category_model = joblib.load(io.BytesIO(category_bytes)) if category_bytes else None


def explain(text: str, threshold: float) -> dict:
    """Runs in a worker for every request."""
    return pig.explain(text, _model, threshold, _category_model)


def ready() -> bool:
    """Used at startup to make every worker start and load the model before the first request."""
    return _model is not None
