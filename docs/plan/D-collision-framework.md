# Task D — collision framework (`verify/collide.js`) + self-tests (`test/collision/framework.test.js`)

Read first: `docs/design.md` (§3 parts/bodies, §6 clearances, §7 pipeline). You build the reusable 3D collision checker
that all model sweeps will use. It runs in Node (vitest), using `three` and `three-mesh-bvh` only. Do not touch other
files. The real model modules are still stubs — test the framework with small synthetic assemblies you build inside the
test file (boxes, cylinders, two procedural gears if you like).

Known-good facts from a spike: `new MeshBVH(geometry)` works in Node; `bvhA.intersectsGeometry(geometryB, matrixBtoA)`
returns true when triangles intersect (`matrixBtoA = inverse(worldA) * worldB`); set `geometryB.boundsTree` too for speed.
Use the option name `targetLeafSize`? No — just use the MeshBVH defaults (do not pass `maxLeafSize`, it is deprecated).

## API (`verify/collide.js`)

```js
/** Collect rigid bodies from an assembly root (after assembly.update(pose) so matrixWorld is valid).
 *  Walk the tree; a Mesh belongs to the nearest ancestor (or itself) that has userData.part; its body = part.body.
 *  Skip meshes with userData.noCollide === true, invisible-by-design meshes are NOT skipped.
 *  For each body: merge all its meshes into ONE BufferGeometry expressed in the local frame of the body's first part
 *  group (the "anchor"), positions only, indexed or non-indexed → build MeshBVH once. Cache the result.
 *  Returns Map<bodyName, Body>, Body = { name, static, anchor: Object3D, geometry, bvh, partIds: string[],
 *  localBox: Box3, triangleCount }.
 *  Throws if a mesh has no part ancestor (every collidable mesh must be attributed), or if two parts of one body
 *  disagree on `static`. */
export function collectBodies(root)

/** Verify the "parts of one body move identically" rule: call once after collectBodies, then again after a different
 *  pose: returns list of part ids whose transform relative to the body anchor changed (> 1e-6). */
export function snapshotRigidity(root)            // → Map partId → Matrix4 (anchor⁻¹ · part world)
export function rigidityViolations(root, snapshot) // → [{ partId, body }]

/** All colliding pairs in the current pose. Requires root.updateMatrixWorld(true) to have been called.
 *  - broad phase: world-space AABB (localBox transformed by anchor.matrixWorld) overlap
 *  - narrow phase: bvh.intersectsGeometry
 *  - skips static–static pairs and any pair for which options.ignore(a, b) returns true (called with names in
 *    alphabetical order)
 *  - options.only: optional (a, b) => bool filter to restrict to interesting pairs (speed)
 *  Returns [{ a, b }] with a < b alphabetically. */
export function findCollisions(bodies, options = {})

/** True if the two named bodies intersect in the current pose (no broad-phase shortcut needed, but allowed). */
export function bodiesIntersect(bodies, a, b)

/** Like bodiesIntersect, but with body `a` displaced by the world-space translation vector `offset` (THREE.Vector3)
 *  and/or rotated by `angle` radians about the world-space axis through `axisPoint` with direction `axisDir`
 *  (both optional). Does not modify the scene. Used for two-sided contact tests and clearance probing. */
export function bodiesIntersectDisplaced(bodies, a, b, { offset, angle, axisPoint, axisDir } = {})

/** Clearance of body `a` from body `b` along a world direction: the smallest distance t ∈ [0, max] such that
 *  translating `a` by t * dir makes them intersect; found by bisection to `tol` (default 0.01 mm) after stepping
 *  in `step` (default 0.25 mm) increments. Returns Infinity if no intersection up to `max` (default 20 mm),
 *  0 if they already intersect. */
export function clearanceAlong(bodies, a, b, dir, { max, step, tol } = {})

/** Helper for sweeps: for each pose from the iterable `poses` (objects { label, pose }), call assembly.update(pose),
 *  run findCollisions, and accumulate. Returns { samples, collisions: Map<"a|b", { a, b, count, first: label,
 *  labels: string[] (max 5) }> }. */
export function sweep(assembly, bodies, poses, options = {})

/** Human-readable report of a sweep result (for assertion messages). */
export function formatCollisions(result)
```

Implementation notes
- Merge geometry: for each mesh, clone `geometry`, drop every attribute except `position`, `applyMatrix4(anchorWorld⁻¹ ·
  meshWorld)` evaluated at collection time, convert to non-indexed (`toNonIndexed()`) and concatenate the Float32Arrays
  into one non-indexed BufferGeometry (simplest and robust; avoid BufferGeometryUtils' attribute-compatibility checks).
  InstancedMesh: expand every instance. Skip `Line`, `Points`, `Sprite`.
- Because bodies are rigid and their internal layout is frozen at collection time, `collectBodies` must be called while
  the assembly is in any valid pose; the rigidity check catches modules that violate the rule.
- Performance target: a full `findCollisions` over ~90 bodies / ~1 M triangles should take well under 150 ms when few
  AABBs overlap. Pre-allocate matrices/boxes; do not rebuild BVHs per pose.
- Degenerate (zero-area) triangles must not crash the BVH build — filter them out when merging.

## Self-tests (`test/collision/framework.test.js`) — must pass

Build synthetic assemblies with `partGroup` from `src/geo/parts.js`:
1. Two separated boxes → no collision; overlapping boxes → collision reported with alphabetical names.
2. Touching-but-separated-by-0.05 mm boxes → no collision; `bodiesIntersectDisplaced` by 0.3 mm toward → true;
   `clearanceAlong` returns 0.05 ± 0.02.
3. A cylinder (shaft, r = 10, 48 segments) rotating inside a tube (inner r = 10.2, built as a LatheGeometry ring or
   ExtrudeGeometry with hole) → no collision at 24 rotation angles; with inner r = 9.9 → collision.
4. Two parts with the same body overlapping each other → not reported. Two static bodies overlapping → not reported.
5. A mesh flagged `noCollide` overlapping another body → not reported. A mesh without any part ancestor → throws.
6. Rigidity: move one part of a two-part body relative to the other → `rigidityViolations` lists it.
7. `sweep` over 10 poses of a synthetic assembly whose `update(pose)` slides a box into another: collision count and
   `first` label are correct.
8. InstancedMesh with 3 instances: only the instance that overlaps is detected (i.e. instances are expanded).
9. Timing smoke test: 60 bodies of ~10 k triangles each (e.g. TorusKnotGeometry) placed apart with a handful
   overlapping → `findCollisions` finishes < 500 ms after collection and finds exactly the overlapping pairs.

Final message: API summary as implemented (any deviation from this document must be listed explicitly), test results,
and measured timings.
