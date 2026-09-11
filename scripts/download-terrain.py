#!/usr/bin/env python3
"""Download WARDOGS terrain chunks from the upstream CDN (MIT data).

Downloads manifests + all chunks for bakurani/ozeti/zestafona into
data-terrain/<map>/. Run once; ~381 MiB total.
"""

import json
import os
import sys
import time
import urllib.request

BASE = "https://assets.wardogs-artillery.com/releases/assets-v1/data/terrain"
MAPS = ["bakurani", "ozeti", "zestafona"]
OUT = os.path.join(os.path.dirname(__file__), "raw")


def fetch(url: str, retries: int = 4) -> bytes:
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "wardogs-fire-solution-terrain-build"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except Exception as e:
            if attempt == retries - 1:
                raise
            print(f"  retry {attempt + 1} after error: {e}", flush=True)
            time.sleep(2 * (attempt + 1))
    raise RuntimeError("unreachable")


def main() -> None:
    for m in MAPS:
        mdir = os.path.join(OUT, m)
        cdir = os.path.join(mdir, "chunks")
        os.makedirs(cdir, exist_ok=True)
        manifest_path = os.path.join(mdir, "manifest.json")
        if os.path.exists(manifest_path):
            with open(manifest_path) as f:
                manifest = json.load(f)
        else:
            print(f"[{m}] downloading manifest...", flush=True)
            data = fetch(f"{BASE}/{m}/manifest.json")
            with open(manifest_path, "wb") as f:
                f.write(data)
            manifest = json.loads(data)

        chunks = manifest["chunks"]
        total = len(chunks)
        done = 0
        skipped = 0
        for key, entry in sorted(chunks.items()):
            dest = os.path.join(cdir, os.path.basename(entry["file"]))
            if os.path.exists(dest) and os.path.getsize(dest) == entry["bytes"]:
                skipped += 1
                done += 1
                continue
            data = fetch(f"{BASE}/{m}/{entry['file']}")
            if len(data) != entry["bytes"]:
                print(f"[{m}] SIZE MISMATCH {entry['file']}: {len(data)} != {entry['bytes']}", flush=True)
                sys.exit(1)
            with open(dest, "wb") as f:
                f.write(data)
            done += 1
            if done % 32 == 0:
                print(f"[{m}] {done}/{total} chunks", flush=True)
        print(f"[{m}] DONE: {total} chunks ({skipped} already present)", flush=True)


if __name__ == "__main__":
    main()