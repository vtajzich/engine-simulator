import * as THREE from 'three';

const AMBER = new THREE.Color(0xff8a1f), BLUE = new THREE.Color(0x4fc3ff);

/** Per-body emphasis without touching shared materials: swaps mesh.material for lazily created clones. */
export function createHighlight(index, onChange) {
  const cache = new Map();
  let flowBodies = new Set(), flowOn = true, focus = null, selected = null, clip = null, tint = null;

  // global section: every material double-sided while it is active, originals restored afterwards
  const baseSide = new Map(index.meshes.map(e => [e.orig, e.orig.side]));
  let double = false;
  const sideFor = (m, clipped, src) => (clipped || double ? THREE.DoubleSide : baseSide.get(src) ?? THREE.FrontSide);

  const SECTION = ['flywheel', 'pilotBearing', 'pressurePlate', 'clutchDisc', 'finger', 'releaseBearing'];
  const sectioned = part => !!clip && SECTION.some(p => part.id.startsWith(p));
  const variant = (orig, kind, clipped) => {
    const key = orig.uuid + kind + (clipped ? 'c' : '');
    let m = cache.get(key);
    if (m) return m;
    m = orig.clone();
    m.userData = { ...m.userData, src: orig, clipped };
    if (clipped) m.clippingPlanes = [clip];
    m.side = sideFor(m, clipped, orig);
    if (kind === 'flow') { m.emissive = AMBER.clone(); m.emissiveIntensity = 0.42; }
    else if (kind === 'sel') { m.emissive = BLUE.clone(); m.emissiveIntensity = 0.7; }
    else if (kind.startsWith('tint:')) { const c = kind.slice(5); m.color.set(c); m.emissive.set(c); m.emissiveIntensity = 0.28; m.metalness = Math.min(m.metalness, 0.5); m.roughness = Math.min(m.roughness, 0.55); }
    else if (kind === 'dim') { m.transparent = true; m.opacity = 0.1; m.depthWrite = false; }
    cache.set(key, m);
    return m;
  };
  const inFocus = e => !focus || (e.body && focus.some(p => e.body.startsWith(p))) || (e.part && focus.some(p => e.part.id.startsWith(p)));

  // tint: [[prefix, '#rrggbb'], ...] matched against the body and the part id; first match wins
  const tintOf = e => { for (const [p, c] of tint) if ((e.body && e.body.startsWith(p)) || e.part.id.startsWith(p)) return c; return null; };

  function apply() {
    for (const e of index.meshes) {
      if (e.housing || e.capShell || e.noCollide || !e.part) continue;   // the cap's opacity belongs to housing.js
      let kind = 'orig';
      if (selected && selected(e.part)) kind = 'sel';
      else if (!inFocus(e)) kind = 'dim';
      else if (tint && tintOf(e)) kind = 'tint:' + tintOf(e);
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
    setDouble(b) {
      double = !!b;
      for (const e of index.meshes) if (!e.housing) { e.orig.side = sideFor(e.orig, false, e.orig); e.orig.needsUpdate = true; }
      for (const m of cache.values()) { m.side = sideFor(m, m.userData.clipped, m.userData.src); m.needsUpdate = true; }
    },
    setTint(map) { tint = map && map.length ? map : null; apply(); },
    materials() { return [...cache.values()]; },
    select(pred) { selected = pred; apply(); },
    setSection(plane) { clip = plane; apply(); },
    get flowOn() { return flowOn; },
  };
}
