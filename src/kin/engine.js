import { SPEC } from '../spec.js';
import { derive, rad, mod } from './derive.js';

const D = derive();
const E = SPEC.engine;
const { r, L } = D;

export const throwAngle = (crank, cyl) => crank + D.throwPhase[cyl];
export const pistonPinY = a => r * Math.cos(a) + Math.sqrt(L * L - r * r * Math.sin(a) ** 2);
export const pistonCrownY = a => pistonPinY(a) + E.compressionHeight;
export const crankPin = a => ({ y: r * Math.cos(a), z: r * Math.sin(a) });
export const rodAngle = a => -Math.asin(r * Math.sin(a) / L);
export const pistonVelocityPerRad = a =>
  -r * Math.sin(a) - r * r * Math.sin(a) * Math.cos(a) / Math.sqrt(L * L - r * r * Math.sin(a) ** 2);

export const cycleAngleDeg = (crankDeg, cyl) => mod(crankDeg - D.firingAngleDeg[cyl], 720);
export function strokeOf(psiDeg) {
  const p = mod(psiDeg, 720);
  return p < 180 ? 'power' : p < 360 ? 'exhaust' : p < 540 ? 'intake' : 'compression';
}
export const cylinderVolume = a => D.clearanceVolume + D.pistonArea * (D.tdcCrownY - pistonCrownY(a));

const smooth = t => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };

export function gasState(psiDeg, throttle = 0.3) {
  const psi = mod(psiDeg, 720);
  const stroke = strokeOf(psi);
  const Vbdc = D.clearanceVolume + D.displacement;
  const pm = 0.35 + 0.60 * throttle;
  const sa = E.sparkAdvanceDeg;
  const adv = sa.idle + (sa.load - sa.idle) * throttle;
  const psiS = 720 - adv;
  const EVO = D.valve.ex.openDeg;

  let rel = -1;                                    // degrees since spark
  if (psi >= psiS) rel = psi - psiS; else if (psi < 180) rel = psi + adv;
  const burnAt = rl => { if (rl < 0) return 0; const x = rl / 55; return Math.min(1, Math.max(0, 1 - Math.exp(-5 * x ** 3))); };
  const burn = burnAt(rel);

  const expand = (ps, b) => {
    const ratio = Vbdc / cylinderVolume(rad(ps));
    return { p: pm * ratio ** 1.30 * (1 + 2.6 * b), T: 330 * ratio ** 0.30 * (1 + 2.3 * b) };
  };

  let pBar, tempK, phase;
  if (psi >= 540 || psi < EVO) {
    ({ p: pBar, T: tempK } = expand(psi, burn));
    phase = burn > 0.98 ? 'expansion' : burn > 0.02 ? 'combustion' : (psi >= 540 ? 'compression' : 'expansion');
  } else if (psi < 180) {
    const ev = expand(EVO, burnAt(EVO + adv));
    const e = Math.exp(-(psi - EVO) / 15);
    pBar = 1.05 + (ev.p - 1.05) * e; tempK = 1000 + (ev.T - 1000) * e;
    phase = 'exhaust';
  } else if (psi < 360) {
    pBar = 1.05; tempK = 950; phase = 'exhaust';
  } else {
    const s = smooth((psi - 360) / 20);
    pBar = 1.05 + (pm - 1.05) * s; tempK = 950 + (320 - 950) * s; phase = 'intake';
  }
  const since = mod(psi - psiS, 720);
  return { stroke, phase, burn, pBar, tempK, spark: since < 4 };
}
