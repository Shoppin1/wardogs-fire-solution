// Impact correction (bracketing / Einschießen).
// The player observes where the shot actually landed and enters that
// coordinate. The correction vector from observed impact to the intended
// target is added to the gun's aim solution: new aim point = target shifted
// by (target - impact). This is the classic artillery bracketing method.

import type { Pos } from './calc';
import { computeSolution } from './calc';
import { formatGame } from './coords';

export interface ImpactCorrection {
  newTarget: Pos; // corrected aim point
  shiftM: number; // correction magnitude in meters
  shiftBearing: string; // direction of correction
  observedDistanceM: number; // distance gun -> observed impact
}

export function computeImpactCorrection(gun: Pos, target: Pos, observed: Pos): ImpactCorrection {
  // Correction: aim where the shot must land additionally.
  // newTarget = target + (target - observed)
  const newTarget: Pos = {
    x: Math.min(163.83, Math.max(0, target.x + (target.x - observed.x))),
    y: Math.min(163.83, Math.max(0, target.y + (target.y - observed.y)))
  };
  const shiftSol = computeSolution(observed, newTarget);
  const observedSol = computeSolution(gun, observed);
  void shiftSol;
  return {
    newTarget,
    shiftM: shiftSol.distanceM,
    shiftBearing: shiftSol.bearingStr,
    observedDistanceM: observedSol.distanceM
  };
}

export function impactCorrectionText(c: ImpactCorrection): string {
  return `Korrektur: ${c.shiftM} m Richtung ${c.shiftBearing}. Neues Ziel: X${formatGame(c.newTarget.x)} Y${formatGame(c.newTarget.y)} (Einschlag war ${c.observedDistanceM} m weit).`;
}