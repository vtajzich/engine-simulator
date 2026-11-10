import * as THREE from 'three';

// Shared named materials (one instance per name so the UI can restyle them globally).
// Works in Node: no textures, no DOM.
const DEFS = {
  steel:      { color: 0x9aa3ad, metalness: 0.9, roughness: 0.35 },
  steelDark:  { color: 0x5b636c, metalness: 0.9, roughness: 0.45 },
  polished:   { color: 0xd9dee3, metalness: 1.0, roughness: 0.18 },
  aluminium:  { color: 0xc9ccd1, metalness: 0.75, roughness: 0.42 },
  castIron:   { color: 0x4a4d52, metalness: 0.6, roughness: 0.7 },
  brass:      { color: 0xc9a14a, metalness: 0.9, roughness: 0.35 },
  friction:   { color: 0x2b2622, metalness: 0.1, roughness: 0.95 },
  rubber:     { color: 0x17181a, metalness: 0.0, roughness: 0.9 },
  intake:     { color: 0x6fa8dc, metalness: 0.85, roughness: 0.3 },   // intake valves
  exhaust:    { color: 0xd98a4e, metalness: 0.85, roughness: 0.3 },   // exhaust valves
  ceramic:    { color: 0xf2efe6, metalness: 0.0, roughness: 0.5 },
  housing:    { color: 0x8d949c, metalness: 0.6, roughness: 0.6 },    // block / head / cases (UI ghosts these)
  gearA:      { color: 0xa9b4bf, metalness: 0.95, roughness: 0.28 },
  gearB:      { color: 0x8f9aa6, metalness: 0.95, roughness: 0.3 },
  shiftSteel: { color: 0x6f7780, metalness: 0.85, roughness: 0.4 },
  knob:       { color: 0x1c1c1f, metalness: 0.2, roughness: 0.6 },
};
const cache = new Map();

/** mat('steel') → shared MeshStandardMaterial. */
export function mat(name) {
  if (!cache.has(name)) {
    const d = DEFS[name];
    if (!d) throw new Error(`unknown material ${name}`);
    const m = new THREE.MeshStandardMaterial(d);
    m.name = name;
    cache.set(name, m);
  }
  return cache.get(name);
}
export const materialNames = Object.keys(DEFS);
