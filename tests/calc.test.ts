import { describe, it, expect } from 'vitest';
import { computeSolution, interpolateMils, shiftTarget, arcBounds, type ArcTable } from '../src/calc';

describe('calculation', () => {
  it('(80,00|70,00) to (83,00|74,00): 500 m, 037NE', () => {
    const s = computeSolution({ x: 80, y: 70 }, { x: 83, y: 74 });
    expect(s.distanceM).toBe(500);
    expect(s.bearingStr).toBe('037NE');
  });

  it('field reference: (83,68|73,31) to (80,31|69,29): 525 m, 220SW', () => {
    const s = computeSolution({ x: 83.68, y: 73.31 }, { x: 80.31, y: 69.29 });
    expect(s.distanceM).toBe(525);
    expect(s.bearingStr).toBe('220SW');
  });

  it('(50|50) to (50|60): 1000 m, 000N', () => {
    const s = computeSolution({ x: 50, y: 50 }, { x: 50, y: 60 });
    expect(s.distanceM).toBe(1000);
    expect(s.bearingStr).toBe('000N');
  });

  it('(50|50) to (60|50): 090E', () => {
    const s = computeSolution({ x: 50, y: 50 }, { x: 60, y: 50 });
    expect(s.bearingStr).toBe('090E');
  });

  it('(50|50) to (50|40): 180S', () => {
    const s = computeSolution({ x: 50, y: 50 }, { x: 50, y: 40 });
    expect(s.bearingStr).toBe('180S');
  });

  it('cardinal mapping', () => {
    // Direct checks of the mapping rule via known solutions
    // 123 -> SE: bearing 123 from gun
    const mk = (deg: number) => {
      // place target so that atan2(dx,dy) = deg
      const r = 1;
      const rad = (deg * Math.PI) / 180;
      const dx = Math.sin(rad) * r;
      const dy = Math.cos(rad) * r;
      return computeSolution({ x: 50, y: 50 }, { x: 50 + dx, y: 50 + dy });
    };
    expect(mk(123).cardinal).toBe('SE');
    expect(mk(123).bearingInt).toBe(123);
    expect(mk(322).cardinal).toBe('NW');
    expect(mk(322).bearingInt).toBe(322);
    expect(mk(202).cardinal).toBe('S');
    expect(mk(203).cardinal).toBe('SW');
    expect(mk(337).cardinal).toBe('NW');
    expect(mk(338).cardinal).toBe('N');
  });

  it('bearing 359.6 displays as 000N', () => {
    const rad = (359.6 * Math.PI) / 180;
    const s = computeSolution(
      { x: 50, y: 50 },
      { x: 50 + Math.sin(rad), y: 50 + Math.cos(rad) }
    );
    expect(s.bearingStr).toBe('000N');
  });
});

describe('interpolation', () => {
  const table: ArcTable = {
    id: 't',
    label: 'Test',
    points: [
      [100, 900],
      [200, 800],
      [300, 700]
    ]
  };

  it('exact table point returns that value', () => {
    const r = interpolateMils(table, 200);
    expect(r.mils).toBe(800);
    expect(r.status).toBe('ok');
  });

  it('midpoint returns the mean', () => {
    const r = interpolateMils(table, 250);
    expect(r.mils).toBe(750);
  });

  it('out of bounds low returns status, no number', () => {
    const r = interpolateMils(table, 50);
    expect(r.mils).toBeNull();
    expect(r.status).toBe('too-close');
  });

  it('out of bounds high returns status, no number', () => {
    const r = interpolateMils(table, 350);
    expect(r.mils).toBeNull();
    expect(r.status).toBe('too-far');
  });

  it('bounds computed from table', () => {
    const b = arcBounds(table);
    expect(b.minM).toBe(100);
    expect(b.maxM).toBe(300);
  });

  it('handles descending-mils tables (source order)', () => {
    const desc: ArcTable = {
      id: 'd',
      label: 'Desc',
      points: [
        [300, 700],
        [200, 800],
        [100, 900]
      ]
    };
    const r = interpolateMils(desc, 200);
    expect(r.mils).toBe(800);
    const mid = interpolateMils(desc, 250);
    expect(mid.mils).toBe(750);
  });

  it('SPH-2 at 1000 m: high arc only (from real tables)', async () => {
    const { getWeapon } = await import('../src/data');
    const sph = getWeapon('sph2');
    const results = sph.arcs.map((a) => interpolateMils(a, 1000));
    const ok = results.filter((r) => r.status === 'ok');
    expect(ok.length).toBe(1);
    expect(ok[0].arcId).toBe('high');
  });

  it('SPH-2 at 2000 m: both arcs valid', async () => {
    const { getWeapon } = await import('../src/data');
    const sph = getWeapon('sph2');
    const results = sph.arcs.map((a) => interpolateMils(a, 2000));
    const ok = results.filter((r) => r.status === 'ok');
    expect(ok.length).toBe(2);
  });

  it('L81 at 525 m (field reference distance) yields mils within table', async () => {
    const { getWeapon } = await import('../src/data');
    const mortar = getWeapon('mortar');
    const r = interpolateMils(mortar.arcs[0], 525);
    expect(r.status).toBe('ok');
    expect(r.mils).not.toBeNull();
    // Real table: 524 m -> 430 mil, 531 m -> 420 mil -> 525 interpolates ~429
    expect(r.mils).toBe(429);
  });
});

describe('shiftTarget', () => {
  it('shifts along gun-target line', () => {
    const shifted = shiftTarget({ x: 50, y: 50 }, { x: 50, y: 60 }, 10);
    expect(shifted.y).toBeCloseTo(60.1, 6);
    expect(shifted.x).toBeCloseTo(50, 6);
  });

  it('negative shift moves closer', () => {
    const shifted = shiftTarget({ x: 50, y: 50 }, { x: 50, y: 60 }, -10);
    expect(shifted.y).toBeCloseTo(59.9, 6);
  });
});