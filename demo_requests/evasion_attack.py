"""Detection evasion: attack our OWN local guardrail API with look-alike characters, and measure it.

The attacker's goal (threat model, attacker 1): get a prompt injection ALLOWED by swapping letters for characters
that look the same to a person but not to the model, e.g. Cyrillic 'р' for Latin 'p'.

Run the same measurement against the version before the defence and the current one, then compare:
    git worktree add ../guardrail-before before-evasion-defence          (once)
    cd ../guardrail-before && python -m uvicorn backend.main:app --port 8001   (terminal A)
    python -m uvicorn backend.main:app --port 8000                        (terminal B, this folder)
    python demo_requests/evasion_attack.py http://127.0.0.1:8001 --label before
    python demo_requests/evasion_attack.py http://127.0.0.1:8000 --label after
    python demo_requests/evasion_attack.py --compare
Results go to outputs/evasion_<label>.json; --compare prints the table and saves outputs/evasion_before_after.png
(it also includes outputs/evasion_after_table.json, the intermediate run with only the look-alike table, if present).

What is measured (every request goes through POST /api/check, exactly as an outside attacker would send it):
  1. Random swaps: every blocked test-set attack, with 30%, 60% or 100% of swappable letters replaced, 3 seeds each.
  2. Adaptive attack: the attacker reads the returned attack probability and keeps a swap only if it lowers it,
     5 candidate swaps per round, up to 100 requests per prompt, on a fixed sample of blocked attacks.
  3. Two obvious variations of the adaptive attack: look-alikes OUTSIDE the defence's table (Lisu and Coptic
     letters) and symbol look-alikes (EUR sign for e, | for l, ! for i, + for t).
  4. Cost: false positive rate on every safe test prompt, and response times.
Only use it on your own machine.
"""
import argparse
import concurrent.futures as cf
import http.client
import json
import math
import random
import statistics
import sys
import threading
import time
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "outputs"

# The attacker's look-alikes. Mostly Cyrillic and Greek, the scripts real homoglyph attacks use most.
ATTACK_TABLE = {
    "a": "аα", "c": "с", "d": "ԁ", "e": "е", "h": "һ", "i": "іι", "j": "ј", "l": "ӏ", "o": "оο", "p": "рρ",
    "q": "ԛ", "s": "ѕ", "w": "ԝ", "x": "хχ", "y": "у", "v": "ν",
    "A": "АΑ", "B": "ВΒ", "C": "С", "E": "ЕΕ", "H": "НΗ", "I": "ІΙ", "K": "КΚ", "M": "МΜ", "O": "ОΟ",
    "P": "РΡ", "S": "Ѕ", "T": "ТΤ", "X": "ХΧ", "Y": "УΥ",
}
# Variation A: look-alikes the defence does NOT list (Lisu capitals and Coptic small letters).
OUTSIDE_TABLE = {
    "o": "ⲟ", "p": "ⲣ", "c": "ⲥ", "a": "ⲁ", "e": "ⲉ", "i": "ⲓ", "s": "ꜱ",
    "A": "ꓮ", "B": "ꓐ", "C": "ꓚ", "D": "ꓓ", "E": "ꓰ", "G": "ꓖ", "H": "ꓧ", "I": "ꓲ", "K": "ꓗ", "L": "ꓡ",
    "M": "ꓟ", "N": "ꓠ", "O": "ꓳ", "P": "ꓑ", "R": "ꓣ", "S": "ꓢ", "T": "ꓔ", "U": "ꓴ", "V": "ꓦ", "W": "ꓪ",
    "X": "ꓫ", "Y": "ꓬ", "Z": "ꓜ",
}
# Variation B: ASCII and currency symbols that look like letters.
SYMBOL_TABLE = {"e": "€", "l": "|", "i": "!", "t": "+", "s": "§", "a": "∂", "o": "ø", "c": "¢"}


