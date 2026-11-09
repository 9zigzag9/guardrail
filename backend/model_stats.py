"""Figures for the website's Our data page, read live from the training outputs.

Nothing here is typed in by hand. Every value comes from files the training script
(prompt_injection_guardrail_hf.py) writes, so a new training run changes the page on the next request:

    outputs/model_comparison.csv   test-set results for every model
    outputs/explanation_demo.csv   example prompts and what the model returned
    outputs/dataset_summary.json   dataset size, sources and attack types
    outputs/test_scores.csv        every model's attack probability for each test prompt (curves, threshold explorer)
    outputs/kmeans_k_selection.csv inertia and silhouette for each number of attack clusters tried
    outputs/model_meta.json        which model and threshold the run chose (compared with the deployed one)
    dataset_clean.csv              the processed dataset (prompt lengths)
    outputs/run_complete.json      written last by the training script, when a run has finished
    outputs/evasion_*.json         the detection evasion measurements (demo_requests/evasion_attack.py)
    outputs/*.png                  a fixed list of training charts that are shown as images

Results are cached and rebuilt only when one of those files changes. While a new training run is still
writing its files (some are newer than run_complete.json), the page keeps showing the last complete
results, saved to a snapshot file so they also survive a server restart, and switches once the run ends.
"""
import json
import math
from pathlib import Path

import numpy as np
import pandas as pd

# Prompt length bins in characters. Each bin is twice as wide as the one before, because lengths range
# from a few characters to many thousands.
LENGTH_EDGES = [0, 25, 50, 100, 200, 400, 800, 1600, 3200, 6400]

# Full dataset names for the short names the training script stores.
SOURCE_NAMES = {
    "safe-guard-prompt-injection": "xTRam1/safe-guard-prompt-injection",
    "prompt-injection-dataset": "S-Labs/prompt-injection-dataset",
    "Prompt-injection-dataset": "neuralchemy/Prompt-injection-dataset",
    "prompt-injections": "deepset/prompt-injections",
}

MARKER = "run_complete.json"

# Training charts shown as images, in display order. Only these names can be requested, so the image
# endpoint can never be used to read any other file on the server.
FIGURES = {
    "eda_features_vs_label.png": ("Engineered features, safe against attack",
                                  "How each hand-made feature (length, entropy, leetspeak, attack phrases and so on) differs between safe prompts and attacks."),
    "eda_correlation.png": ("How the features relate to each other",
                            "Correlation between the engineered features. Strongly correlated features carry overlapping information."),
    "attack_clusters_2d.png": ("Attack prompts drawn in two dimensions",
                               "Each dot is an attack, coloured by its k-means and DBSCAN group. Heavy overlap means attacks do not split into neat types."),
}

# The evasion measurements: the version of the guardrail each file measured, in the order they were made.
EVASION_RUNS = {"before": "Before", "after_table": "Look-alike table only", "after": "Final defence"}
EVASION_ATTACKS = {"lookalikes": "Cyrillic and Greek look-alikes", "outside_table": "Look-alikes not in our table",
                   "symbols": "Symbols that look like letters"}
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


def _exact_threshold(p: np.ndarray, y: np.ndarray, row: dict) -> float:
    """The threshold that reproduces the published counts in model_comparison.csv.

    Older runs saved thresholds rounded to 3 decimals, which can move a prompt or two across the line.
    The real threshold lies within 0.0005 of the rounded one, so try the score boundaries in that range
    and keep the first that gives exactly the published false positives and false negatives."""
    t = float(row["threshold"])
    near = np.unique(p[(p >= t - 0.0005) & (p <= t + 0.0005)])
    for c in [t, *near]:
        blocked = p >= c
        if int((blocked & (y == 0)).sum()) == int(row["FP"]) and int((~blocked & (y == 1)).sum()) == int(row["FN"]):
            return float(c)
    return t


