// Coordinate input mask and parser.
// ATM-style: digits only are masked live (comma 2 places from right).
// Pasted/typed comma or dot values accepted as-is. Game-format string
// "X80,00 Y70,00" pasted into one field fills the whole pair.

import { MAX_COORD } from './calc';

export interface FieldParse {
  value: number | null; // parsed coordinate value
  raw: string; // raw input
  outOfRange: boolean; // value parsed but > 163.83 or < 0
}

// Parse a pasted or typed string containing a comma/dot decimal number,
// or a game format pair "X80,00 Y70,00".
export function parseCoordString(text: string): FieldParse {
  const raw = String(text ?? '').trim();
  if (raw === '') return { value: null, raw, outOfRange: false };

  const num = raw.replace(',', '.');
  const v = Number(num);
  if (Number.isFinite(v)) {
    return { value: v, raw, outOfRange: v < 0 || v > MAX_COORD };
  }
  return { value: null, raw, outOfRange: false };
}

// Extract a pair from a game-format string like "X80,00 Y70,00".
// Returns null if not both X and Y found.
export function parseGamePair(text: string): { x: number; y: number } | null {
  const t = String(text ?? '');
  const num = '[+-]?\\d+(?:[\\.,]\\d+)?';
  const xMatch = t.match(new RegExp(`(?:^|[^a-zA-Z])x\\s*[:=]?\\s*(${num})`, 'i'));
  const yMatch = t.match(new RegExp(`(?:^|[^a-zA-Z])y\\s*[:=]?\\s*(${num})`, 'i'));
  const parse = (s: string) => Number(s.replace(',', '.'));
  if (xMatch && yMatch) {
    const x = parse(xMatch[1]);
    const y = parse(yMatch[1]);
    if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  }
  return null;
}

// ATM mask: given only the digit string (max 5 digits), return value = digits/100.
export function digitsToValue(digits: string): number | null {
  const d = digits.replace(/\D/g, '');
  if (d === '') return null;
  const capped = d.slice(0, 5);
  return Number(capped) / 100;
}

// Live mask for digit input: returns new digit buffer from keypress.
export function pushDigit(buffer: string, digit: string): string {
  if (buffer.length >= 5) return buffer;
  return buffer + digit;
}

export function popDigit(buffer: string): string {
  return buffer.slice(0, -1);
}

// Format a value in German game style: comma, 2 decimals ("163,83").
export function formatGame(v: number): string {
  return v.toFixed(2).replace('.', ',');
}

// Validate range.
export function outOfRange(v: number | null): boolean {
  return v !== null && (v < 0 || v > MAX_COORD);
}