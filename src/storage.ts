// localStorage persistence, namespaced and versioned.

const KEY = 'wardogs-fire-solution.v1';

export interface PersistedState {
  weaponId: string;
  gunLocked: boolean;
  gun: { x: number; y: number } | null;
  target: { x: number; y: number } | null;
  stepL81: number;
  stepSph2: number;
  history: { x: number; y: number }[]; // last targets, newest first, max 5
}

export const DEFAULT_STATE: PersistedState = {
  weaponId: 'mortar',
  gunLocked: false,
  gun: null,
  target: null,
  stepL81: 10,
  stepSph2: 25,
  history: []
};

export function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable, ignore.
  }
}