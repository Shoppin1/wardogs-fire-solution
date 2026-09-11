// Delta-Z terrain module.
// Heightmaps are self-hosted compact PNGs (8 m/pixel) built from the upstream
// MIT terrain data (wardogs-landscape-collision-u16-v1). Absolute heights use
// an offset datum, so ONLY the difference (Delta-Z) is displayed, never
// absolute elevation.

export interface TerrainMeta {
  mapId: string;
  res: number;
  metersPerPixel: number;
  hMinMeters: number;
  hMaxMeters: number;
  noData: number;
  validPixels: number;
  encoding: string;
}

const TERRAIN_DIR = import.meta.env.BASE_URL + 'terrain/';
const cache = new Map<string, { meta: TerrainMeta; data: Uint8ClampedArray }>();

export async function loadTerrain(mapId: string): Promise<boolean> {
  if (cache.has(mapId)) return true;
  try {
    const metaRes = await fetch(TERRAIN_DIR + mapId + '.json');
    if (!metaRes.ok) return false;
    const meta = (await metaRes.json()) as TerrainMeta;

    const pngRes = await fetch(TERRAIN_DIR + mapId + '.png');
    if (!pngRes.ok) return false;
    const blob = await pngRes.blob();

    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = meta.res;
    canvas.height = meta.res;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;
    ctx.drawImage(bitmap, 0, 0);
    const img = ctx.getImageData(0, 0, meta.res, meta.res);
    bitmap.close();

    cache.set(mapId, { meta, data: img.data });
    return true;
  } catch {
    return false;
  }
}

export function terrainAvailable(mapId: string): boolean {
  return cache.has(mapId);
}

// Sample height (offset-datum meters) at game coordinates. Returns null when
// outside coverage or in a no-data pixel.
export function sampleHeight(mapId: string, x: number, y: number): number | null {
  const t = cache.get(mapId);
  if (!t) return null;
  const { meta, data } = t;
  const px = Math.floor((x / 163.84) * meta.res);
  const py = Math.floor((y / 163.84) * meta.res);
  if (px < 0 || px >= meta.res || py < 0 || py >= meta.res) return null;
  const level = data[(py * meta.res + px) * 4]; // red channel, grayscale PNG
  if (level === meta.noData) return null;
  const hMin = meta.hMinMeters;
  const hMax = meta.hMaxMeters;
  return hMin + ((level - 1) / 254) * (hMax - hMin);
}

// Delta-Z target minus gun in meters. Null when either sample is missing.
export function deltaZ(mapId: string, gunX: number, gunY: number, targetX: number, targetY: number): number | null {
  const zGun = sampleHeight(mapId, gunX, gunY);
  const zTarget = sampleHeight(mapId, targetX, targetY);
  if (zGun === null || zTarget === null) return null;
  return zTarget - zGun;
}