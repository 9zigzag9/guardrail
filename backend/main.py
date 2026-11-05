"""FastAPI back end for the prompt injection guardrail.

Run from the REPO ROOT (so prompt_injection_guardrail.py is importable):
    uvicorn backend.main:app --reload --port 8000

NOTE: this is the BASELINE version. The endpoint is deliberately a plain `async def`
that runs inference directly. Tag it in git before adding defences, so you can demo
the attacks working "before" and failing "after".
"""
import hashlib
import io
import json
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

import joblib
import pandas as pd
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from starlette.exceptions import HTTPException as StarletteHTTPException

# The saved pipeline uses classes from this module, so import it before joblib.load.
import prompt_injection_guardrail as pig

log = logging.getLogger("guardrail")
logging.basicConfig(level=logging.INFO)

# ---- Configuration (from environment variables, never hard-coded secrets) ----
ROOT = Path(__file__).resolve().parent.parent
MODEL_DIR = Path(os.getenv("MODEL_DIR", ROOT / "outputs"))
HASH_FILE = Path(os.getenv("HASH_FILE", ROOT / "backend" / "model_hashes.json"))
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
MAX_TEXT_CHARS = int(os.getenv("MAX_TEXT_CHARS", "10000"))
MAX_BODY_BYTES = int(os.getenv("MAX_BODY_BYTES", str(64 * 1024)))

state = {}  # holds the model, loaded once at startup


def load_verified(name: str, expected: dict):
    """Hash the file's bytes, refuse to load on mismatch, then load THOSE same bytes."""
    data = (MODEL_DIR / name).read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if digest != expected.get(name):
        raise RuntimeError(f"Hash mismatch for {name}; refusing to load it.")
    return joblib.load(io.BytesIO(data))


@asynccontextmanager
async def lifespan(app: FastAPI):
    expected = json.loads(HASH_FILE.read_text())
    meta = json.loads((MODEL_DIR / "model_meta.json").read_text())
    state["meta"] = meta
    state["threshold"] = meta["threshold"]
    state["model"] = load_verified("guardrail_model.joblib", expected)
    state["category_model"] = (
        load_verified("category_model.joblib", expected) if meta.get("has_category_model") else None
    )
    log.info("Model loaded and hash verified (%s).", meta["model"])
    yield
    state.clear()


app = FastAPI(title="Prompt Injection Guardrail API", lifespan=lifespan,
              docs_url=None, redoc_url=None, openapi_url=None)  # no public docs/debug surface

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],          # only our own front end
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


# ---- Schemas ----
class CheckRequest(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_TEXT_CHARS)


class CheckResponse(BaseModel):
    decision: str
    attack_probability: float
    threshold: float
    category: str | None
    category_confidence: float | None
    highlighted_text: str   # spans wrapped in [[ ]]; React must split on these, never render as HTML
    matched_rules: list[str]
    explanation: str


# ---- Consistent error format: {"error": {"code": ..., "message": ...}} ----
def err(status: int, code: str, message: str):
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message}})


@app.middleware("http")
async def limit_body_size(request: Request, call_next):
    cl = request.headers.get("content-length")
    if cl and cl.isdigit() and int(cl) > MAX_BODY_BYTES:
        return err(413, "payload_too_large", f"Request body must be under {MAX_BODY_BYTES} bytes.")
    return await call_next(request)


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    fields = sorted({".".join(str(p) for p in e["loc"][1:]) or "body" for e in exc.errors()})
    return err(422, "invalid_input", f"Invalid input in: {', '.join(fields)}. "
               f"Text must be 1 to {MAX_TEXT_CHARS} characters.")   # never echo the input back


@app.exception_handler(StarletteHTTPException)
async def http_handler(request: Request, exc: StarletteHTTPException):
    messages = {404: "Resource not found.", 405: "Method not allowed."}
    return err(exc.status_code, "http_error", messages.get(exc.status_code, "Request failed."))


@app.exception_handler(Exception)
async def unexpected_handler(request: Request, exc: Exception):
    log.exception("Unhandled error")          # details go to the server log only
    return err(500, "internal_error", "Something went wrong. Please try again.")


# ---- Endpoints ----
@app.get("/api/health")
async def health():
    return {"status": "ok", "model": state["meta"]["model"], "threshold": state["threshold"]}


@app.post("/api/check", response_model=CheckResponse)
async def check(req: CheckRequest):
    r = pig.explain(req.text, state["model"], state["threshold"], state["category_model"])
    return CheckResponse(
        decision=r["decision"], attack_probability=r["attack_probability"],
        threshold=state["threshold"], category=r["category"],
        category_confidence=r["category_confidence"], highlighted_text=r["highlighted_text"],
        matched_rules=r["matched_rules"], explanation=r["explanation"],
    )