def _curves(outputs: Path, rows: dict, deployed_meta: dict) -> list[dict]:
    """How many test attacks and safe prompts every model would block at each threshold.

    From these counts the page draws the ROC and precision-recall curves and recalculates the confusion
    matrix live as the user moves the threshold slider. The grid holds every 0.01 step plus the model's
    own chosen threshold, so the default view matches model_comparison.csv exactly."""
    f = outputs / "test_scores.csv"
    if not f.exists():
        return []      # runs made before test_scores.csv existed: the page shows the fixed results instead
    scores = pd.read_csv(f)
    y = scores.pop("label").to_numpy()
    pos, neg = int(y.sum()), int(len(y) - y.sum())
    out = []
    for model in scores.columns:
        p = scores[model].to_numpy()
        if model == deployed_meta["model"]:
            chosen = float(deployed_meta["threshold"])     # the exact threshold the server blocks at
        elif model in rows:
            chosen = _exact_threshold(p, y, rows[model])
        else:
            chosen = 0.5
        grid = []
        for t in sorted(set(np.round(np.arange(0, 1.0001, 0.01), 2).tolist()) | {chosen}):
            blocked = p >= t
            grid.append({"t": t, "tp": int((blocked & (y == 1)).sum()), "fp": int((blocked & (y == 0)).sum())})
        out.append({"model": model, "chosen_threshold": chosen, "positives": pos, "negatives": neg,
                    "grid": grid})
    return out


def _lengths(data_dirs: list[Path]) -> list[dict] | None:
    """How many safe and attack prompts fall in each length bin, counted from the processed dataset."""
    folder = next((f for f in data_dirs if (f / "dataset_clean.csv").exists()), None)
    if folder is None:
        return None
    df = pd.read_csv(folder / "dataset_clean.csv", usecols=["text", "label"])
    lengths = df["text"].astype(str).str.len()
    edges = LENGTH_EDGES + [np.inf]
    out = []
    for lo, hi in zip(edges[:-1], edges[1:]):
        inside = (lengths >= lo) & (lengths < hi)
        out.append({"label": f"{lo:,}+" if hi == np.inf else f"{lo:,}-{hi - 1:,}",
                    "safe": int((inside & (df["label"] == 0)).sum()), "attack": int((inside & (df["label"] == 1)).sum())})
    return out


def _clusters(outputs: Path) -> dict | None:
    """The k-means scores for each number of attack clusters tried, and the k the training run chose."""
    f = outputs / "kmeans_k_selection.csv"
    if not f.exists():
        return None
    tbl = pd.read_csv(f)
    return {"rows": [{"k": int(r.k), "inertia": round(float(r.inertia), 1), "silhouette": round(float(r.silhouette), 4)}
                     for r in tbl.itertuples()],
            "best_k": int(tbl.loc[tbl["silhouette"].idxmax(), "k"])}


def _wilson(k: int, n: int, z: float = 1.96) -> tuple[float, float]:
    """95% confidence interval for a success rate of k out of n (Wilson score interval)."""
    if n == 0:
        return 0.0, 0.0
    p = k / n
    d = 1 + z * z / n
    c = p + z * z / (2 * n)
    r = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return (c - r) / d, (c + r) / d


