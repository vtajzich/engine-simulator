// Derived geometry. Everything comes from SPEC; nothing is hard-coded here.
import { SPEC } from '../spec.js';

export const rad = d => d * Math.PI / 180;
export const deg = r => r * 180 / Math.PI;
export const mod = (a, n) => ((a % n) + n) % n;
export function wrapTo(a, period) {
  const r = mod(a + period / 2, period) - period / 2;
  return r === -period / 2 ? period / 2 : r;
}
export const wrapPi = a => wrapTo(a, 2 * Math.PI);

function deepFreeze(o) {
  for (const v of Object.values(o)) if (v && typeof v === 'object') deepFreeze(v);
  return Object.freeze(o);
}

const cache = new WeakMap();

export function derive(spec = SPEC) {
  if (cache.has(spec)) return cache.get(spec);
  const e = spec.engine, vt = e.valvetrain, gb = spec.gearbox;
  const R = e.bore / 2, r = e.stroke / 2, L = e.rodLength;
  const cylX = Array.from({ length: e.cylinders }, (_, i) => i * e.boreSpacing);
  const throwPhase = e.throwPhaseDeg.map(rad);
  const headFaceY = e.deckHeight + e.headGasket;
  const gamma = rad(e.head.roofAngleDeg);
  const roofApexY = headFaceY + R * Math.tan(gamma);
  const tdcCrownY = r + L + e.compressionHeight;
  const pistonArea = Math.PI * R * R;
  const displacement = pistonArea * e.stroke;
  const clearanceVolume = R ** 3 * Math.tan(gamma) * (Math.PI - 4 / 3) + pistonArea * (headFaceY - tdcCrownY);
  const compressionRatio = 1 + displacement / clearanceVolume;

  const buildValve = kind => {
    const side = kind === 'in' ? 1 : -1;
    const v = kind === 'in' ? e.valves.intake : e.valves.exhaust;
    const axis = [0, Math.cos(gamma), side * Math.sin(gamma)];
    const seat = (cyl, which) => [
      cylX[cyl] + (which === 0 ? -1 : 1) * v.dx,
      roofApexY - v.slope * Math.sin(gamma),
      side * v.slope * Math.cos(gamma),
    ];
    const camOffset = e.valves.length + vt.bucketTopThickness - e.valves.seatGap + vt.lash + vt.contactGap + vt.baseCircleRadius;
    const s0 = seat(0, 0);
    const camAxis = { y: s0[1] + camOffset * Math.cos(gamma), z: s0[2] + side * camOffset * Math.sin(gamma) };
    const followerAngle = kind === 'in' ? Math.PI + gamma : Math.PI - gamma;
    const openDeg = kind === 'in' ? 360 - vt.intakeOpensBTDC : 180 - vt.exhaustOpensBBDC;
    const closeDeg = kind === 'in' ? 540 + vt.intakeClosesABDC : 360 + vt.exhaustClosesATDC;
    return {
      side, headRadius: v.headDiameter / 2, maxLift: v.maxLift, axis, seat, camOffset, camAxis, followerAngle,
      openDeg, closeDeg, peakDeg: (openDeg + closeDeg) / 2,
      halfDurationCam: (closeDeg - openDeg) * Math.PI / 720,
    };
  };

  // gearbox
  const beta = rad(gb.helixAngleDeg), mn = gb.normalModule, mt = mn / Math.cos(beta);
  const alphaT = Math.atan(Math.tan(rad(gb.normalPressureAngleDeg)) / Math.cos(beta));
  const centreDistance = mt * gb.toothSum / 2;
  const gears = {};
  const helical = (id, shaft, z, xr) => {
    const rr = mt * z / 2;
    gears[id] = { id, shaft, z, r: rr, rb: rr * Math.cos(alphaT), ra: rr + mn, rf: rr - 1.25 * mn, mt, alphaT, beta,
      hand: shaft === 'main' ? 1 : -1, backlash: gb.backlash, x: [xr[0], xr[1]], mid: (xr[0] + xr[1]) / 2, width: xr[1] - xr[0] };
  };
  for (const [name, p] of Object.entries(gb.pairs)) {
    helical(`${name}.main`, 'main', p.main, p.x);
    helical(`${name}.counter`, 'counter', p.counter, p.x);
  }
  const rv = gb.reverse;
  const spur = (id, shaft, z, xr) => {
    const rr = rv.module * z / 2, a = rad(rv.pressureAngleDeg);
    gears[id] = { id, shaft, z, r: rr, rb: rr * Math.cos(a), ra: rr + rv.module, rf: rr - 1.25 * rv.module, mt: rv.module,
      alphaT: a, beta: 0, hand: 0, backlash: gb.backlash, x: [xr[0], xr[1]], mid: (xr[0] + xr[1]) / 2, width: xr[1] - xr[0] };
  };
  spur('rev.counter', 'counter', rv.counter, rv.counterX);
  spur('rev.idler', 'idler', rv.idler, rv.idlerNeutralX);
  spur('rev.main', 'main', rv.main, rv.mainX);
  const dC = gears['rev.counter'].r + gears['rev.idler'].r, dM = gears['rev.main'].r + gears['rev.idler'].r;
  const iy = (dC * dC - dM * dM - centreDistance * centreDistance) / (2 * centreDistance);   // main at origin, counter at y = −d
  const idlerAxis = { y: iy, z: rv.idlerSide * Math.sqrt(dM * dM - iy * iy) };
  const pi = gb.pairs, k = pi.input.counter / pi.input.main;
  const ratios = { 4: 1, R: -k * (rv.main / rv.counter) };
  for (const g of ['1', '2', '3', '5']) ratios[g] = k * (pi['g' + g].main / pi['g' + g].counter);

  const sy = gb.synchro, n = sy.teeth, pitchAngle = 2 * Math.PI / n, P = sy.pitchRadius * pitchAngle, w = sy.toothWidthFraction * P;

  const D = deepFreeze({
    R, r, L, cylX, throwPhase, firingAngleDeg: e.firingAngleDeg.slice(), headFaceY, gamma, roofApexY, tdcCrownY,
    pistonArea, displacement, clearanceVolume, compressionRatio,
    valve: { in: buildValve('in'), ex: buildValve('ex') },
    gearbox: { beta, mn, mt, alphaT, centreDistance, counterAxis: { y: -centreDistance, z: 0 }, mainAxis: { y: 0, z: 0 },
      gears, idlerAxis, ratios },
    synchro: { n, pitchAngle, P, w, c: P / 2 - w, chamferLen: (w / 2) / Math.tan(rad(sy.chamferAngleDeg)) },
  });
  cache.set(spec, D);
  return D;
}
