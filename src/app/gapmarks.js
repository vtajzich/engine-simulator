import * as THREE from 'three';
import { SPEC } from '../spec.js';
import { releaseKin } from '../kin/clutch.js';
import { ui, num } from './content/index.js';

/** Dimension labels for the two friction gaps (flywheel–disc, disc–pressure plate) in the clutch detail view. */
export function createGapMarks({ scene, host }) {
  const mk = cls => { const e = document.createElement('div'); e.className = 'gapmark ' + cls; host.appendChild(e); return e; };
  const els = [mk('l'), mk('r')];
  const v = new THREE.Vector3();
  const c = SPEC.clutch, fmt = x => num(x, 2) + ' mm';
  return {
    update(on, pedal) {
      els.forEach(e => { e.style.display = on ? 'block' : 'none'; });
      if (!on) return;
      const k = releaseKin(pedal);
      const f = c.flywheel.x[1], d0 = f + c.faceGap + k.discShift, d1 = d0 + c.disc.thickness;
      const gaps = [[f, d0], [d1, f + c.faceGap + c.disc.thickness + c.faceGap + k.plateLift]];
      const w = host.clientWidth, h = host.clientHeight;
      gaps.forEach(([a, b], i) => {
        v.set((a + b) / 2, 74, 0).project(scene.camera);
        els[i].style.left = ((v.x * 0.5 + 0.5) * w) + 'px';
        els[i].style.top = ((-v.y * 0.5 + 0.5) * h) + 'px';
        els[i].textContent = ui.gapMark + fmt(b - a);
      });
    },
  };
}
