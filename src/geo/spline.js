// Clutch teeth (dog teeth / splines) with constant ANGULAR tooth width and 45° (configurable) pointed ends.
// Axis = X, angle from +Y toward +Z. Tooth k is centred on phase + k * 2π/n.
import { Soup, fixWinding, soupGeometry } from './gearboxGeo.js';

/**
 * Soup of n closed tooth solids.
 * pointed: 'x0' | 'x1' | 'both' | 'none'. At axial distance t from a pointed tip the angular half-width is
 * min(halfAngle, t / (pitchRadius * tan(chamfer))).  The chamfer angle may be given as `chamferAngle` or
 * `chamferAngleAtPitch` (radians).
 */
export function clutchTeethSoup({
  n, rInner, rOuter, x0, x1, pointed = 'none', halfAngle, pitchRadius, chamferAngle, chamferAngleAtPitch,
  phase = 0, radialStrips = 3, chamferStrips = 4,
}) {
  const chi = chamferAngle ?? chamferAngleAtPitch ?? Math.PI / 4;
  const k = pitchRadius * Math.tan(chi);                    // mm of axial run per radian of half-width
  const cl = halfAngle * k;                                  // chamfer length
  const tip0 = pointed === 'x0' || pointed === 'both', tip1 = pointed === 'x1' || pointed === 'both';
  const xs = new Set([x0, x1]);
  for (let i = 1; i <= chamferStrips; i++) {
    if (tip0) xs.add(Math.min(x1, x0 + cl * i / chamferStrips));
    if (tip1) xs.add(Math.max(x0, x1 - cl * i / chamferStrips));
  }
  const X = [...xs].sort((a, b) => a - b);
  const H = X.map(x => Math.min(halfAngle, tip0 ? (x - x0) / k : Infinity, tip1 ? (x1 - x) / k : Infinity));
  const R = Array.from({ length: radialStrips + 1 }, (_, j) => rInner + (rOuter - rInner) * j / radialStrips);
  const pitch = 2 * Math.PI / n, s = new Soup();
  const P = (x, r, a) => [x, r * Math.cos(a), r * Math.sin(a)];
  for (let t = 0; t < n; t++) {
    const c = phase + t * pitch;
    const L = (i, j) => P(X[i], R[j], c - H[i]), Rt = (i, j) => P(X[i], R[j], c + H[i]);
    const m = X.length - 1;
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < radialStrips; j++) {
        s.quad(Rt(i, j), Rt(i + 1, j), Rt(i + 1, j + 1), Rt(i, j + 1));                 // +side
        s.quad(L(i, j), L(i, j + 1), L(i + 1, j + 1), L(i + 1, j));                     // -side
      }
      const T = radialStrips;
      s.quad(L(i, T), Rt(i, T), Rt(i + 1, T), L(i + 1, T));                             // top (outer radius)
      s.quad(L(i, 0), L(i + 1, 0), Rt(i + 1, 0), Rt(i, 0));                             // bottom
    }
    for (let j = 0; j < radialStrips; j++) {                                            // flat end caps (strips match the side grids)
      if (!tip0) s.quad(L(0, j), Rt(0, j), Rt(0, j + 1), L(0, j + 1));
      if (!tip1) s.quad(L(m, j), L(m, j + 1), Rt(m, j + 1), Rt(m, j));
    }
  }
  return fixWinding(s.toArray());
}

export function clutchTeethGeometry(opts) {
  return soupGeometry(clutchTeethSoup(opts));
}
