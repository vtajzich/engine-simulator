import * as THREE from 'three';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const visibleChain = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };

/** Hover tooltip + click selection. BVHs are built lazily in small time slices after load. */
export function createPicking({ index, scene, host, housing, onSelect }) {
  const { camera, canvas } = scene;
  const ray = new THREE.Raycaster();
  ray.firstHitOnly = true;
  const ndc = new THREE.Vector2();
  const tip = document.createElement('div');
  tip.id = 'tooltip';
  host.appendChild(tip);

  // time-sliced BVH construction
  const todo = [...new Set(index.meshes.filter(e => !e.noCollide && e.part).map(e => e.mesh.geometry))];
  let bvhDone = false;
  (function slice() {
    const t0 = performance.now();
    while (todo.length && performance.now() - t0 < 12) {
      const g = todo.pop();
      try { g.computeBoundsTree({ indirect: true }); } catch { /* fall back to plain raycast */ }
    }
    if (todo.length) setTimeout(slice, 8); else bvhDone = true;
  })();

  function pickable() {
    const out = [];
    for (const e of index.meshes) {
      if (e.noCollide || !e.part) continue;
      if (e.housing && housing.mode === 'ghost') continue;
      if (visibleChain(e.mesh)) out.push(e.mesh);
    }
    return out;
  }
  function pick(ev) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(pickable(), false);
    for (const h of hits) {
      // respect the cut plane: ignore hits on the removed half of a cut housing
      if (housing.mode === 'cut' && h.object.material.clippingPlanes?.length && h.point.z > 0) continue;
      let p = h.object;
      while (p && !p.userData?.part) p = p.parent;
      if (p) return p.userData.part;
    }
    return null;
  }

  let last = 0, down = null;
  canvas.addEventListener('pointermove', ev => {
    const now = performance.now();
    if (ev.buttons) { tip.style.display = 'none'; return; }
    if (now - last < (bvhDone ? 40 : 160)) return;
    last = now;
    const part = pick(ev);
    if (!part) { tip.style.display = 'none'; canvas.style.cursor = ''; return; }
    const r = host.getBoundingClientRect();
    tip.textContent = part.label;
    tip.style.display = 'block';
    tip.style.left = Math.min(ev.clientX - r.left + 14, r.width - tip.offsetWidth - 6) + 'px';
    tip.style.top = (ev.clientY - r.top + 16) + 'px';
    canvas.style.cursor = 'pointer';
  });
  canvas.addEventListener('pointerleave', () => { tip.style.display = 'none'; });
  canvas.addEventListener('pointerdown', ev => { down = { x: ev.clientX, y: ev.clientY }; });
  canvas.addEventListener('pointerup', ev => {
    if (!down || Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 4) { down = null; return; }
    down = null;
    onSelect(pick(ev));
  });
  return { pick };
}
