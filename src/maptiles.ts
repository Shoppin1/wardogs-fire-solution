// Geometry of the upstream map tile pyramid. Kept free of Leaflet so the
// projection math stays testable in plain Node.

export const TILE_SIZE = 256;
export const MAX_TILE_ZOOM = 7; // upstream pyramid is zoom_0 .. zoom_7

// Depth actually bundled in public/tiles: 2048 px per map edge, 8 m/pixel,
// the same resolution as the terrain heightmaps. See scripts/download-tiles.py.
export const BUNDLED_MAX_ZOOM = 3;

// How far past the deepest available tile the map may still zoom, upscaling.
export const ZOOM_BEYOND_TILES = 2;

// World extent covered by the tile pyramid, identical for all three maps
// (maps/<id>.json -> tileBounds in apollyon-sys/wardogs-calculator).
export const TILE_BOUNDS = { minX: -0.03, maxX: 163.81, minY: -0.01, maxY: 163.83 };

// Pixels per game unit at zoom 0, i.e. the whole pyramid in a single tile.
export const SX = TILE_SIZE / (TILE_BOUNDS.maxX - TILE_BOUNDS.minX);
export const SY = TILE_SIZE / (TILE_BOUNDS.maxY - TILE_BOUNDS.minY);

// Upstream tile path layout: <base>/<map>/zoom_<z>/<x>_<y>.webp
export function tileUrlTemplate(base: string, mapId: string): string {
  return `${base}/${mapId}/zoom_{z}/{x}_{y}.webp`;
}

// Game coordinates to pyramid pixel coordinates at a given zoom. Game Y grows
// north, pixel Y grows down.
export function gameToPixel(x: number, y: number, zoom: number): { x: number; y: number } {
  const scale = Math.pow(2, zoom);
  return {
    x: (x - TILE_BOUNDS.minX) * SX * scale,
    y: (TILE_BOUNDS.maxY - y) * SY * scale
  };
}
