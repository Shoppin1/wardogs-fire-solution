// Main app logic. UI German, code English.
// Coordinate input is primary; map view is optional and lazy-loaded.

import { computeSolution, interpolateMils, shiftTarget, isValidCoord, type Pos } from './calc';
import { digitsToValue, popDigit, pushDigit, formatGame, parseCoordString, parseGamePair, outOfRange } from './coords';
import { getWeapon, WEAPONS, SOURCE_COMMIT, SOURCE_REPO } from './data';
import { loadState, saveState, DEFAULT_STATE, type PersistedState } from './storage';

// Field model: each coordinate input keeps a digit buffer for the ATM mask.
interface CoordField {
  el: HTMLInputElement;
  buffer: string; // digits only, max 5
  value: number | null; // parsed value (from buffer or paste)
}

const state: PersistedState = loadState();

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element: ${id}`);
  return el;
}

function makeField(id: string): CoordField {
  const el = $(id) as HTMLInputElement;
  const field: CoordField = { el, buffer: '', value: null };
  el.value = '';
  return field;
}

const gunX = makeField('gunX');
const gunY = makeField('gunY');
const targetX = makeField('targetX');
const targetY = makeField('targetY');
const fields = [gunX, gunY, targetX, targetY];
const pairOrder = [gunX, gunY, targetX, targetY]; // Enter moves along this order

const els = {
  weaponBtns: Array.from(document.querySelectorAll<HTMLButtonElement>('.weapon-btn')),
  lockGun: $('lockGun') as HTMLButtonElement,
  newTarget: $('newTarget') as HTMLButtonElement,
  rangeMsg: $('rangeMsg'),
  corrections: $('corrections'),
  corrShort: $('corrShort') as HTMLButtonElement,
  corrFar: $('corrFar') as HTMLButtonElement,
  corrStepShort: $('corrStepShort'),
  corrStepFar: $('corrStepFar'),
  stepInput: $('stepInput') as HTMLInputElement,
  history: $('history'),
  historyChips: $('historyChips'),
  resultBearing: $('resultBearing'),
  resultDistance: $('resultDistance'),
  resultDistanceSub: $('resultDistanceSub'),
  resultMils: $('resultMils'),
  resultMilsSub: $('resultMilsSub'),
  milsCell: $('milsCell'),
  arcExtra: $('arcExtra'),
  statusMsg: $('statusMsg'),
  mapToggle: $('mapToggle') as HTMLButtonElement,
  mapHost: $('mapHost'),
  mapSelect: $('mapSelect') as HTMLSelectElement,
  mapCursor: $('mapCursor'),
  mapView: $('mapView'),
  dataCredit: $('dataCredit')
};

// ---------- Field display ----------

function setFieldValue(f: CoordField, v: number | null, viaMask: boolean): void {
  f.value = v;
  if (viaMask && v !== null) {
    // Rebuild digit buffer from value so backspace keeps working.
    f.buffer = String(Math.round(v * 100)).padStart(1, '');
  }
  f.el.value = v === null ? '' : formatGame(v);
}

function showFieldError(f: CoordField, bad: boolean): void {
  f.el.classList.toggle('is-error', bad);
}

// ---------- Input handling ----------

function handleInput(f: CoordField): void {
  const raw = f.el.value;
  // Game pair paste detection (only on first field of a pair)
  if (f === gunX || f === targetX) {
    const pair = parseGamePair(raw);
    if (pair) {
      const yField = f === gunX ? gunY : targetY;
      setFieldValue(f, isValidCoord(pair.x) ? pair.x : pair.x, true);
      setFieldValue(yField, pair.y, true);
      update();
      return;
    }
  }
  // Comma or dot value typed/pasted directly
  if (raw.includes(',') || raw.includes('.')) {
    const p = parseCoordString(raw);
    if (p.value !== null) {
      setFieldValue(f, p.value, true);
      showFieldError(f, outOfRange(p.value));
      update();
      return;
    }
  }
  // ATM mask: digits only
  const digits = raw.replace(/\D/g, '');
  if (digits === '') {
    f.buffer = '';
    f.value = null;
    f.el.value = '';
  } else {
    f.buffer = digits.slice(0, 5);
    const v = digitsToValue(f.buffer);
    f.value = v;
    f.el.value = formatGame(v!);
    showFieldError(f, outOfRange(v!));
  }
  update();
}

function handleKeydown(f: CoordField, e: KeyboardEvent): void {
  if (e.key === 'Backspace') {
    e.preventDefault();
    f.buffer = popDigit(f.buffer);
    const v = f.buffer === '' ? null : digitsToValue(f.buffer);
    f.value = v;
    f.el.value = v === null ? '' : formatGame(v);
    showFieldError(f, v !== null && outOfRange(v));
    update();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const idx = pairOrder.indexOf(f);
    if (idx >= 0 && idx < pairOrder.length - 1) {
      pairOrder[idx + 1].el.focus();
    } else {
      f.el.blur();
    }
  } else if (/^[0-9]$/.test(e.key)) {
    e.preventDefault();
    f.buffer = pushDigit(f.buffer, e.key);
    const v = digitsToValue(f.buffer);
    f.value = v;
    f.el.value = formatGame(v!);
    showFieldError(f, outOfRange(v!));
    update();
  }
}

// ---------- Result ----------

function currentWeaponId(): string {
  return state.weaponId;
}

function currentGun(): Pos | null {
  return gunX.value !== null && gunY.value !== null ? { x: gunX.value, y: gunY.value } : null;
}

function currentTarget(): Pos | null {
  return targetX.value !== null && targetY.value !== null ? { x: targetX.value, y: targetY.value } : null;
}

function fmtInt(n: number): string {
  return new Intl.NumberFormat('de-DE').format(n);
}

function update(): void {
  const anyError = fields.some((f) => f.value !== null && outOfRange(f.value));
  if (anyError) {
    els.rangeMsg.textContent = 'Außerhalb der Karte (max 163,83)';
    els.rangeMsg.hidden = false;
    clearResult();
    return;
  }
  els.rangeMsg.hidden = true;

  const gun = currentGun();
  const target = currentTarget();
  if (!gun || !target) {
    clearResult();
    return;
  }

  const sol = computeSolution(gun, target);
  els.resultBearing.textContent = sol.bearingStr;
  els.resultDistance.textContent = fmtInt(sol.distanceM);
  els.resultDistance.textContent += ' m';

  const weapon = getWeapon(currentWeaponId());
  const results = weapon.arcs.map((a) => interpolateMils(a, sol.distanceM));
  const okArcs = results.filter((r) => r.status === 'ok');

  if (okArcs.length === 0) {
    const tooClose = results.filter((r) => r.status === 'too-close');
    const tooFar = results.filter((r) => r.status === 'too-far');
    els.resultMils.textContent = '--';
    els.resultMils.classList.add('is-warn');
    els.resultMilsSub.textContent = '';
    if (tooClose.length > 0) {
      // Closest reachable bound across arcs (e.g. SPH-2 high arc reaches closer than low)
      const minAll = Math.min(...tooClose.map((r) => r.minM));
      els.statusMsg.textContent = `Zu nah (min ${fmtInt(minAll)} m)`;
    } else {
      const maxAll = Math.max(...tooFar.map((r) => r.maxM));
      els.statusMsg.textContent = `Zu weit (max ${fmtInt(maxAll)} m)`;
    }
    els.statusMsg.hidden = false;
    els.arcExtra.hidden = true;
    els.corrections.hidden = false;
  } else if (okArcs.length === 1) {
    const r = okArcs[0];
    els.resultMils.textContent = String(r.mils);
    els.resultMils.classList.remove('is-warn');
    els.resultMilsSub.textContent = r.rngForMils !== null ? `RNG ${fmtInt(r.rngForMils)} m` : r.label;
    els.statusMsg.hidden = true;
    els.arcExtra.innerHTML = '';
    els.arcExtra.hidden = true;
    els.corrections.hidden = false;
  } else {
    // Multiple arcs (SPH-2): show first big, others as cards.
    const [first, ...rest] = okArcs;
    els.resultMils.textContent = String(first.mils);
    els.resultMils.classList.remove('is-warn');
    els.resultMilsSub.textContent = `${first.label}, RNG ${fmtInt(first.rngForMils ?? sol.distanceM)} m`;
    els.arcExtra.innerHTML = rest
      .map(
        (r) => `<div class="arc-card">
          <div class="arc-label">${r.label}</div>
          <div class="arc-mils">${r.mils}</div>
          <div class="arc-rng">RNG ${fmtInt(r.rngForMils ?? sol.distanceM)} m</div>
        </div>`
      )
      .join('');
    els.arcExtra.hidden = rest.length === 0;
    els.statusMsg.hidden = true;
    els.corrections.hidden = false;
  }

  persist();
  renderHistory();
  if (mapApi) mapApi.setPositions(currentGun(), currentTarget());
}

function clearResult(): void {
  els.resultBearing.textContent = '--';
  els.resultDistance.textContent = '--';
  els.resultDistanceSub.textContent = '';
  els.resultMils.textContent = '--';
  els.resultMilsSub.textContent = '';
  els.resultMils.classList.remove('is-warn');
  els.statusMsg.hidden = true;
  els.arcExtra.hidden = true;
  els.corrections.hidden = true;
}

// ---------- Corrections ----------

function applyCorrection(deltaSign: 1 | -1): void {
  const gun = currentGun();
  const target = currentTarget();
  if (!gun || !target) return;
  const step = currentWeaponId() === 'mortar' ? state.stepL81 : state.stepSph2;
  const shifted = shiftTarget(gun, target, deltaSign * step);
  setFieldValue(targetX, Math.round(shifted.x * 100) / 100, true);
  setFieldValue(targetY, Math.round(shifted.y * 100) / 100, true);
  update();
}

// ---------- History ----------

function pushHistory(t: Pos): void {
  const rounded = { x: Math.round(t.x * 100) / 100, y: Math.round(t.y * 100) / 100 };
  const existing = state.history.findIndex(
    (h) => Math.abs(h.x - rounded.x) < 0.005 && Math.abs(h.y - rounded.y) < 0.005
  );
  if (existing >= 0) state.history.splice(existing, 1);
  state.history.unshift(rounded);
  state.history = state.history.slice(0, 5);
}

function renderHistory(): void {
  if (state.history.length === 0) {
    els.history.hidden = true;
    return;
  }
  els.history.hidden = false;
  els.historyChips.innerHTML = '';
  for (const h of state.history) {
    const gun = currentGun();
    let label = `X${formatGame(h.x)} Y${formatGame(h.y)}`;
    if (gun) {
      const s = computeSolution(gun, h);
      label += ` (${s.bearingStr}, ${fmtInt(s.distanceM)} m)`;
    }
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.innerHTML = `${label}`;
    chip.addEventListener('click', () => {
      setFieldValue(targetX, h.x, true);
      setFieldValue(targetY, h.y, true);
      update();
      targetX.el.focus();
    });
    els.historyChips.appendChild(chip);
  }
}

// ---------- Persistence ----------

function persist(): void {
  state.gun = currentGun();
  state.target = currentTarget();
  if (state.target) pushHistory(state.target);
  saveState(state);
}

function restore(): void {
  // Weapon
  setWeapon(state.weaponId, false);
  // Gun lock
  if (state.gunLocked) {
    els.lockGun.classList.add('is-active');
    els.lockGun.setAttribute('aria-pressed', 'true');
    gunX.el.readOnly = true;
    gunY.el.readOnly = true;
    gunX.el.classList.add('is-locked');
    gunY.el.classList.add('is-locked');
  }
  if (state.gun) {
    setFieldValue(gunX, state.gun.x, true);
    setFieldValue(gunY, state.gun.y, true);
  }
  if (state.target) {
    setFieldValue(targetX, state.target.x, true);
    setFieldValue(targetY, state.target.y, true);
  }
  els.stepInput.value = String(currentWeaponId() === 'mortar' ? state.stepL81 : state.stepSph2);
  renderHistory();
}

// ---------- Weapon ----------

function setWeapon(id: string, updateUI: boolean): void {
  if (!WEAPONS.some((w) => w.id === id)) id = DEFAULT_STATE.weaponId;
  state.weaponId = id;
  for (const btn of els.weaponBtns) {
    const active = btn.dataset.weapon === id;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-checked', String(active));
  }
  const step = id === 'mortar' ? state.stepL81 : state.stepSph2;
  els.stepInput.value = String(step);
  syncStepLabels();
  if (updateUI) update();
}

function syncStepLabels(): void {
  const step = currentWeaponId() === 'mortar' ? state.stepL81 : state.stepSph2;
  els.corrStepShort.textContent = String(step);
  els.corrStepFar.textContent = String(step);
}

// ---------- Wiring ----------

for (const f of fields) {
  f.el.addEventListener('input', () => handleInput(f));
  f.el.addEventListener('keydown', (e) => handleKeydown(f, e as KeyboardEvent));
}

els.weaponBtns.forEach((btn) =>
  btn.addEventListener('click', () => setWeapon(btn.dataset.weapon!, true))
);

els.lockGun.addEventListener('click', () => {
  state.gunLocked = !state.gunLocked;
  const locked = state.gunLocked;
  els.lockGun.classList.toggle('is-active', locked);
  els.lockGun.setAttribute('aria-pressed', String(locked));
  for (const f of [gunX, gunY]) {
    f.el.readOnly = locked;
    f.el.classList.toggle('is-locked', locked);
  }
  if (locked) {
    targetX.el.focus();
    persist();
  }
});

els.newTarget.addEventListener('click', () => {
  setFieldValue(targetX, null, false);
  setFieldValue(targetY, null, false);
  targetX.buffer = '';
  targetY.buffer = '';
  targetX.el.focus();
  update();
});

els.corrShort.addEventListener('click', () => applyCorrection(1));
els.corrFar.addEventListener('click', () => applyCorrection(-1));

els.stepInput.addEventListener('input', () => {
  const v = parseInt(els.stepInput.value.replace(/\D/g, ''), 10);
  if (Number.isFinite(v) && v > 0 && v <= 500) {
    if (currentWeaponId() === 'mortar') state.stepL81 = v;
    else state.stepSph2 = v;
    syncStepLabels();
    saveState(state);
  }
});

// ---------- Map (optional, lazy) ----------

const MAPS = [
  { id: 'bakurani', name: 'Bakurani', tiles: 'https://assets.wardogs-artillery.com/releases/assets-v1/maps/tiles/bakurani' },
  { id: 'ozeti', name: 'Ozeti', tiles: 'https://assets.wardogs-artillery.com/releases/assets-v1/maps/tiles/ozeti' },
  { id: 'zestafona', name: 'Zestafona', tiles: 'https://assets.wardogs-artillery.com/releases/assets-v1/maps/tiles/zestafona' }
];
// Map assets are remote (not bundled, license not MIT). Toggle hidden until
// first tile confirms availability.
const ASSET_BASE = 'https://assets.wardogs-artillery.com/releases/assets-v1/maps/tiles';

function checkMapAssets(): void {
  const probe = new Image();
  probe.onload = () => { els.mapToggle.hidden = false; };
  probe.onerror = () => { els.mapToggle.hidden = true; };
  probe.src = `${ASSET_BASE}/bakurani/0/0/0.webp`;
}

let mapLoaded = false;
let mapApi: { setPositions: (gun: Pos | null, target: Pos | null) => void } | null = null;

async function loadMap(): Promise<void> {
  els.mapHost.hidden = false;
  els.mapToggle.textContent = 'Karte ausblenden';
  if (mapLoaded) return;
  const mod = await import('./mapview');
  mapApi = mod.createMapView({
    mapHost: els.mapView as HTMLElement,
    cursorEl: els.mapCursor as HTMLElement,
    selectEl: els.mapSelect as HTMLSelectElement,
    maps: MAPS,
    getGun: currentGun,
    getTarget: currentTarget,
    onTargetPick: (p: Pos) => {
      setFieldValue(targetX, Math.round(p.x * 100) / 100, true);
      setFieldValue(targetY, Math.round(p.y * 100) / 100, true);
      update();
    },
    onGunPick: (p: Pos) => {
      if (state.gunLocked) return;
      setFieldValue(gunX, Math.round(p.x * 100) / 100, true);
      setFieldValue(gunY, Math.round(p.y * 100) / 100, true);
      update();
    }
  });
  mapLoaded = true;
}

els.mapToggle.addEventListener('click', () => {
  if (mapLoaded && !els.mapHost.hidden) {
    els.mapHost.hidden = true;
    els.mapToggle.textContent = 'Karte anzeigen';
  } else {
    void loadMap();
  }
});

// ---------- Footer ----------

els.dataCredit.textContent = `Feuerdaten: apollyon-sys/wardogs-calculator (MIT), Commit ${SOURCE_COMMIT.slice(0, 7)} von ${SOURCE_REPO}`;

// ---------- Boot ----------

restore();
update();
checkMapAssets();