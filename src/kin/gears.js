import { SPEC } from '../spec.js';
import { derive } from './derive.js';

const D = derive();
const GB = D.gearbox, pairs = SPEC.gearbox.pairs, RV = SPEC.gearbox.reverse;
const TAU = 2 * Math.PI;

export const inv = a => Math.tan(a) - a;

export function toothHalfAngle(g, rho) {
  const s = Math.PI * g.mt / 2 - g.backlash / 2;
  const a = rho >= g.rb ? Math.acos(g.rb / rho) : 0;
  return s / (2 * g.r) + inv(g.alphaT) - inv(a);
}

export function meshPhase(zA, thetaA, zB, delta) {
  const frac = v => v - Math.floor(v);
  const pA = frac((delta - thetaA) * zA / TAU);
  const pB = frac(0.5 - pA);
  return delta + Math.PI - pB * TAU / zB;
}

const c0 = meshPhase(pairs.input.main, 0, pairs.input.counter, Math.PI);
const I = GB.idlerAxis, C = GB.counterAxis;
const dci = Math.atan2(I.z - C.z, I.y - C.y), dim = Math.atan2(-I.z, -I.y);
const i0 = meshPhase(RV.counter, 0, RV.idler, dci);
const m0 = meshPhase(RV.idler, 0, RV.main, dim);

const LIN = {};
LIN.input = { A: 1, B: 0 };
LIN.counter = { A: -pairs.input.main / pairs.input.counter, B: c0 };
const chain = (from, q, k0) => ({ A: -q * LIN[from].A, B: k0 - q * LIN[from].B });
for (const g of ['g1', 'g2', 'g3', 'g5']) {
  const p = pairs[g];
  LIN[g] = chain('counter', p.counter / p.main, meshPhase(p.counter, 0, p.main, 0));
}
LIN.idler = chain('counter', RV.counter / RV.idler, i0);
LIN.revMain = chain('idler', RV.idler / RV.main, m0);

export function gearLinear(name) {
  const l = LIN[name];
  if (!l) throw new Error(`gearLinear: unknown shaft/gear '${name}'`);
  return { A: l.A, B: l.B };
}

export function shaftAngles({ input }) {
  const f = n => LIN[n].A * input + LIN[n].B;
  return { counter: f('counter'), g1: f('g1'), g2: f('g2'), g3: f('g3'), g5: f('g5'), idler: f('idler'), revMainRequired: f('revMain') };
}

export const gearForSleeve = { s12: { '-1': 'g2', '1': 'g1' }, s34: { '-1': 'input', '1': 'g3' }, s5: { '1': 'g5' } };
export const gearNumber = { g1: '1', g2: '2', g3: '3', input: '4', g5: '5' };
export const ringForGear = { g1: 'ring1', g2: 'ring2', g3: 'ring3', input: 'ring4', g5: 'ring5' };
