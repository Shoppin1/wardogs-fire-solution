// Core calculation: bearing, distance, cardinal, mils interpolation.
// Pure functions only, no DOM access.

export interface Pos {
  x: number; // game units, 0.00 to 163.83
  y: number;
}

export interface Solution {
  distanceM: number; // rounded to whole meters (matches in-game RNG readout)
  bearingInt: number; // 0..359
  bearingStr: string; // e.g. "123SE", "000N"
  cardinal: string;
}

export const MAX_COORD = 163.83;
export const UNITS_PER_METER = 0.01; // 1 unit = 100 m

const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

export function isValidCoord(v: number): boolean {
  return Number.isFinite(v) && v >= 0 && v <= MAX_COORD;
}

export function computeSolution(gun: Pos, target: Pos): Solution {
  const dx = target.x - gun.x;
  const dy = target.y - gun.y;
  const distanceM = Math.hypot(dx, dy) * 100;
  const bearingDeg = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
  let bearingInt = Math.round(bearingDeg);
  if (bearingInt === 360) bearingInt = 0;
  const cardinal = CARDINALS[Math.floor(((bearingInt + 22.5) % 360) / 45)];
  const zeroPad3 = String(bearingInt).padStart(3, '0');
  return {
    distanceM: Math.round(distanceM),
    bearingInt,
    bearingStr: zeroPad3 + cardinal,
    cardinal
  };
}

export interface ArcResult {
  arcId: string;
  label: string;
  mils: number | null; // null when out of table bounds
  rngForMils: number | null; // table distance matching the rounded mil, if derivable
  status: 'ok' | 'too-close' | 'too-far' | null; // null = ok
  minM: number;
  maxM: number;
}

export interface ArcTable {
  id: string;
  label: string;
  points: [number, number][]; // [distance_m, mils]
}

// Table points sorted so that mils increase (mortar single + spg low come
// distance-ascending with falling mils; we normalize internally).
function sortedByMils(points: [number, number][]): [number, number][] {
  const copy = [...points];
  if (copy.length > 1 && copy[0][1] > copy[copy.length - 1][1]) {
    copy.reverse(); // now mils ascending
  }
  return copy;
}

export function arcBounds(arc: ArcTable): { minM: number; maxM: number } {
  let minM = Infinity;
  let maxM = -Infinity;
  for (const [d] of arc.points) {
    if (d < minM) minM = d;
    if (d > maxM) maxM = d;
  }
  return { minM, maxM };
}

// Linear interpolation of mils for a distance, then round to whole mils.
// Never extrapolates. Points may be in either order; we build mil->distance
// monotone segments where possible.
export function interpolateMils(arc: ArcTable, distanceM: number): ArcResult {
  const pts = sortedByMils(arc.points);
  const { minM, maxM } = arcBounds(arc);

  if (distanceM < minM) {
    return { arcId: arc.id, label: arc.label, mils: null, rngForMils: null, status: 'too-close', minM, maxM };
  }
  if (distanceM > maxM) {
    return { arcId: arc.id, label: arc.label, mils: null, rngForMils: null, status: 'too-far', minM, maxM };
  }

  // Find surrounding points by distance. spg high has duplicate distances
  // (2629 repeated with different mils): pick segment with exact distance match
  // falling back to nearest bracketing pair.
  const byDist = [...arc.points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  let mils: number | null = null;
  for (let i = 0; i < byDist.length - 1; i++) {
    const [d0, m0] = byDist[i];
    const [d1, m1] = byDist[i + 1];
    if (distanceM >= d0 && distanceM <= d1) {
      if (d1 === d0) {
        mils = distanceM === d0 ? m0 : m0; // degenerate segment, take lower mil
      } else {
        const t = (distanceM - d0) / (d1 - d0);
        mils = m0 + t * (m1 - m0);
      }
      break;
    }
  }
  if (mils === null) {
    // exact last point or single point
    const last = byDist[byDist.length - 1];
    if (distanceM === last[0]) mils = last[1];
  }
  if (mils === null) {
    // Should not happen within bounds; fall back to closest point.
    let best = byDist[0];
    let bestDiff = Math.abs(byDist[0][0] - distanceM);
    for (const p of byDist) {
      const diff = Math.abs(p[0] - distanceM);
      if (diff < bestDiff) {
        best = p;
        bestDiff = diff;
      }
    }
    mils = best[1];
  }

  const rounded = Math.round(mils);

  // RNG that corresponds to the rounded mil: invert interpolation using the
  // mil-ascending list, only when mil->distance is monotone within segment.
  let rngForMils: number | null = null;
  for (let i = 0; i < pts.length - 1; i++) {
    const [d0, m0] = pts[i];
    const [d1, m1] = pts[i + 1];
    if (m1 === m0) continue;
    if (rounded >= Math.min(m0, m1) && rounded <= Math.max(m0, m1)) {
      const t = (rounded - m0) / (m1 - m0);
      const d = d0 + t * (d1 - d0);
      rngForMils = Math.round(d);
      break;
    }
  }
  if (rngForMils === null) {
    // Exact mil match on a point?
    const exact = pts.find(([, m]) => m === rounded);
    if (exact) rngForMils = exact[0];
  }

  return { arcId: arc.id, label: arc.label, mils: rounded, rngForMils, status: 'ok', minM, maxM };
}

// Shift target along gun->target line by deltaM meters (positive = farther).
export function shiftTarget(gun: Pos, target: Pos, deltaM: number): Pos {
  const dx = target.x - gun.x;
  const dy = target.y - gun.y;
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return target;
  const deltaUnits = deltaM * UNITS_PER_METER;
  return {
    x: target.x + (dx / dist) * deltaUnits,
    y: target.y + (dy / dist) * deltaUnits
  };
}