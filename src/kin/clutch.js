import { SPEC } from '../spec.js';

const memo = new WeakMap();

// Points are { rho, x } in the (radius, axial) half-plane.
export function clutchStack(spec = SPEC) {
  if (memo.has(spec)) return memo.get(spec);
  const c = spec.clutch, d = c.diaphragm, cGap = 0.05;
  const discFrontX = c.flywheel.x[1] + c.faceGap;
  const discRearX = discFrontX + c.disc.thickness;
  const plateFrontX = discRearX + c.faceGap;
  const plateRearX = plateFrontX + c.pressurePlate.thickness;
  const ridgeX = plateRearX + c.pressurePlate.ridgeHeight;
  const O = { rho: d.outerRadius, x: ridgeX + cGap + d.thickness / 2 };
  const k = d.coneRise / (d.outerRadius - d.tipRadius);
  const at = rho => ({ rho, x: O.x + (d.outerRadius - rho) * k });
  const s = Object.freeze({ discFrontX, discRearX, plateFrontX, plateRearX, ridgeX, O, k, F: at(d.fulcrumRadius), T: at(d.tipRadius) });
  memo.set(spec, s);
  return s;
}

export function fingerPoint(point, phi, spec = SPEC) {
  const { F } = clutchStack(spec), dr = point.rho - F.rho, dx = point.x - F.x;
  return { rho: F.rho + dr * Math.cos(phi) - dx * Math.sin(phi), x: F.x + dr * Math.sin(phi) + dx * Math.cos(phi) };
}

function bisect(f, target, hi) {   // f increasing on [0, hi]
  let lo = 0;
  for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2; if (f(m) < target) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

export function releaseKin(pedal, spec = SPEC) {
  const c = spec.clutch, st = clutchStack(spec), free = c.releaseBearing.freePlay;
  const plateOf = phi => fingerPoint(st.O, phi, spec).x - st.O.x;
  const tipOf = phi => st.T.x - fingerPoint(st.T, phi, spec).x;
  const phiMax = bisect(plateOf, c.plateLift, Math.PI / 4);
  const tipTravelMax = tipOf(phiMax);
  const p = Math.min(1, Math.max(0, pedal));
  const bearingTravel = p * (free + tipTravelMax);
  const tipTravel = Math.max(0, bearingTravel - free);
  const fingerAngle = tipTravel > 0 ? bisect(tipOf, tipTravel, phiMax) : 0;
  const plateLift = fingerAngle > 0 ? plateOf(fingerAngle) : 0;
  const capacity = Math.min(1, Math.max(0, 1 - plateLift / c.cushionTravel));
  return { bearingTravel, tipTravel, fingerAngle, plateLift, discShift: plateLift / 2, capacity, tipTravelMax };
}

export function bearingFaceX(pedal, spec = SPEC) {
  const rest = clutchStack(spec).T.x + spec.clutch.diaphragm.thickness / 2 + spec.clutch.releaseBearing.freePlay;
  return rest - releaseKin(pedal, spec).bearingTravel;
}
