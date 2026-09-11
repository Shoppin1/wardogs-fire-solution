import { describe, it, expect } from 'vitest';
import { parseCoordString, parseGamePair, digitsToValue, outOfRange } from '../src/coords';

describe('ATM digit mask', () => {
  it('1678 -> 16.78', () => {
    expect(digitsToValue('1678')).toBe(16.78);
  });
  it('8000 -> 80.00', () => {
    expect(digitsToValue('8000')).toBe(80);
  });
  it('16383 -> 163.83', () => {
    expect(digitsToValue('16383')).toBe(163.83);
  });
  it('5 -> 0.05', () => {
    expect(digitsToValue('5')).toBe(0.05);
  });
  it('raw 6-digit buffer capped to first 5 digits', () => {
    expect(digitsToValue('163840')).toBe(163.84); // slice(0,5) = 16384
    expect(outOfRange(digitsToValue('163840'))).toBe(true);
  });
  it('16384 value is out of range', () => {
    expect(outOfRange(163.84)).toBe(true);
    expect(outOfRange(163.83)).toBe(false);
    expect(outOfRange(0)).toBe(false);
  });
});

describe('comma/dot parsing', () => {
  it('16,78 -> 16.78', () => {
    expect(parseCoordString('16,78').value).toBe(16.78);
  });
  it('16.78 -> 16.78', () => {
    expect(parseCoordString('16.78').value).toBe(16.78);
  });
  it('empty -> null', () => {
    expect(parseCoordString('').value).toBeNull();
  });
});

describe('game pair paste', () => {
  it('X80,00 Y70,00 -> {80, 70}', () => {
    expect(parseGamePair('X80,00 Y70,00')).toEqual({ x: 80, y: 70 });
  });
  it('no pair -> null', () => {
    expect(parseGamePair('nonsense')).toBeNull();
  });
});