import * as THREE from 'three';

/** Walk the assembly once and index meshes and parts (guards against stub/empty modules). */
export function indexModel(assembly) {
  const meshes = [];          // { mesh, part, body, housing, noCollide, orig }
  const parts = new Map();    // id -> Group
  assembly.root.traverse(o => {
    if (o.userData?.part) parts.set(o.userData.part.id, o);
    if (!o.isMesh) return;
    let p = o, part = null;
    while (p) { if (p.userData?.part) { part = p.userData.part; break; } p = p.parent; }
    meshes.push({
      mesh: o, part, body: part?.body ?? null,
      housing: !!o.userData.housing, noCollide: !!o.userData.noCollide, orig: o.material,
    });
  });
  const housingMaterials = new Set();
  for (const m of meshes) if (m.housing) housingMaterials.add(m.mesh.material);
  const triangles = meshes.reduce((n, m) => {
    const g = m.mesh.geometry; return n + (g.index ? g.index.count : g.attributes.position.count) / 3;
  }, 0);
  return { meshes, parts, housingMaterials, triangles };
}

const box = new THREE.Box3();
export function partCentre(group, out = new THREE.Vector3()) {
  box.setFromObject(group);
  if (box.isEmpty()) return null;
  return box.getCenter(out);
}
