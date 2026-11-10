import { SPEC } from '../spec.js';
import { derive, wrapTo } from './derive.js';

const SY = SPEC.gearbox.synchro;
const { P, c, pitchAngle } = derive().synchro;
const eps = 0.05;

export const misalign = (angle, main) => Math.abs(wrapTo(angle - main - pitchAngle / 2, pitchAngle)) * SY.pitchRadius;
export const maxAdvance = d => (d < c - eps ? Infinity : P / 2 - d - eps);
export const maxMisalign = a => (a <= 0 ? P / 2 : Math.max(c / 2, P / 2 - a - eps));

export const xRingTip = SY.ringTeethX[0] - SY.sleeveHalfWidth;
export const xBlock = xRingTip + maxAdvance(SY.ringIndexFraction * P);
export const xDogTip = SY.dogTeethX[0] - SY.sleeveHalfWidth;
export const xEngaged = SY.travel;
export const advanceRing = x => x - xRingTip;
export const advanceDog = x => x - xDogTip;
