import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Closed (rho, x) polygon revolved about the X axis.
export function lathePoly(pts, segments) {
  const v = pts.map(([rho, x]) => new THREE.Vector2(rho, x));
  const g = new THREE.LatheGeometry(v, segments);
  g.rotateZ(-Math.PI / 2);
  return g;
}

// Drop uv, make non-indexed, orient triangles outward (positive volume), recompute normals.
export function clean(geom) {
  let g = geom.index ? geom.toNonIndexed() : geom.clone();
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  const p = g.attributes.position.array;
  let vol = 0;
  for (let i = 0; i < p.length; i += 9) {
    vol += p[i] * (p[i + 4] * p[i + 8] - p[i + 5] * p[i + 7])
         - p[i + 1] * (p[i + 3] * p[i + 8] - p[i + 5] * p[i + 6])
         + p[i + 2] * (p[i + 3] * p[i + 7] - p[i + 4] * p[i + 6]);
  }
  if (vol < 0) {
    for (let i = 0; i < p.length; i += 9) for (let j = 0; j < 3; j++) {
      const t = p[i + 3 + j]; p[i + 3 + j] = p[i + 6 + j]; p[i + 6 + j] = t;
    }
  }
  g.computeVertexNormals();
  return g;
}

export function merge(list) {
  return mergeGeometries(list.map(clean), false);
}

// Torus ring about the X axis: ring radius rho, tube radius r, centre at axial position x.
export function torusX(rho, r, x, tubular, radial = 20) {
  const g = new THREE.TorusGeometry(rho, r, radial, tubular);
  g.rotateY(Math.PI / 2);
  g.translate(x, 0, 0);
  return g;
}

export function boxAt(sx, sy, sz, cx, cy, cz) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  g.translate(cx, cy, cz);
  return g;
}
