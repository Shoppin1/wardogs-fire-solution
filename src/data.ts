// Firing tables access. Tables live in /data/firing-tables.json
// (source of truth, user-editable, see data/data.schema.md).

import tablesJson from '../data/firing-tables.json';
import type { ArcTable } from './calc';

export interface WeaponData {
  id: string;
  name: string;
  minRangeM: number;
  maxRangeM: number;
  minElevationMil: number;
  maxElevationMil: number;
  arcs: ArcTable[];
}

interface TablesFile {
  source: { repo: string; commit: string; license: string; copyright: string };
  weapons: WeaponData[];
}

export const TABLES = tablesJson as unknown as TablesFile;

export const SOURCE_COMMIT = TABLES.source.commit;
export const SOURCE_REPO = TABLES.source.repo;

export const WEAPONS: WeaponData[] = TABLES.weapons;

export function getWeapon(id: string): WeaponData {
  const w = WEAPONS.find((w) => w.id === id);
  if (!w) throw new Error(`Unknown weapon: ${id}`);
  return w;
}