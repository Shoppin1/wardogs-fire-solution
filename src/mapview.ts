// Optional map view: Leaflet with a game-unit CRS, remote tiles from the
// wardogs-calculator asset CDN (NOT bundled, game assets are not MIT).
// Lazy-loaded via dynamic import; the app works fully without this module.

import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Pos } from './calc';
import { arcBounds } from './calc';
import { formatGame } from './coords';
import { getWeapon } from './data';
import { MAX_TILE_ZOOM, SX, SY, TILE_BOUNDS, TILE_SIZE, tileUrlTemplate } from './maptiles';

export interface MapConfig {
  id: string;
  name: string;
  tilesBase: string;
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
  onTargetDrag?: (p: Pos) => void;
  onGunDrag?: (p: Pos) => void;
  onMapChange?: (mapId: string) => void;
}

// Custom CRS so that Leaflet zoom N maps 1:1 onto the pyramid's zoom_N:
// at zoom 0 the whole pyramid extent is exactly one 256 px tile (see
// maptiles.ts, whose gameToPixel is the same mapping in plain arithmetic).
// lat/lng are game units directly (lat = game Y, lng = game X); the
// transformation flips Y, since game Y grows north and pixels grow down.
const GAME_CRS = L.extend({}, L.CRS.Simple, {
  transformation: new L.Transformation(SX, -TILE_BOUNDS.minX * SX, -SY, TILE_BOUNDS.maxY * SY)
}) as L.CRS;

// Game coordinates to Leaflet coordinates (identity, the CRS does the work).
function gameToLatLng(x: number, y: number): L.LatLng {
  return L.latLng(y, x);
}

function latLngToGame(lat: number, lng: number): Pos {
  return { x: lng, y: lat };
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

  function makeIcon(color: string, symbol: string): L.DivIcon {
    return L.divIcon({
      className: 'wd-marker',
      html: `<div style="width:28px;height:28px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 0 8px rgba(0,0,0,.9);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#000">${symbol}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
  }

  const gunIcon = makeIcon('#38bdf8', 'G');
  const targetIcon = makeIcon('#f87171', 'Z');

  function initMap(): void {
    if (map) return;
    map = L.map(mapHost, {
      crs: GAME_CRS,
      minZoom: 0,
      maxZoom: MAX_TILE_ZOOM,
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
    tileLayer = L.tileLayer(tileUrlTemplate(cfg.tilesBase, cfg.id), {
      // Upstream asset layout: <map>/zoom_<z>/<x>_<y>.webp, 2^z tiles per side.
      tileSize: TILE_SIZE,
      minZoom: 0,
      maxZoom: MAX_TILE_ZOOM,
      noWrap: true,
      bounds: L.latLngBounds(
        gameToLatLng(TILE_BOUNDS.minX, TILE_BOUNDS.minY),
        gameToLatLng(TILE_BOUNDS.maxX, TILE_BOUNDS.maxY)
      )
    }).addTo(map);
  }

  selectEl.addEventListener('change', () => {
    loadTiles(selectEl.value);
    if (opts.onMapChange) opts.onMapChange(selectEl.value);
  });

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
        if (opts.onGunDrag) opts.onGunDrag(p); // live fields only, no marker rebuild
      });
      gunMarker.on('dragend', (e) => {
        const p = latLngToGame(e.target.getLatLng().lat, e.target.getLatLng().lng);
        opts.onGunPick(p); // full update incl. marker rebuild
      });
    }
    if (target) {
      targetMarker = L.marker(gameToLatLng(target.x, target.y), { icon: targetIcon, draggable: true }).addTo(map);
      targetMarker.on('drag', (e) => {
        const p = latLngToGame(e.target.getLatLng().lat, e.target.getLatLng().lng);
        if (opts.onTargetDrag) opts.onTargetDrag(p);
      });
      targetMarker.on('dragend', (e) => {
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
              // CRS distance is in game units, and 1 game unit is 100 m.
              radius: r / 100,
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