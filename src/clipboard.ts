// Copy helpers: shareable game-format strings and clipboard with fallback.

import { formatGame } from './coords';
import type { Pos } from './calc';

export function posToShareString(p: Pos): string {
  return `x${formatGame(p.x)}, y${formatGame(p.y)}`;
}

export function resultToShareString(bearing: string, distanceM: number, mils: number | string): string {
  return `${bearing}, ${distanceM} m, ${mils} mil`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy path
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    window.prompt('Kopieren:', text);
    return false;
  }
}