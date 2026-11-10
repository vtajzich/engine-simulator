import * as THREE from 'three';

/** Display modes for meshes flagged userData.housing: ghost | cut | solid | hidden. */
export function createHousing(index, onChange) {
  // keeps the +Z half removed (Z <= 0 stays): the default camera looks from +Z
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
  let mode = 'solid';
  function set(next) {
    mode = next;
    for (const m of index.housingMaterials) {
      m.transparent = mode === 'ghost';
      m.opacity = mode === 'ghost' ? 0.14 : 1;
      m.depthWrite = mode !== 'ghost';
      m.side = mode === 'cut' ? THREE.DoubleSide : THREE.FrontSide;
      m.clippingPlanes = mode === 'cut' ? [plane] : null;
      m.needsUpdate = true;
    }
    for (const e of index.meshes) if (e.housing) e.mesh.visible = mode !== 'hidden';
    onChange?.();
  }
  return { set, plane, get mode() { return mode; } };
}
