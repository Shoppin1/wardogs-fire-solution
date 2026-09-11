#!/usr/bin/env python3
"""Build compact heightmap PNGs from downloaded WARDOGS terrain chunks.

Decodes upstream u16 chunks (wardogs-landscape-collision-u16-v1) exactly like
upstream terrain-ballistics.js does, then downsamples the full-map height field
to a 2048x2048 u8 PNG (8 m per pixel) plus a JSON with per-map min/max for
decoding back to meters at runtime.

Only Delta-Z between two points is meaningful (the absolute datum is offset);
the encoding here preserves relative heights per map.

Output: public/terrain/<map>.png + public/terrain/<map>.json
"""

import json
import os
import struct
import sys

MAPS = ["bakurani", "ozeti", "zestafona"]
HERE = os.path.dirname(__file__)
ROOT = os.path.normpath(os.path.join(HERE, ".."))
RAW = os.path.join(HERE, "raw")
OUT = os.path.join(ROOT, "public", "terrain")

# Target heightmap resolution (pixels per full 163.84-unit / 16384 m edge).
# 2048 px -> 8 m per pixel.
RES = 2048


def write_png(path: str, width: int, height: int, gray_bytes: bytes) -> None:
    """Minimal PNG writer (grayscale 8-bit, no deps)."""
    import zlib

    def chunk(tag: bytes, data: bytes) -> bytes:
        c = struct.pack(">I", len(data)) + tag + data
        c += struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        return c

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 0, 0, 0, 0)
    raw = b"".join(
        b"\x00" + gray_bytes[y * width:(y + 1) * width] for y in range(height)
    )
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", ihdr)
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


def sample_world_z(manifest: dict, chunks_cache: dict, game_x: float, game_y: float) -> float | None:
    """Decode world height at game coordinates, mirroring upstream logic.

    quadX = globalQuadOffsetX + gameX * gameUnitsToLandscapeQuadsX
    quadY = globalQuadOffsetY + gameY * gameUnitsToLandscapeQuadsY (-50, flipped)
    chunk = floor(quad / 510), local = quad % 510
    raw u16 at (localY*511 + localX), linear stretch per-chunk min/max,
    then worldZ = offset + localZ * scale.
    """
    cov = manifest["coverage"]
    if not (cov["gameXMin"] <= game_x <= cov["gameXMax"] and cov["gameYMin"] <= game_y <= cov["gameYMax"]):
        return None

    gq = manifest["gameUnitsToLandscapeQuads"]
    gqx = manifest.get("gameUnitsToLandscapeQuadsX", gq)
    gqy = manifest.get("gameUnitsToLandscapeQuadsY", -gq)
    quad_x = manifest["globalQuadOffsetX"] + game_x * gqx
    quad_y = manifest["globalQuadOffsetY"] + game_y * gqy

    chunk_x = int(quad_x // 510)
    chunk_y = int(quad_y // 510)
    local_x = quad_x - chunk_x * 510
    local_y = quad_y - chunk_y * 510

    if chunk_x < manifest["chunkXMin"] or chunk_x > manifest["chunkXMax"]:
        return None
    if chunk_y < manifest["chunkYMin"] or chunk_y > manifest["chunkYMax"]:
        return None

    key = f"{chunk_x},{chunk_y}"
    entry = manifest["chunks"].get(key)
    if entry is None:
        return None
    data = chunks_cache.get(key)
    if data is None:
        path = os.path.join(RAW, manifest["mapId"], entry["file"])
        with open(path, "rb") as f:
            data = f.read()
        if len(data) != entry["bytes"]:
            raise RuntimeError(f"chunk size mismatch {path}")
        chunks_cache[key] = data

    def raw_at(vx: int, vy: int) -> float:
        vx = max(0, min(510, vx))
        vy = max(0, min(510, vy))
        off = (vy * 511 + vx) * 2
        return struct.unpack_from("<H", data, off)[0]

    # Bilinear over the 4 surrounding vertices
    x0 = int(local_x)
    y0 = int(local_y)
    fx = local_x - x0
    fy = local_y - y0

    r00 = raw_at(x0, y0)
    r10 = raw_at(x0 + 1, y0)
    r01 = raw_at(x0, y0 + 1)
    r11 = raw_at(x0 + 1, y0 + 1)

    def decode(raw: float) -> float:
        lo = entry["minLocalZ"]
        hi = entry["maxLocalZ"]
        local_z = lo + (raw / 65535.0) * (hi - lo)
        return manifest["worldZOffsetMeters"] + local_z * manifest["worldZScaleMetersPerLocalUnit"]

    z00 = decode(r00)
    z10 = decode(r10)
    z01 = decode(r01)
    z11 = decode(r11)
    return z00 * (1 - fx) * (1 - fy) + z10 * fx * (1 - fy) + z01 * (1 - fx) * fy + z11 * fx * fy


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    for m in MAPS:
        with open(os.path.join(RAW, m, "manifest.json")) as f:
            manifest = json.load(f)
        print(f"[{m}] sampling {RES}x{RES} grid...", flush=True)

        chunks_cache: dict = {}
        heights = [0.0] * (RES * RES)
        got = 0
        for py in range(RES):
            game_y = 163.84 * (py + 0.5) / RES
            for px in range(RES):
                game_x = 163.84 * (px + 0.5) / RES
                z = sample_world_z(manifest, chunks_cache, game_x, game_y)
                if z is None:
                    heights[py * RES + px] = None  # type: ignore[assignment]
                else:
                    heights[py * RES + px] = z
                    got += 1
            if py % 256 == 0:
                print(f"  row {py}/{RES}", flush=True)

        valid = [h for h in heights if h is not None]
        if not valid:
            print(f"[{m}] NO DATA", flush=True)
            sys.exit(1)
        hmin = min(valid)
        hmax = max(valid)
        span = hmax - hmin
        if span <= 0:
            span = 1.0

        gray = bytearray(RES * RES)
        for i, h in enumerate(heights):
            if h is None:
                gray[i] = 0  # 0 = no data marker
            else:
                v = (h - hmin) / span
                # Map data into 1..255 so 0 stays the no-data marker
                gray[i] = max(1, min(255, int(round(1 + v * 254))))

        png_path = os.path.join(OUT, f"{m}.png")
        write_png(png_path, RES, RES, bytes(gray))
        meta = {
            "mapId": m,
            "res": RES,
            "metersPerPixel": 16384 / RES,
            "hMinMeters": hmin,
            "hMaxMeters": hmax,
            "noData": 0,
            "validPixels": got,
            "sourceCommit": "7965b3ee5b3b88a3936ffe13a3ce17e92899d793",
            "note": "Heights are offset-datum, only Delta-Z is meaningful. 0 = no data.",
            "encoding": "level = 1 + round((z - hMin) / (hMax - hMin) * 254), z = hMin + (level - 1) / 254 * (hMax - hMin)"
        }
        with open(os.path.join(OUT, f"{m}.json"), "w") as f:
            json.dump(meta, f, indent=2)
        size = os.path.getsize(png_path)
        print(f"[{m}] DONE: {png_path} ({size / 1e6:.2f} MB), range {hmin:.1f}..{hmax:.1f} m, {got}/{RES * RES} valid", flush=True)


if __name__ == "__main__":
    main()