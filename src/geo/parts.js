import * as THREE from 'three';

/** Create a part group. See docs/design.md §3. */
export function partGroup(id, body, label, extra = {}) {
  const g = new THREE.Group();
  g.name = id;
  g.userData.part = { id, body, label, ...extra };
  return g;
}

/** Segment count for a circle of the given radius (docs/design.md §6). */
export function segs(radius) {
  return radius > 100 ? 96 : radius > 30 ? 64 : 48;
}
