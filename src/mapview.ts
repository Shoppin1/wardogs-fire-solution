// Optional map view: Leaflet with CRS.Simple, remote tiles from the
// wardogs-calculator asset CDN (NOT bundled, game assets are not MIT).
// Lazy-loaded via dynamic import; the app works fully without this module.

import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Pos } from './calc';
import { arcBounds } from './calc';
import { formatGame } from './coords';
import { getWeapon } from './data';

export interface MapConfig {
  id: string;
  name: string;
  tiles: string;
}

export interface MapViewOptions {
  mapHost: HTMLElement;
  cursorEl: HTMLElement;
  selectEl: HTMLSelectElement;
  maps: MapConfig[];
  getGun: () => Pos | null;
  getTarget: () => Pos | null;
  onTargetPick: (p: Pos) => void;
  onGunPick: (p: Pos) => void;
}

const TILE_SIZE = 256;
const MAP_SPAN = 163.84; // game units across full map edge

// Game coordinates to Leaflet CRS.Simple coordinates.
// Game: origin bottom-left, +Y north/up. Leaflet: y grows downward.
function gameToLatLng(x: number, y: number): L.LatLng {
  return L.latLng(MAP_SPAN - y, x);
}

function latLngToGame(lat: number, lng: number): Pos {
  return { x: lng, y: MAP_SPAN - lat };
}

export function createMapView(opts: MapViewOptions): {
  setPositions: (gun: Pos | null, target: Pos | null) => void;
} {
  const { mapHost, cursorEl, selectEl, maps } = opts;

  // Map selector
  for (const m of maps) {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.name;
    selectEl.appendChild(opt);
  }

  let map: L.Map | null = null;
  let tileLayer: L.TileLayer | null = null;
  let gunMarker: L.Marker | null = null;
  let targetMarker: L.Marker | null = null;
  let line: L.Polyline | null = null;
  let rings: L.Circle[] = [];
  let currentMapId = maps[0].id;

  function makeIcon(color: string): L.DivIcon {
    return L.divIcon({
      className: 'wd-marker',
      html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 0 6px rgba(0,0,0,.8)"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });
  }

  const gunIcon = makeIcon('#38bdf8');
  const targetIcon = makeIcon('#f87171');

  function initMap(): void {
    if (map) return;
    map = L.map(mapHost, {
      crs: L.CRS.Simple,
      minZoom: 0,
      maxZoom: 7,
      zoomControl: true,
      attributionControl: false
    });
    map.setView(gameToLatLng(80, 80), 2);

    // Live cursor readout in game format
    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      const p = latLngToGame(e.latlng.lat, e.latlng.lng);
      cursorEl.textContent = `X${formatGame(p.x)} Y${formatGame(p.y)}`;
    });
    map.on('click', (e: L.LeafletMouseEvent) => {
      const p = latLngToGame(e.latlng.lat, e.latlng.lng);
      opts.onTargetPick(p);
    });
    map.on('contextmenu', (e: L.LeafletMouseEvent) => {
      const p = latLngToGame(e.latlng.lat, e.latlng.lng);
      opts.onGunPick(p);
    });
  }

  function loadTiles(mapId: string): void {
    if (!map) return;
    currentMapId = mapId;
    if (tileLayer) tileLayer.remove();
    const cfg = maps.find((m) => m.id === mapId)!;
    tileLayer = L.tileLayer(`${cfg.tiles}/{z}/{x}/{y}.webp`, {
      // CRS.Simple tiles: z/x/y from the upstream asset layout.
      tileSize: TILE_SIZE,
      minZoom: 0,
      maxZoom: 7,
      noWrap: true,
      bounds: L.latLngBounds(
        gameToLatLng(-0.03, -0.01),
        gameToLatLng(163.83, 163.85)
      )
    }).addTo(map);
  }

  selectEl.addEventListener('change', () => loadTiles(selectEl.value));

  function setPositions(gun: Pos | null, target: Pos | null): void {
    if (!map) return;
    if (gunMarker) gunMarker.remove();
    if (targetMarker) targetMarker.remove();
    if (line) line.remove();
    for (const r of rings) r.remove();
    rings = [];
    gunMarker = null;
    targetMarker = null;
    line = null;

    if (gun) {
      gunMarker = L.marker(gameToLatLng(gun.x, gun.y), { icon: gunIcon, draggable: true }).addTo(map);
      gunMarker.on('drag', (e) => {
        const p = latLngToGame(e.target.getLatLng().lat, e.target.getLatLng().lng);
        opts.onGunPick(p);
      });
    }
    if (target) {
      targetMarker = L.marker(gameToLatLng(target.x, target.y), { icon: targetIcon, draggable: true }).addTo(map);
      targetMarker.on('drag', (e) => {
        const p = latLngToGame(e.target.getLatLng().lat, e.target.getLatLng().lng);
        opts.onTargetPick(p);
      });
    }
    if (gun && target) {
      line = L.polyline(
        [gameToLatLng(gun.x, gun.y), gameToLatLng(target.x, target.y)],
        { color: '#4ade80', weight: 2, dashArray: '6 4' }
      ).addTo(map);
    }
    if (gun) {
      // Range rings: min/max for every arc of both weapons around the gun.
      const allArcs = [...getWeapon('mortar').arcs, ...getWeapon('sph2').arcs];
      const shown = new Set<number>();
      for (const arc of allArcs) {
        const { minM, maxM } = arcBounds(arc);
        for (const r of [minM, maxM]) {
          if (shown.has(r)) continue;
          shown.add(r);
          rings.push(
            L.circle(gameToLatLng(gun.x, gun.y), {
              radius: r, // meters
              color: r === minM ? '#f87171' : '#38bdf8',
              weight: 1,
              fill: false,
              opacity: 0.5,
              dashArray: '2 6'
            }).addTo(map)
          );
        }
      }
    }
  }

  initMap();
  loadTiles(currentMapId);
  setPositions(opts.getGun(), opts.getTarget());

  return { setPositions };
}