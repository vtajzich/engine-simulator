// Slip guard: proportional law on the clutch pedal POSITION as a function of engine rpm. Evaluated by the simulator in
// every sub-step (inputs.clutchGuard) because the loop gain (~136 1/s) is only stable at sub-step rates.
import { releaseKin } from '../kin/clutch.js';

export const GUARD_HI = 795, GUARD_LO = 720;
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);

// smallest pedal at which the clutch carries no torque (found numerically once) + margin
export const GUARD_PEDAL = (() => {
  let lo = 0, hi = 1;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (releaseKin(m).capacity === 0) hi = m; else lo = m; }
  return hi + 0.05;
})();

export const guardOf = rpm => clamp01((GUARD_HI - rpm) / (GUARD_HI - GUARD_LO)) * GUARD_PEDAL;
