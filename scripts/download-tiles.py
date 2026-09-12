#!/usr/bin/env python3
"""Download WARDOGS map tiles from the upstream CDN into public/tiles/.

Pyramid layout: <map>/zoom_<z>/<x>_<y>.webp with 2^z tiles per side.
Default depth is zoom 0..3 (2048 px per map edge, 8 m/pixel), which matches the
resolution of the bundled terrain heightmaps and keeps the repo small. Pass a
different depth with --max-zoom; the full pyramid goes to zoom 7 and is far too
large to bundle.

Map imagery is a WARDOGS game asset and NOT MIT licensed, see NOTICE.
"""

import argparse
import os
import sys
import time
import urllib.request

BASE = "https://assets.wardogs-artillery.com/releases/assets-v1/maps/tiles"
MAPS = ["bakurani", "ozeti", "zestafona"]
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "tiles")


def fetch(url: str, retries: int = 4) -> bytes:
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "wardogs-fire-solution-tile-build"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except Exception as e:
            if attempt == retries - 1:
                raise
            print(f"  retry {attempt + 1} after error: {e}", flush=True)
            time.sleep(2 * (attempt + 1))
    raise RuntimeError("unreachable")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-zoom", type=int, default=3)
    args = ap.parse_args()
    if not 0 <= args.max_zoom <= 7:
        sys.exit("--max-zoom must be between 0 and 7")

    total_bytes = 0
    for m in MAPS:
        for z in range(args.max_zoom + 1):
            zdir = os.path.join(OUT, m, f"zoom_{z}")
            os.makedirs(zdir, exist_ok=True)
            n = 2 ** z
            for x in range(n):
                for y in range(n):
                    dest = os.path.join(zdir, f"{x}_{y}.webp")
                    if os.path.exists(dest) and os.path.getsize(dest) > 0:
                        total_bytes += os.path.getsize(dest)
                        continue
                    data = fetch(f"{BASE}/{m}/zoom_{z}/{x}_{y}.webp")
                    with open(dest, "wb") as f:
                        f.write(data)
                    total_bytes += len(data)
                    time.sleep(0.05)  # be gentle with a hobby project's CDN
            print(f"[{m}] zoom_{z}: {n * n} tiles", flush=True)
    print(f"done, {total_bytes / 1024 / 1024:.1f} MiB in {OUT}")


if __name__ == "__main__":
    main()
