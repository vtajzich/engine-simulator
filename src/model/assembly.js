import * as THREE from 'three';
import { SPEC } from '../spec.js';
import { buildBottomEnd } from './bottomEnd.js';
import { buildTopEnd } from './topEnd.js';
import { buildClutch } from './clutch.js';
import { buildGearbox } from './gearbox.js';
import { buildShift } from './shift.js';

/** Build the whole model. Runs in Node (no DOM) and in the browser. See docs/design.md §4. */
export function buildAssembly(spec = SPEC) {
  const root = new THREE.Group();
  root.name = 'assembly';
  const modules = {
    bottomEnd: buildBottomEnd(spec),
    topEnd: buildTopEnd(spec),
    clutch: buildClutch(spec),
    gearbox: buildGearbox(spec),
    shift: buildShift(spec),
  };
  for (const m of Object.values(modules)) root.add(m.group);
  return {
    root,
    modules,
    update(pose) {
      for (const m of Object.values(modules)) m.update(pose);
      root.updateMatrixWorld(true);
    },
  };
}