def _evasion(outputs: Path) -> dict | None:
    """Detection evasion results for each measured version of the guardrail.

    For every adaptive attack, each file lists how many requests the attacker needed to get each blocked
    attack through (null if it never did within the budget). From that, `curve` gives the share that got
    through for every request budget from 1 to the maximum, which is what the page plots."""
    runs = {k: json.loads((outputs / f"evasion_{k}.json").read_text(encoding="utf-8"))
            for k in EVASION_RUNS if (outputs / f"evasion_{k}.json").exists()}
    if not runs:
        return None
    budget = next(iter(runs.values()))["budget"]
    attacks = []
    for name, title in EVASION_ATTACKS.items():
        measured = {k: r["adaptive"][name] for k, r in runs.items() if name in r.get("adaptive", {})}
        if not measured:
            continue
        curve = [{"requests": q, **{k: round(100 * sum(u is not None and u <= q for u in used) / len(used), 2)
                                   for k, used in measured.items()}}
                 for q in range(1, budget + 1)]
        final = {}
        for k, used in measured.items():
            got_through = sum(u is not None for u in used)
            lo, hi = _wilson(got_through, len(used))
            final[k] = {"got_through": got_through, "prompts": len(used), "rate": got_through / len(used), "low": lo, "high": hi}
        attacks.append({"name": name, "title": title, "curve": curve, "final": final})
    return {
        "budget": budget,
        "runs": [{"name": k, "title": EVASION_RUNS[k]} for k in runs],
        "attacks": attacks,
        "random_swaps": [{"share_swapped": float(rate),
                          **{k: sum(r["random_swaps"][rate]) / len(r["random_swaps"][rate]) for k, r in runs.items()}}
                         for rate in next(iter(runs.values()))["random_swaps"]],
        "cost": [{"run": k, "safe_blocked": r["safe_blocked"], "safe": r["safe"],
                  "median_ms": float(np.median(r["safe_ms"]))} for k, r in runs.items()],
    }


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


def _training_in_progress(outputs: Path, files: list[Path]) -> bool:
    """True when a training run has started writing new files but has not written its end marker yet."""
    marker = _mtime(outputs / MARKER)
    if marker is None:
        return False    # runs made before the marker existed are treated as finished
    # One second of slack: the marker is written last, but file times are not perfectly precise.
    return any(m is not None and m > marker + 1 for m in map(_mtime, files))


def _load_snapshot(snapshot: Path | None) -> dict | None:
    try:
        return json.loads(snapshot.read_text(encoding="utf-8")) if snapshot else None
    except (OSError, ValueError):
        return None     # no snapshot yet, or an unreadable one: build from the files instead


def _save_snapshot(snapshot: Path | None, value: dict) -> None:
    if snapshot is None:
        return
    try:
        snapshot.parent.mkdir(parents=True, exist_ok=True)
        snapshot.write_text(json.dumps(value), encoding="utf-8")
    except OSError:
        pass            # the snapshot only helps after a restart; the page works without it


def build(outputs: Path, data_dirs: list[Path], deployed_meta: dict, snapshot: Path | None = None) -> dict:
    """The page's figures. `snapshot` is where the last complete results are kept between restarts."""
    files = [outputs / n for n in ("model_comparison.csv", "explanation_demo.csv", "dataset_summary.json",
                                   "model_meta.json", "test_scores.csv", "kmeans_k_selection.csv")]
    files += [d / n for d in data_dirs for n in ("dataset_clean.csv", "test.csv")]

    # The evasion files are measured after training, so they never count as a training run in progress.
    measured = [outputs / f"evasion_{k}.json" for k in EVASION_RUNS] + [outputs / n for n in FIGURES]
    if _training_in_progress(outputs, files):
        previous = _cache["value"] or _load_snapshot(snapshot)
        if previous is not None:
            return {**previous, "training_in_progress": True}
        # Nothing complete to fall back on (first start during a run): show what is there, flagged.
        return {**_build_now(outputs, data_dirs, deployed_meta), "training_in_progress": True}

    key = tuple(_mtime(f) for f in files + measured + [outputs / MARKER])
    if _cache["key"] == key:
        return _cache["value"]
    value = {**_build_now(outputs, data_dirs, deployed_meta), "training_in_progress": False}
    _cache.update(key=key, value=value)
    _save_snapshot(snapshot, value)
    return value


def _build_now(outputs: Path, data_dirs: list[Path], deployed_meta: dict) -> dict:
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
        "curves": _curves(outputs, rows, deployed_meta),
        "lengths": _lengths(data_dirs),
        "clusters": _clusters(outputs),
        "evasion": _evasion(outputs),
        "figures": [{"name": n, "title": t, "text": d, "version": int(outputs.joinpath(n).stat().st_mtime)}
                    for n, (t, d) in FIGURES.items() if (outputs / n).exists()],
    }
    return _clean(value)
