// Involute spur / helical gear rim generator. Axis = X, centred on x = 0, tooth 0 on local +Y at the mid-plane.
import { toothHalfAngle } from '../kin/gears.js';
import { Soup, fixWinding, soupGeometry } from './gearboxGeo.js';

/** 2D transverse outline of the toothed rim as [radius, angle] pairs, increasing angle. */
export function gearProfile(g, { nFlank = 6, nTip = 2, nRoot = 3 } = {}) {
  const { z, rb, ra, rf } = g, pitch = 2 * Math.PI / z, rStart = Math.max(rb, rf), pts = [];
  const half = rho => toothHalfAngle(g, rho);
  for (let k = 0; k < z; k++) {
    const c = k * pitch;
    if (rf < rb) pts.push([rf, c - half(rb)]);
    for (let i = 0; i <= nFlank; i++) { const rho = rStart + (ra - rStart) * i / nFlank; pts.push([rho, c - half(rho)]); }
    const hTip = half(ra);
    for (let i = 1; i < nTip; i++) pts.push([ra, c - hTip + 2 * hTip * i / nTip]);
    for (let i = nFlank; i >= 0; i--) { const rho = rStart + (ra - rStart) * i / nFlank; pts.push([rho, c + half(rho)]); }
    if (rf < rb) pts.push([rf, c + half(rb)]);
    const a0 = c + half(rStart), a1 = c + pitch - half(rStart);
    for (let i = 1; i < nRoot; i++) pts.push([rf, a0 + (a1 - a0) * i / nRoot]);
  }
  return pts;
}

/** Triangle soup of an extruded outline ([rho, angle] list, CCW) with optional helical twist. */
export function extrudeOutline(outline, { width, innerRadius, slices = 1, twistPerX = 0 }) {
  const N = outline.length, s = new Soup();
  const ring = (rho, a, x, tw) => [x, rho * Math.cos(a + tw), rho * Math.sin(a + tw)];
  const sl = [];
  for (let k = 0; k <= slices; k++) {
    const x = -width / 2 + width * k / slices, tw = twistPerX * x;
    sl.push({
      o: outline.map(([rho, a]) => ring(rho, a, x, tw)),
      i: outline.map(([, a]) => ring(innerRadius, a, x, tw)),
    });
  }
  for (let k = 0; k < slices; k++) {
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      s.quad(sl[k].o[i], sl[k].o[j], sl[k + 1].o[j], sl[k + 1].o[i]);          // outline surface
      s.quad(sl[k].i[i], sl[k + 1].i[i], sl[k + 1].i[j], sl[k].i[j]);          // bore
    }
  }
  const first = sl[0], last = sl[slices];
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    s.quad(last.o[i], last.o[j], last.i[j], last.i[i]);                         // +x cap
    s.quad(first.o[i], first.i[i], first.i[j], first.o[j]);                     // -x cap
  }
  return fixWinding(s.toArray());
}

/** Triangle soup of the toothed rim (see file header). */
export function gearRimSoup(g, { width = g.width, innerRadius, slices } = {}) {
  const twistPerX = g.beta ? g.hand * Math.tan(g.beta) / g.r : 0;
  if (slices === undefined) {
    slices = g.beta ? Math.max(8, Math.ceil(Math.abs(twistPerX * width) / (2 * Math.PI / 180))) : 1;
  }
  const outline = g.beta ? gearProfile(g) : gearProfile(g, { nFlank: 10, nTip: 3, nRoot: 4 });
  return extrudeOutline(outline, { width, innerRadius, slices, twistPerX });
}

/** Annulus from innerRadius to the tips, axis X, centred on x = 0. */
export function gearRimGeometry(g, opts = {}) {
  return soupGeometry(gearRimSoup(g, opts));
}
