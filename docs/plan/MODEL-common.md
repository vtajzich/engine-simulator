# Common rules for all 3D model tasks (B1, B2, C1, C2, C3)

Read in this order: `docs/design.md` (contract — §3 parts/bodies, §4 module interface, §5 pose, §6 clearances),
`src/spec.js` (all dimensions), `docs/plan/A1-kinematics.md` (the kinematics API you must call — implemented in
`src/kin/*`), `docs/plan/D-collision-framework.md` (the collision API in `verify/collide.js`), then your own task file.
`docs/research.md` has the mechanical background if you need to understand a component.

## What you deliver
1. Your model module(s) in `src/model/` (replace the stub, keep the export name/signature) and any reusable geometry
   builders in `src/geo/` that your task file assigns to you.
2. A collision/structure test file `test/collision/<yourModule>.test.js` that builds **only your module**
   (`buildXxx()` directly, add `group` to a root Group, call `update(pose)` then `root.updateMatrixWorld(true)`),
   and proves the acceptance criteria of your task. Run with `npx vitest run test/collision/<yourModule>.test.js`.
3. A final message (≤ 300 words): what you built, body list with triangle counts, test results, every LOCAL override
   (see below), anything you could not make collision-free and why, and interface dimensions other modules rely on.

## Rules
- Only touch the files your task assigns. Never edit `src/spec.js`, `src/kin/*`, `verify/collide.js`, other modules.
- Take every dimension from `SPEC` / `derive()`. Dimensions not in SPEC (fillets, wall thicknesses, decorative
  details) are yours to choose; put them in a `const LOCAL = {…}` block at the top of the module.
  If a SPEC value makes a collision unavoidable, do not silently deviate: add the corrected value to `LOCAL` with a
  comment `// OVERRIDES SPEC.x.y because …` and report it in the final message.
- Geometry is procedural Three.js: `LatheGeometry` (revolves about local Y — rotate it so the axis becomes X with
  `geometry.rotateZ(-Math.PI / 2)`), `ExtrudeGeometry` with `THREE.Shape` + holes, `CylinderGeometry`, `BoxGeometry`,
  `TorusGeometry`, hand-built `BufferGeometry`, `mergeGeometries` from `three/addons/utils/BufferGeometryUtils.js`,
  and CSG with `three-bvh-csg` (`Brush`, `Evaluator`, `SUBTRACTION`, `ADDITION`; call `brush.updateMatrixWorld()`
  before evaluating) for housings that need holes/pockets. Everything must run in Node — no textures, no canvas, no loaders.
- Materials: `mat(name)` from `src/geo/materials.js` (shared instances; do not create your own MeshStandardMaterial
  except where your task says so). Housing meshes: `mat('housing')` and `mesh.userData.housing = true`.
- Parts: `partGroup(id, body, label, extra)` from `src/geo/parts.js`; body names and Czech labels are fixed in
  design.md §3. Put meshes inside the part group. One body = rigid: all its parts must get the same motion in `update`.
- `update(pose)` sets `position` / `rotation` / `quaternion` only (plus material colour/opacity or mesh scale for
  visual-only meshes). It must be a pure function of `pose` and allocation-free where practical. Do not call
  `updateMatrixWorld` inside (the assembly does).
- Segment counts: use `segs(radius)` from `src/geo/parts.js` or more. Running fits: ≥ 0.2 mm radial clearance
  (SPEC gives the MODEL clearances). Touching pairs keep the SPEC gaps (design.md §6).
- Build time for your module < 4 s in Node; keep triangle counts sensible (a gear ≈ 10–25 k, a housing ≤ 60 k).
- Look right: this is an educational model. Proportions and recognisable shapes matter (fillets, webs, bosses where
  cheap), but mechanical correctness and zero collisions come first.

## How to test (pattern)
```js
import * as THREE from 'three';
import { describe, it, expect } from 'vitest';
import { poseAt, poseForGear } from '../../src/kin/pose.js';
import { collectBodies, sweep, formatCollisions, bodiesIntersect, bodiesIntersectDisplaced, snapshotRigidity, rigidityViolations } from '../../verify/collide.js';
import { buildXxx } from '../../src/model/xxx.js';

const mod = buildXxx();
const root = new THREE.Group(); root.add(mod.group);
const assembly = { root, update(p) { mod.update(p); root.updateMatrixWorld(true); } };
assembly.update(poseAt({}));
const bodies = collectBodies(root);
// sweep: const res = sweep(assembly, bodies, poses); expect(res.collisions.size, formatCollisions(res)).toBe(0);
```
Every test file must contain: (1) the full-range sweep(s) with zero collisions, (2) a rigidity check over the sweep
(`snapshotRigidity` / `rigidityViolations`), (3) two-sided contact checks for each touching pair your task lists
(no intersection at nominal, intersection when displaced ≈ 0.3 mm together), (4) the negative controls your task lists
(prove the detector fires), (5) a check that every collidable mesh is attributed to a body listed in design.md §3.
If the kinematics module (`src/kin/*`) or `verify/collide.js` has a bug that blocks you, work around it locally in your
test, and report it precisely — do not edit those files.
