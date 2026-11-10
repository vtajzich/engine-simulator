import * as THREE from 'three';

/**
 * Solid cut faces ("caps") for the clutch parts when a housing is shown as a section: a clipped closed mesh would otherwise
 * be hollow and its far interior would show through. Classic stencil technique: per mesh, back faces increment and front faces
 * decrement a stencil counter (only the part behind the clipping plane counts); a plane drawn at the cut fills where the counter
 * is non-zero. Needs a stencil buffer (renderer created with stencil: true).
 */
const CAP_PARTS = ['flywheel', 'clutchCover', 'pressurePlate', 'clutchDisc', 'finger', 'releaseBearing'];

export function createCaps({ index, scene, plane, onChange }) {
  const stencil = (side, op) => new THREE.MeshBasicMaterial({
    side, colorWrite: false, depthWrite: false, depthTest: false, clippingPlanes: [plane],
    stencilWrite: true, stencilFunc: THREE.AlwaysStencilFunc, stencilFail: op, stencilZFail: op, stencilZPass: op,
  });
  const backMat = stencil(THREE.BackSide, THREE.IncrementWrapStencilOp);
  const frontMat = stencil(THREE.FrontSide, THREE.DecrementWrapStencilOp);
  const planeGeo = new THREE.PlaneGeometry(700, 700);
  const items = [];
  let active = false, n = 0;

  for (const e of index.meshes) {
    if (!e.part || e.noCollide || !CAP_PARTS.some(p => e.part.id.startsWith(p))) continue;
    const order = -3000 + (n++) * 3;
    const back = new THREE.Mesh(e.mesh.geometry, backMat), front = new THREE.Mesh(e.mesh.geometry, frontMat);
    back.renderOrder = front.renderOrder = order;
    back.frustumCulled = front.frustumCulled = false;
    e.mesh.add(back, front);
    const capMat = new THREE.MeshBasicMaterial({
      color: 0xcccccc, toneMapped: false,
      stencilWrite: true, stencilRef: 0, stencilFunc: THREE.NotEqualStencilFunc,
      stencilFail: THREE.ReplaceStencilOp, stencilZFail: THREE.ReplaceStencilOp, stencilZPass: THREE.ReplaceStencilOp,
    });
    const cap = new THREE.Mesh(planeGeo, capMat);
    cap.position.set(420, 0, 0);               // the plane z = 0, around the clutch
    cap.renderOrder = order + 1;
    cap.frustumCulled = false;
    cap.onAfterRender = r => r.clearStencil();
    scene.scene.add(cap);
    items.push({ e, back, front, cap, capMat });
  }

  function refresh() {
    for (const it of items) { it.back.visible = it.front.visible = it.cap.visible = active; }
    onChange?.();
  }
  refresh();

  return {
    /** show caps only while the housing is shown as a section */
    setActive(b) { active = !!b; refresh(); },
    /** colour caps like the tinted part (tint = [[prefix, '#rrggbb'], ...]) or like its own material */
    setTint(tint) {
      for (const it of items) {
        let c = null;
        for (const [p, col] of tint ?? []) if ((it.e.body && it.e.body.startsWith(p)) || it.e.part.id.startsWith(p)) { c = col; break; }
        it.capMat.color.set(c ?? '#' + it.e.orig.color.clone().multiplyScalar(1.6).getHexString());
      }
      onChange?.();
    },
  };
}
