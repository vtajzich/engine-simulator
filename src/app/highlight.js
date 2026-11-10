import * as THREE from 'three';

const AMBER = new THREE.Color(0xff8a1f), BLUE = new THREE.Color(0x4fc3ff);

/** Per-body emphasis without touching shared materials: swaps mesh.material for lazily created clones. */
export function createHighlight(index, onChange) {
  const cache = new Map();
  let flowBodies = new Set(), flowOn = true, focus = null, selected = null, clip = null;

  const SECTION = ['flywheel', 'clutchCover', 'pressurePlate', 'clutchDisc', 'finger', 'releaseBearing'];
  const sectioned = part => !!clip && SECTION.some(p => part.id.startsWith(p));
  const variant = (orig, kind, clipped) => {
    const key = orig.uuid + kind + (clipped ? 'c' : '');
    let m = cache.get(key);
    if (m) return m;
    m = orig.clone();
    if (clipped) { m.clippingPlanes = [clip]; m.side = THREE.DoubleSide; }
    if (kind === 'flow') { m.emissive = AMBER.clone(); m.emissiveIntensity = 0.42; }
    else if (kind === 'sel') { m.emissive = BLUE.clone(); m.emissiveIntensity = 0.7; }
    else if (kind === 'dim') { m.transparent = true; m.opacity = 0.1; m.depthWrite = false; }
    cache.set(key, m);
    return m;
  };
  const inFocus = e => !focus || (e.body && focus.some(p => e.body.startsWith(p))) || (e.part && focus.some(p => e.part.id.startsWith(p)));

  function apply() {
    for (const e of index.meshes) {
      if (e.housing || e.noCollide || !e.part) continue;
      let kind = 'orig';
      if (selected && selected(e.part)) kind = 'sel';
      else if (!inFocus(e)) kind = 'dim';
      else if (flowOn && e.body && flowBodies.has(e.body)) kind = 'flow';
      const clipped = sectioned(e.part);
      const mat = kind === 'orig' && !clipped ? e.orig : variant(e.orig, kind, clipped);
      if (e.mesh.material !== mat) e.mesh.material = mat;
    }
    onChange?.();
  }
  let flowKey = '';
  return {
    apply,
    setFlow(set) {
      const key = [...set].sort().join(',');
      if (key === flowKey) return;
      flowKey = key; flowBodies = new Set(set); if (flowOn) apply();
    },
    setFlowOn(b) { flowOn = b; apply(); },
    setFocus(list) { focus = list && list.length ? list : null; apply(); },
    select(pred) { selected = pred; apply(); },
    setSection(plane) { clip = plane; apply(); },
    get flowOn() { return flowOn; },
  };
}
