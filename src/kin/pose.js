import { SPEC } from '../spec.js';
import { derive, deg } from './derive.js';
import { cycleAngleDeg, gasState, strokeOf } from './engine.js';
import { shaftAngles, gearLinear, gearForSleeve } from './gears.js';

const D = derive();
const SH = SPEC.gearbox.shift, travel = SPEC.gearbox.synchro.travel, pitchAngle = D.synchro.pitchAngle;
const RINGS = ['ring1', 'ring2', 'ring3', 'ring4', 'ring5'];

export function poseAt(o = {}) {
  const { crank = 0, main = 0, clutchPedal = 0, lever = { col: 0, row: 0 }, throttle = 0.3 } = o;
  const sleeves = { s12: 0, s34: 0, s5: 0, ...(o.sleeves ?? {}) };
  // the reverse-idler fork is rigid on the 5th/reverse rail: the idler follows that rail 1:1
  const idlerX = o.idlerX ?? sleeves.s5;
  const input = o.input ?? crank;
  const sa = shaftAngles({ input, main });
  const rings = {};
  for (const k of RINGS) rings[k] = { angle: main + pitchAngle / 2, push: 0, ...(o.rings?.[k] ?? {}) };
  return {
    crank, camIn: crank / 2, camEx: crank / 2, clutchPedal, input, counter: sa.counter, main,
    gears: { g1: sa.g1, g2: sa.g2, g3: sa.g3, g5: sa.g5, idler: sa.idler },
    idlerX, sleeves, rings, lever: { ...lever },
    cylinders: Array.from({ length: SPEC.engine.cylinders }, (_, i) => {
      const psiDeg = cycleAngleDeg(deg(crank), i);
      return { psiDeg, ...gasState(psiDeg, throttle) };
    }),
    flow: o.flow ?? new Set(),
  };
}

export function poseForGear(gear, o = {}) {
  const main = o.main ?? 0;
  const g = String(gear);
  const [col, row] = SH.gate[g];
  const base = { ...o, main, lever: { col, row } };
  let input = o.input ?? o.crank ?? 0;
  if (g === 'R') {
    const { A, B } = gearLinear('revMain');
    input = (main - B) / A;
    base.idlerX = SPEC.gearbox.reverse.idlerTravel;
    base.sleeves = { ...o.sleeves, s5: -travel };
  } else if (g !== 'N') {
    let name = null, sleeve = null, sign = 0;
    for (const [s, m] of Object.entries(gearForSleeve)) for (const [sg, nm] of Object.entries(m)) {
      if (nm === (g === '4' ? 'input' : 'g' + g)) { name = nm; sleeve = s; sign = +sg; }
    }
    const { A, B } = gearLinear(name);
    input = (main + pitchAngle / 2 - B) / A;
    base.sleeves = { ...o.sleeves, [sleeve]: sign * travel };
  }
  return poseAt({ ...base, input, crank: o.crank ?? input });
}

export function poseFromState(state) {
  const input = state.thetaInput, main = state.thetaMain, crank = state.thetaCrank;
  const sa = shaftAngles({ input });
  const run = state.engine.running, thr = run ? state.engine.throttleEff : 0;
  const rings = {};
  for (const k of RINGS) {
    rings[k] = {
      angle: main + pitchAngle / 2 + state.synchro.ringIndex[k] / SPEC.gearbox.synchro.pitchRadius,
      push: state.synchro.ringPush[k],
    };
  }
  return {
    crank, camIn: crank / 2, camEx: crank / 2, clutchPedal: state.clutchPedal, input, counter: sa.counter, main,
    gears: { g1: sa.g1, g2: sa.g2, g3: sa.g3, g5: sa.g5, idler: sa.idler },
    idlerX: state.rails.s5, sleeves: { s12: state.rails.s12, s34: state.rails.s34, s5: state.rails.s5 }, rings,
    lever: { col: state.lever.col, row: state.lever.row },
    cylinders: Array.from({ length: SPEC.engine.cylinders }, (_, i) => {
      const psiDeg = cycleAngleDeg(deg(crank), i);
      const gas = gasState(psiDeg, thr);
      if (run) return { psiDeg, ...gas };
      const stroke = strokeOf(psiDeg);
      const phase = stroke === 'power' ? 'expansion' : stroke;
      return { psiDeg, ...gas, phase, burn: 0, spark: false };
    }),
    flow: new Set(state.flow),
  };
}