def load_test():
    import csv
    csv.field_size_limit(10**7)
    with open(ROOT / "data" / "test.csv", encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    return [r["text"] for r in rows if r["label"] == "1"], [r["text"] for r in rows if r["label"] == "0"]


class Api:
    """One kept-alive connection per thread, like a real client. (A new connection per request runs
    Windows out of local ports after about 10,000 requests.)"""

    def __init__(self, base):
        self.base = base.rstrip("/")
        u = urllib.parse.urlparse(self.base)
        self.host, self.port = u.hostname, u.port or 80
        self.local = threading.local()
        self.requests = 0

    def _conn(self, fresh=False):
        if fresh or not hasattr(self.local, "conn"):
            if hasattr(self.local, "conn"):
                self.local.conn.close()
            self.local.conn = http.client.HTTPConnection(self.host, self.port, timeout=60)
        return self.local.conn

    def check(self, text):
        """Returns (attack_probability, blocked, seconds). Retries politely if the server says it is busy."""
        body = json.dumps({"text": text}).encode()
        for attempt in range(50):
            start = time.perf_counter()
            try:
                conn = self._conn()
                conn.request("POST", "/api/check", body, {"Content-Type": "application/json"})
                r = conn.getresponse()
                data = r.read()
            except (OSError, http.client.HTTPException):
                self._conn(fresh=True)                 # connection dropped: reconnect and try again
                time.sleep(0.05)
                continue
            seconds = time.perf_counter() - start
            if r.status == 503:                        # the denial-of-service defence: wait and retry
                time.sleep(0.05 * (attempt + 1))
                continue
            if r.status == 422:                        # e.g. the swapped text became too long: not usable
                return None, None, 0.0
            if r.status != 200:
                raise RuntimeError(f"HTTP {r.status}: {data[:200]!r}")
            self.requests += 1
            d = json.loads(data)
            return d["attack_probability"], d["blocked"], seconds
        raise RuntimeError("server stayed busy")

    def many(self, texts, workers=8):
        with cf.ThreadPoolExecutor(workers) as pool:
            return list(pool.map(self.check, texts))


def swap_random(text, table, rate, rng):
    return "".join(rng.choice(table[c]) if c in table and rng.random() < rate else c for c in text)


def adaptive(api, text, table, budget, rng):
    """Greedy black-box attack. Returns the number of requests it needed, or None if it failed within budget."""
    cur = text
    best, blocked, _ = api.check(cur)
    used = 1
    while blocked and used < budget:
        pos = [i for i, c in enumerate(cur) if c in table]
        if not pos:
            return None
        cands = []
        for i in rng.sample(pos, min(5, len(pos), budget - used)):
            cands.append(cur[:i] + rng.choice(table[cur[i]]) + cur[i + 1:])
        results = [api.check(c) for c in cands]
        used += len(cands)
        scored = [(p, b, c) for (p, b, _), c in zip(results, cands) if p is not None]
        if not scored:
            continue
        p, b, c = min(scored)
        if p < best:
            best, blocked, cur = p, b, c
    return used if not blocked else None


def wilson(k, n, z=1.96):
    if n == 0:
        return (0.0, 0.0)
    p = k / n
    d = 1 + z * z / n
    c = p + z * z / (2 * n)
    r = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return ((c - r) / d, (c + r) / d)


def measure(base, label, sample, budget, seeds):
    api = Api(base)
    attacks, safe = load_test()
    t0 = time.perf_counter()
    print(f"Target {base} ({label})")

    plain = api.many(attacks)
    blocked = [t for t, (p, b, _) in zip(attacks, plain) if b]
    print(f"Plain attacks blocked: {len(blocked)} of {len(attacks)}")

    random_swaps = {}
    for rate in (0.3, 0.6, 1.0):
        rates = []
        for seed in range(seeds):
            rng = random.Random(seed)
            res = api.many([swap_random(t, ATTACK_TABLE, rate, rng) for t in blocked])
            usable = [b for p, b, _ in res if p is not None]
            rates.append(sum(not b for b in usable) / len(usable))
        random_swaps[str(rate)] = rates
        print(f"Random swaps at {rate:.0%}: evasion {statistics.mean(rates):.3%} (seeds: {', '.join(f'{r:.3%}' for r in rates)})")

    pick = random.Random(42).sample(blocked, min(sample, len(blocked)))
    adaptive_runs = {}
    for name, table, n in (("lookalikes", ATTACK_TABLE, len(pick)), ("outside_table", OUTSIDE_TABLE, len(pick) // 3),
                           ("symbols", SYMBOL_TABLE, len(pick) // 3)):
        targets = pick[:n]
        with cf.ThreadPoolExecutor(8) as pool:
            used = list(pool.map(lambda a: adaptive(api, a[1], table, budget, random.Random(a[0])), enumerate(targets)))
        adaptive_runs[name] = used
        ok = [u for u in used if u is not None]
        lo, hi = wilson(len(ok), len(used))
        print(f"Adaptive ({name}, {len(used)} prompts, up to {budget} requests): evasion {len(ok) / len(used):.1%} "
              f"(95% CI {lo:.1%} to {hi:.1%}), median requests when it worked: {statistics.median(ok) if ok else '-'}")

    safe_res = api.many(safe)
    fp = sum(b for _, b, _ in safe_res)
    times = sorted(s * 1000 for _, _, s in safe_res)
    print(f"Cost: {fp} of {len(safe)} safe prompts blocked ({fp / len(safe):.2%}); "
          f"response time median {statistics.median(times):.1f} ms, 95th percentile {times[int(len(times) * .95)]:.1f} ms")

    result = {"label": label, "base": base, "attacks": len(attacks), "blocked_plain": len(blocked),
              "random_swaps": random_swaps, "adaptive": adaptive_runs, "budget": budget,
              "safe": len(safe), "safe_blocked": fp, "safe_ms": times, "requests": api.requests,
              "minutes": (time.perf_counter() - t0) / 60}
    OUT.mkdir(exist_ok=True)
    (OUT / f"evasion_{label}.json").write_text(json.dumps(result))
    print(f"{api.requests:,} requests in {result['minutes']:.1f} min. Saved outputs/evasion_{label}.json")


def compare():
    """Table and chart for every measured version: before, after_table (look-alike table only) and after."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    labels = [x for x in ("before", "after_table", "after") if (OUT / f"evasion_{x}.json").exists()]
    runs = {x: json.loads((OUT / f"evasion_{x}.json").read_text()) for x in labels}
    titles = {"before": "Before", "after_table": "Table only", "after": "Final defence"}
    first = runs[labels[0]]
    budget = first["budget"]

    def row(name, cells):
        print(f"{name:52}" + "".join(f"{c:>18}" for c in cells))
    row("Measure", [titles[x] for x in labels])
    for rate in first["random_swaps"]:
        row(f"Random swaps, {float(rate):.0%} of letters (3 seeds)",
            [f"{statistics.mean(r['random_swaps'][rate]):.2%} ±{statistics.pstdev(r['random_swaps'][rate]):.2%}" for r in runs.values()])
    for name in first["adaptive"]:
        cells = []
        for r in runs.values():
            used = r["adaptive"][name]
            k, n = sum(u is not None for u in used), len(used)
            lo, hi = wilson(k, n)
            cells.append(f"{k / n:.1%} [{lo:.0%}-{hi:.0%}]")
        row(f"Adaptive, {name}, <={budget} requests", cells)
    row("Safe test prompts blocked (cost)", [f"{r['safe_blocked']}/{r['safe']}" for r in runs.values()])
    row("Median response time, safe prompts (cost)", [f"{statistics.median(r['safe_ms']):.1f} ms" for r in runs.values()])

    fig, axes = plt.subplots(1, 2, figsize=(13, 4.8))
    budgets = list(range(1, budget + 1))
    colours = {"before": "#c23a32", "after_table": "#e0a030", "after": "#0b7f74"}
    styles = {"lookalikes": "-", "outside_table": "--", "symbols": ":"}
    names = {"lookalikes": "Cyrillic/Greek look-alikes", "outside_table": "look-alikes outside the table",
             "symbols": "symbol look-alikes"}
    for label, r in runs.items():
        for name, used in r["adaptive"].items():
            curve = [sum(u is not None and u <= q for u in used) / len(used) * 100 for q in budgets]
            axes[0].plot(budgets, curve, styles[name], color=colours[label], label=f"{titles[label]}: {names[name]}")
    axes[0].set(title="Adaptive attack: blocked attacks that get through",
                xlabel="Requests the attacker sends per prompt", ylabel="Evasion success (%)", ylim=(0, 100))
    axes[0].legend(fontsize=7)
    rates = list(first["random_swaps"])
    width = 0.8 / len(runs)
    for j, (label, r) in enumerate(runs.items()):
        axes[1].bar([i - 0.4 + width * (j + 0.5) for i in range(len(rates))],
                    [statistics.mean(r["random_swaps"][x]) * 100 for x in rates], width, color=colours[label], label=titles[label])
    axes[1].set(title="Random look-alike swaps (not adaptive)", xticks=list(range(len(rates))),
                xticklabels=[f"{float(x):.0%} of letters" for x in rates], ylabel="Evasion success (%)")
    axes[1].legend()
    fig.tight_layout()
    fig.savefig(OUT / "evasion_before_after.png", dpi=150)
    print("Saved outputs/evasion_before_after.png")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("base", nargs="?", default="http://127.0.0.1:8000")
    ap.add_argument("--label", default="after")
    ap.add_argument("--sample", type=int, default=300, help="blocked attacks used for the adaptive attack")
    ap.add_argument("--budget", type=int, default=100, help="requests the adaptive attacker may send per prompt")
    ap.add_argument("--seeds", type=int, default=3)
    ap.add_argument("--compare", action="store_true")
    args = ap.parse_args()
    if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
        sys.stdout.reconfigure(encoding="utf-8")
    compare() if args.compare else measure(args.base, args.label, args.sample, args.budget, args.seeds)
