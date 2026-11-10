import { SPEC } from '../spec.js';
import { derive, wrapPi } from './derive.js';

const D = derive();
const VT = SPEC.engine.valvetrain;
const { f1, f3 } = VT.profile;
const rb = VT.baseCircleRadius;

export function liftLaw(tau, H, Lmax, f1_, f3_) {
  if (tau < 0) return { s: 0, ds: 0, d2s: 0 };
  const t = Math.min(tau, H);
  const t1 = f1_ * H, t3 = f3_ * H, t2 = H - t1 - t3, v = Lmax / (H - (t1 + t3) / 2);
  if (t <= t1) return { s: 0.5 * (v / t1) * t * t, ds: (v / t1) * t, d2s: v / t1 };
  if (t <= t1 + t2) return { s: v * t1 / 2 + v * (t - t1), ds: v, d2s: 0 };
  const u = H - t;
  return { s: Lmax - 0.5 * (v / t3) * u * u, ds: (v / t3) * u, d2s: -v / t3 };
}

export const camAngle = crank => crank / 2;

export const lobeCentreAngle = (kind, cyl) =>
  D.valve[kind].followerAngle - (D.firingAngleDeg[cyl] + D.valve[kind].peakDeg) / 2 * Math.PI / 180;

export function lobeLift(kind, cyl, phi) {
  const V = D.valve[kind], H = V.halfDurationCam;
  const d = wrapPi(phi - lobeCentreAngle(kind, cyl));
  if (Math.abs(d) >= H) return { s: 0, ds: 0 };
  const l = liftLaw(H - Math.abs(d), H, V.maxLift, f1, f3);
  return { s: l.s, ds: -Math.sign(d) * l.ds };
}

export const camLift = (kind, cyl, crank) => lobeLift(kind, cyl, D.valve[kind].followerAngle - camAngle(crank)).s;
export const valveLift = (kind, cyl, crank) => Math.max(0, camLift(kind, cyl, crank) - VT.lash);

export function lobeOutline(kind, cyl, n = 240) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const phi = 2 * Math.PI * k / n, { s, ds } = lobeLift(kind, cyl, phi);
    const h = rb + s, c = Math.cos(phi), si = Math.sin(phi);
    out.push([h * c - ds * si, h * si + ds * c]);
  }
  return out;
}

export function lobeChecks(kind) {
  const V = D.valve[kind], H = V.halfDurationCam, N = 2000;
  let minCurvatureRadius = rb, maxContactOffset = 0;
  for (let i = 0; i <= N; i++) {
    const l = liftLaw(H * i / N, H, V.maxLift, f1, f3);
    minCurvatureRadius = Math.min(minCurvatureRadius, rb + l.s + l.d2s);
    maxContactOffset = Math.max(maxContactOffset, Math.abs(l.ds));
  }
  return { minCurvatureRadius, maxContactOffset };
}
