"""Denial-of-service demo: attack our OWN local API and measure the effect.

Start the API first (uvicorn backend.main:app --port 8000), then:
    python demo_requests/dos_attack.py                # default http://127.0.0.1:8000
    python demo_requests/dos_attack.py http://127.0.0.1:8001

Run it against the tag `baseline-before-defences` (attack succeeds: the health check freezes and
nothing is refused) and against the current code (health stays fast, the excess gets 503).
Only use it on your own machine.
"""
import concurrent.futures as cf
import json
import sys
import time
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000"
# 10,000 characters of base64-looking text: before the fix, the e-mail pattern backtracked on it for about 1 s.
EXPENSIVE = ("QUFB" * 2500)[:10000]
NORMAL = "Translate the following business memo into Japanese."


def post(text):
    req = urllib.request.Request(BASE + "/api/check", data=json.dumps({"text": text}).encode(),
                                 headers={"Content-Type": "application/json"})
    start = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            code = r.status
    except urllib.error.HTTPError as e:
        code = e.code
    return code, time.perf_counter() - start


def health_ms():
    start = time.perf_counter()
    urllib.request.urlopen(BASE + "/api/health", timeout=120).read()
    return (time.perf_counter() - start) * 1000


print(f"Target: {BASE}")
print(f"1. Health check on an idle server:            {min(health_ms() for _ in range(5)):8.1f} ms")

with cf.ThreadPoolExecutor(12) as pool:
    attacks = [pool.submit(post, EXPENSIVE) for _ in range(8)]
    time.sleep(0.3)
    during = health_ms()
    results = [a.result() for a in attacks]
print(f"2. Health check while 8 expensive checks run: {during:8.1f} ms")
print(f"   slowest expensive check: {max(t for _, t in results):.2f} s")

start = time.perf_counter()
with cf.ThreadPoolExecutor(20) as pool:
    codes = list(pool.map(lambda _: post(NORMAL)[0], range(300)))
counts = {c: codes.count(c) for c in sorted(set(codes))}
print(f"3. 300 rapid requests from 20 clients in {time.perf_counter() - start:.1f} s, status codes: {counts}")
