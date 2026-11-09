"""Figures for the website's Our data page, read live from the training outputs.

Nothing here is typed in by hand. Every value comes from files the training script
(prompt_injection_guardrail_hf.py) writes, so a new training run changes the page on the next request:

    outputs/model_comparison.csv   test-set results for every model
    outputs/explanation_demo.csv   example prompts and what the model returned
    outputs/dataset_summary.json   dataset size, sources and attack types
    outputs/*.png                  the evaluation and EDA charts
    outputs/model_meta.json        which model and threshold the run chose (compared with the deployed one)

Results are cached and rebuilt only when one of those files changes.
"""
import json
import math
from pathlib import Path

import pandas as pd

# Charts the page may show, in display order. Only these names can be requested, so the
# image endpoint can never be used to read any other file on the server.
FIGURES = {
    "confusion_matrices.png": ("Confusion matrices",
                               "Test-set results for each model at its chosen threshold. Rows are the true label, columns the prediction."),
    "roc_pr_curves.png": ("ROC and precision-recall curves",
                          "How well each model separates attacks from safe prompts at every possible threshold."),
    "eda_balance_length.png": ("Class balance and prompt length",
                               "How many safe and attack prompts there are, and how long they are."),
    "kmeans_k_selection.png": ("Choosing the number of attack clusters",
                               "Inertia and silhouette for each number of clusters tried on the attack prompts."),
}

# Full dataset names for the short names the training script stores.
SOURCE_NAMES = {
    "safe-guard-prompt-injection": "xTRam1/safe-guard-prompt-injection",
    "prompt-injection-dataset": "S-Labs/prompt-injection-dataset",
    "Prompt-injection-dataset": "neuralchemy/Prompt-injection-dataset",
    "prompt-injections": "deepset/prompt-injections",
}

_cache = {"key": None, "value": None}


def _mtime(p: Path) -> float | None:
    return p.stat().st_mtime if p.exists() else None


def _clean(o):
    """Plain JSON types only: numpy numbers become Python numbers and empty CSV cells (NaN) become null."""
    if isinstance(o, dict):
        return {k: _clean(v) for k, v in o.items()}
    if isinstance(o, list):
        return [_clean(v) for v in o]
    if hasattr(o, "item"):
        o = o.item()
    return None if isinstance(o, float) and math.isnan(o) else o


def _dataset(outputs: Path, data_dirs: list[Path]) -> dict | None:
    summary = outputs / "dataset_summary.json"
    if summary.exists():
        d = json.loads(summary.read_text(encoding="utf-8"))
    else:
        # Older runs did not write the summary: count the processed CSVs instead (no attack types then).
        folder = next((f for f in data_dirs if (f / "dataset_clean.csv").exists()), None)
        if folder is None:
            return None
        full = pd.read_csv(folder / "dataset_clean.csv", usecols=["label", "source"])
        test = pd.read_csv(folder / "test.csv", usecols=["label"]) if (folder / "test.csv").exists() else None
        by_source = full.groupby("source")["label"].agg(["count", "sum"])
        d = {"rows": len(full), "attacks": int(full.label.sum()),
             "sources": [{"name": s, "total": int(r["count"]), "attacks": int(r["sum"])} for s, r in by_source.iterrows()],
             "attack_types": [],
             "test_rows": None if test is None else len(test),
             "test_attacks": None if test is None else int(test.label.sum())}
    d["safe"] = d["rows"] - d["attacks"]
    for s in d["sources"]:
        s["safe"] = s["total"] - s["attacks"]
        s["name"] = SOURCE_NAMES.get(s["name"], s["name"])
    d["sources"].sort(key=lambda s: -s["total"])
    return d


def _test_results(row: dict, ds: dict | None) -> dict:
    """The deployed model's test-set numbers, rebuilt from its row of model_comparison.csv."""
    fp, fn = int(row["FP"]), int(row["FN"])
    out = {"precision": row["precision"], "recall": row["recall"], "roc_auc": row["roc_auc"],
           "pr_auc": row["pr_auc"], "fp": fp, "fn": fn}
    p, r = row["precision"], row["recall"]
    out["f1"] = 2 * p * r / (p + r) if p + r else 0.0
    if ds and ds.get("test_rows") and ds.get("test_attacks") is not None:
        tp = ds["test_attacks"] - fn
        tn = ds["test_rows"] - ds["test_attacks"] - fp
        out.update(tp=tp, tn=tn, accuracy=(tp + tn) / ds["test_rows"])
    return out


def build(outputs: Path, data_dirs: list[Path], deployed_meta: dict) -> dict:
    files = [outputs / n for n in ("model_comparison.csv", "explanation_demo.csv", "dataset_summary.json",
                                   "model_meta.json", *FIGURES)]
    files += [d / n for d in data_dirs for n in ("dataset_clean.csv", "test.csv")]
    key = tuple(_mtime(f) for f in files)
    if _cache["key"] == key:
        return _cache["value"]

    comparison_file = outputs / "model_comparison.csv"
    if not comparison_file.exists():
        raise FileNotFoundError("outputs/model_comparison.csv is missing. Run the training script first.")
    cmp = pd.read_csv(comparison_file)
    ds = _dataset(outputs, data_dirs)

    deployed = deployed_meta["model"]
    rows = {r["model"]: r for r in cmp.to_dict("records")}
    trained_meta_file = outputs / "model_meta.json"
    trained_meta = json.loads(trained_meta_file.read_text()) if trained_meta_file.exists() else None
    # The page warns when the training outputs describe a different model from the one answering checks
    # (for example after retraining, before the new model has been copied into backend/model).
    in_sync = deployed in rows and abs(rows[deployed]["threshold"] - deployed_meta["threshold"]) < 0.0005
    if trained_meta is not None:
        in_sync = in_sync and trained_meta["model"] == deployed and \
            abs(trained_meta["threshold"] - deployed_meta["threshold"]) < 1e-9

    demo_file = outputs / "explanation_demo.csv"
    examples = []
    if demo_file.exists():
        for r in pd.read_csv(demo_file).to_dict("records"):
            examples.append({"scenario": r["scenario"], "text": r["text"], "decision": r["decision"],
                             "probability": float(r["attack_probability"]),
                             "category": None if pd.isna(r["category"]) else r["category"]})

    figures = [{"name": n, "title": t, "text": d, "version": int(outputs.joinpath(n).stat().st_mtime)}
               for n, (t, d) in FIGURES.items() if (outputs / n).exists()]

    value = {
        "model": deployed,
        "threshold": deployed_meta["threshold"],
        "trained_at": int(comparison_file.stat().st_mtime),
        "in_sync": in_sync,
        "dataset": ds,
        "test": _test_results(rows[deployed], ds) if deployed in rows else None,
        "comparison": [{"model": r["model"], "threshold": r["threshold"], "precision": r["precision"],
                        "recall": r["recall"], "roc_auc": r["roc_auc"], "pr_auc": r["pr_auc"],
                        "fp": int(r["FP"]), "fn": int(r["FN"])} for r in cmp.to_dict("records")],
        "examples": examples,
        "figures": figures,
    }
    value = _clean(value)
    _cache.update(key=key, value=value)
    return value
