// Ignition kinematics (pure maths): spark timing, distributor rotor / cap terminal angles, spark flash envelope.
// Angles on the distributor axis use the project convention: measured from +Y toward +Z.
import { SPEC } from '../spec.js';
import { rad, deg, mod, wrapTo } from './derive.js';

const E = SPEC.engine, IG = E.ignition;

/** Spark advance in crank degrees BTDC (idle → load by throttle). */
export function sparkAdvanceDeg(throttle = 0.3) {
  const sa = E.sparkAdvanceDeg;
  return sa.idle + (sa.load - sa.idle) * throttle;
}

/** Crank angle 0…720 at which cylinder `cyl` (0-based) sparks. */
export const sparkCrankDeg = (cyl, throttle = 0.3) => mod(E.firingAngleDeg[cyl] - sparkAdvanceDeg(throttle), 720);

/** Rotor angle (rad): rigid on the intake cam, one turn per cycle. */
export const rotorAngle = crank => crank / 2;

/** Angle (rad, 0…2π) of the cap terminal of cylinder `cyl`: rotor position at mid advance. */
export const terminalAngle = cyl => rad(mod((E.firingAngleDeg[cyl] - IG.midAdvanceDeg) / 2, 360));

/** Cylinder numbers (1-based) in rotor travel order, starting at cylinder 1. */
export function terminalOrder() {
  const a0 = terminalAngle(0);
  return Array.from({ length: E.cylinders }, (_, c) => c)
    .sort((a, b) => mod(terminalAngle(a) - a0, 2 * Math.PI) - mod(terminalAngle(b) - a0, 2 * Math.PI))
    .map(c => c + 1);
}

/** Signed cam degrees between the rotor tip and terminal `cyl` at that cylinder's spark. */
export const rotorMisalignDeg = (cyl, throttle = 0.3) =>
  wrapTo(deg(rotorAngle(rad(sparkCrankDeg(cyl, throttle)))) - deg(terminalAngle(cyl)), 360);

/** Visual flash envelope: 1 at the spark, linearly 0 after `flashDeg` crank degrees; 0 outside [0, flashDeg). */
export function flashOf(sinceDeg) {
  const f = IG.flashDeg;
  return sinceDeg >= 0 && sinceDeg < f ? 1 - sinceDeg / f : 0;
}
