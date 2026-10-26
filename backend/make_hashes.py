"""Run ONCE after the final model is trained:  python backend/make_hashes.py
Writes backend/model_hashes.json, which the server checks at startup."""
import hashlib, json
from pathlib import Path

out = Path(__file__).resolve().parent.parent / "outputs"
hashes = {n: hashlib.sha256((out / n).read_bytes()).hexdigest()
          for n in ("guardrail_model.joblib", "category_model.joblib")}
(Path(__file__).parent / "model_hashes.json").write_text(json.dumps(hashes, indent=2))
print(json.dumps(hashes, indent=2))