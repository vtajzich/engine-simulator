import * as THREE from 'three';

// Parts that behave like housings in every display mode (ghost / cut / solid / hidden). They share a material with other
// steel parts, so their meshes get a private material instance.
const SHELL_PARTS = ['clutchCover'];

/** Walk the assembly once and index meshes and parts (guards against stub/empty modules). */
export function indexModel(assembly) {
  const meshes = [];          // { mesh, part, body, housing, noCollide, orig }
  const parts = new Map();    // id -> Group
  const capShells = [];       // distributor cap shells: transparent in every mode but solid
  assembly.root.traverse(o => {
    if (o.userData?.part) parts.set(o.userData.part.id, o);
    if (!o.isMesh) return;
    let p = o, part = null;
    while (p) { if (p.userData?.part) { part = p.userData.part; break; } p = p.parent; }
    if (part && SHELL_PARTS.includes(part.id) && !o.userData.noCollide) {
      o.material = o.material.clone();
      // seen from inside (through a section) the shell is dark, so gaps between the clutch parts read as gaps
      o.material.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', 'gl_FragColor.rgb *= gl_FrontFacing ? 1.0 : 0.12;\n#include <dithering_fragment>'); };
      o.material.customProgramCacheKey = () => 'shellDark';
      o.userData.housing = true;
    }
    if (o.userData.capShell) { o.material = o.material.clone(); capShells.push(o); }   // display rule set by housing.js
    meshes.push({
      mesh: o, part, body: part?.body ?? null,
      housing: !!o.userData.housing, capShell: !!o.userData.capShell, noCollide: !!o.userData.noCollide, orig: o.material,
    });
  });
  const housingMaterials = new Set();
  for (const m of meshes) if (m.housing) housingMaterials.add(m.mesh.material);
  const triangles = meshes.reduce((n, m) => {
    const g = m.mesh.geometry; return n + (g.index ? g.index.count : g.attributes.position.count) / 3;
  }, 0);
  return { meshes, parts, housingMaterials, capShells, triangles };
}

const box = new THREE.Box3();
export function partCentre(group, out = new THREE.Vector3()) {
  box.setFromObject(group);
  if (box.isEmpty()) return null;
  return box.getCenter(out);
}
