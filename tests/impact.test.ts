import { describe, it, expect } from 'vitest';
import { computeImpactCorrection } from '../src/impact';

describe('impact correction', () => {
  it('shot fell short: correction extends the aim point beyond target', () => {
    const gun = { x: 50, y: 50 };
    const target = { x: 50, y: 60 }; // 1000 m north
    const observed = { x: 50, y: 55 }; // fell 500 m short
    const c = computeImpactCorrection(gun, target, observed);
    // newTarget = target + (target - observed) = (50, 65)
    expect(c.newTarget.x).toBeCloseTo(50, 6);
    expect(c.newTarget.y).toBeCloseTo(65, 6);
    // shift from observed to newTarget = 1000 m, bearing north
    expect(c.shiftM).toBe(1000);
    expect(c.shiftBearing).toBe('000N');
    expect(c.observedDistanceM).toBe(500);
  });

  it('shot fell long: correction pulls aim point back', () => {
    const gun = { x: 50, y: 50 };
    const target = { x: 50, y: 60 };
    const observed = { x: 50, y: 65 }; // 500 m long
    const c = computeImpactCorrection(gun, target, observed);
    expect(c.newTarget.y).toBeCloseTo(55, 6);
    expect(c.shiftM).toBe(1000);
    expect(c.shiftBearing).toBe('180S');
  });

  it('lateral miss corrects sideways', () => {
    const gun = { x: 50, y: 50 };
    const target = { x: 60, y: 50 }; // 1000 m east
    const observed = { x: 60, y: 55 }; // 500 m north of target
    const c = computeImpactCorrection(gun, target, observed);
    expect(c.newTarget.x).toBeCloseTo(60, 6);
    expect(c.newTarget.y).toBeCloseTo(45, 6);
  });

  it('clamps corrected target into map bounds', () => {
    const gun = { x: 10, y: 10 };
    const target = { x: 160, y: 160 };
    const observed = { x: 20, y: 20 };
    const c = computeImpactCorrection(gun, target, observed);
    expect(c.newTarget.x).toBeLessThanOrEqual(163.83);
    expect(c.newTarget.y).toBeLessThanOrEqual(163.83);
  });
});