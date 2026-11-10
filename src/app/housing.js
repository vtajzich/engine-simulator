import * as THREE from 'three';

/** Display modes for meshes flagged userData.housing: ghost | cut | solid | hidden. */
export function createHousing(index, onChange) {
  // keeps the +Z half removed (Z <= 0 stays): the default camera looks from +Z
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
  let mode = 'solid', forceDouble = false, tint = null;
  const shellTint = new Map();          // material -> original { color, emissive, metalness }
  function applyTint() {
    for (const e of index.meshes) {
      if (!e.housing || !e.part || e.part.id !== 'clutchCover') continue;
      const m = e.mesh.material;
      if (!shellTint.has(m)) shellTint.set(m, { color: m.color.clone(), emissive: m.emissive.clone(), ei: m.emissiveIntensity, metalness: m.metalness });
      const o = shellTint.get(m);
      if (tint == null) { m.color.copy(o.color); m.emissive.copy(o.emissive); m.emissiveIntensity = o.ei; m.metalness = o.metalness; }
      else { m.color.set(tint); m.emissive.set(tint); m.emissiveIntensity = 0.3; m.metalness = 0.45; }
    }
  }
  function set(next) {
    mode = next;
    for (const m of index.housingMaterials) {
      m.transparent = mode === 'ghost';
      m.opacity = mode === 'ghost' ? 0.14 : 1;
      m.depthWrite = mode !== 'ghost';
      m.side = mode === 'cut' || forceDouble ? THREE.DoubleSide : THREE.FrontSide;
      m.clippingPlanes = mode === 'cut' ? [plane] : null;
      m.needsUpdate = true;
    }
    // the distributor cap is never hidden or clipped: opaque when solid, otherwise see-through so the rotor shows
    for (const c of index.capShells) {
      const m = c.material, solid = mode === 'solid';
      m.transparent = !solid; m.opacity = solid ? 1 : 0.22; m.depthWrite = solid; m.needsUpdate = true;
    }
    for (const e of index.meshes) if (e.housing) e.mesh.visible = mode !== 'hidden';
    onChange?.();
  }
  return {
    set, plane, get mode() { return mode; },
    /** while a global section is active every material is double-sided */
    setForceDouble(b) { forceDouble = !!b; set(mode); },
    /** colour for the clutch cover (a shell part the highlighter does not touch); null restores it */
    setShellTint(c) { tint = c; applyTint(); },
  };
}
