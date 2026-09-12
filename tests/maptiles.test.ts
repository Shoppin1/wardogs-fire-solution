import { describe, it, expect } from 'vitest';
import {
  TILE_SIZE,
  MAX_TILE_ZOOM,
  TILE_BOUNDS,
  gameToPixel,
  tileUrlTemplate
} from '../src/maptiles';

describe('map tile geometry', () => {
  it('puts the pyramid extent in exactly one tile at zoom 0', () => {
    const tl = gameToPixel(TILE_BOUNDS.minX, TILE_BOUNDS.maxY, 0);
    const br = gameToPixel(TILE_BOUNDS.maxX, TILE_BOUNDS.minY, 0);
    expect(tl.x).toBeCloseTo(0, 6);
    expect(tl.y).toBeCloseTo(0, 6);
    expect(br.x).toBeCloseTo(TILE_SIZE, 6);
    expect(br.y).toBeCloseTo(TILE_SIZE, 6);
  });

  it('covers 2^z tiles per side at every pyramid zoom', () => {
    for (let z = 0; z <= MAX_TILE_ZOOM; z++) {
      const br = gameToPixel(TILE_BOUNDS.maxX, TILE_BOUNDS.minY, z);
      expect(br.x / TILE_SIZE).toBeCloseTo(Math.pow(2, z), 6);
      expect(br.y / TILE_SIZE).toBeCloseTo(Math.pow(2, z), 6);
    }
  });

  it('keeps game Y pointing north (higher Y is further up)', () => {
    const south = gameToPixel(80, 20, 3);
    const north = gameToPixel(80, 140, 3);
    expect(north.y).toBeLessThan(south.y);
    expect(north.x).toBeCloseTo(south.x, 6);
  });

  it('builds the upstream tile path layout', () => {
    expect(tileUrlTemplate('https://cdn.example/tiles', 'bakurani')).toBe(
      'https://cdn.example/tiles/bakurani/zoom_{z}/{x}_{y}.webp'
    );
  });
});
