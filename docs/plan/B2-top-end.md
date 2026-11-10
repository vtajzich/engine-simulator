# Task B2 — engine top end (`src/model/topEnd.js`, test `test/collision/topEnd.test.js`)

Follow `docs/plan/MODEL-common.md`. Export `buildTopEnd(spec = SPEC)`. Use `derive()` for every position:
`D.headFaceY` (≈ 215.85), `D.roofApexY`, `D.gamma` (17°), `D.valve.in / D.valve.ex` (`axis`, `seat(cyl, which)`,
`camAxis`, `followerAngle`, `headRadius`, `maxLift`), and `src/kin/cam.js` (`valveLift`, `camAngle`, `lobeOutline`).
Intake side is +Z, exhaust −Z. The cylinder head is a 4-valve pent-roof: the combustion-chamber roof is two planes
meeting at an apex line parallel to X above the cylinder axis; each valve axis is perpendicular to its roof plane.

## Bodies and parts

### `head` (static, housing) — parts `head` ("Hlava válců"), `sparkPlug1..4` ("Zapalovací svíčka n", body `head`, NOT housing), `camCaps` ("Ložiska vačkových hřídelí")
Lower deck by CSG (three-bvh-csg), from Y = block deck (`deckHeight`; the gasket thickness is simply part of the head)
up ≈ 55 mm, X from `block.frontX` to `block.rearX`, Z ≈ ±78. Subtract per cylinder:
- combustion chamber = (cylinder of radius R about the cylinder axis) ∩ (the wedge below the two roof planes), from
  the head face up to the apex. Below `headFaceY` (gasket zone, down to `deckHeight`) subtract a plain bore of radius R.
- 4 valve pockets: cylinder about each valve axis, radius headRadius + 0.3, from the roof plane (seat point) up into
  the head by `headThickness + 0.0` (see valve position below — the closed valve's back face stops `seatGap` short of
  the pocket floor);
- 4 ports: a hole of radius ≈ headRadius − 3 from each pocket floor running up and outward to the side face
  (+Z for intake, −Z for exhaust), e.g. a cylinder tilted ≈ 50–60° from the valve axis; the two ports of a cylinder
  side may merge. They only need to be plausible and must contain the valve stem + tulip without touching.
- 4 valve-guide holes: radius stemDiameter/2 + 0.25 along each valve axis through the remaining material.
- spark-plug hole on the cylinder axis: radius threadDiameter/2 + 0.2 through the roof, widening to a plug well (r ≈ 11) above.
Spark plug (body `head`): threaded shell r = threadDiameter/2 ending `tipProtrusion` below the roof apex, ceramic
insulator, terminal; ground electrode optional.
Cam bearing pedestals/caps (body `head`): 5 per camshaft at X = `crank.mainX`, each a block ≈ 16 mm long in X standing
on the deck with a bore r = camShaftDiameter/2 + 0.2 around the cam axis. Keep the area around the buckets/springs
open so the valvetrain is visible. Deck/pedestals `userData.housing = true`; plugs not.

### `valveIn{c}{a|b}`, `valveEx{c}{a|b}` (c = 1..4; a = which 0 (−X one), b = which 1) — part "Sací ventil" / "Výfukový ventil"
16 bodies. Each part group: origin at `seat(cyl, which)`, oriented so local +Y = valve `axis` (rotation about X by
+γ for intake, −γ for exhaust — verify the sign numerically against `D.valve[kind].axis`).
`update`: `group.position = seat − axis * (seatGap + valveLift(kind, cyl, pose.crank))`.
Geometry in the local frame (LatheGeometry about local Y), all one body:
- valve head: flat face at local y = 0 (in the roof plane), radius headRadius, margin `headThickness`, then a concave
  tulip fillet down to the stem radius over ≈ 10–12 mm; stem to y = `valves.length` (tip). mat `intake` / `exhaust`.
- spring retainer: disc r ≈ 11 a few mm below the tip (steel).
- bucket tappet: inverted cup, OD `bucketDiameter`, height `bucketHeight`, top thickness `bucketTopThickness`; its
  top OUTER face is at local y = `valves.length + bucketTopThickness` (it sits on the stem tip). mat `polished`.
With these definitions the cam base circle clears the bucket by `lash + contactGap` when the valve is closed and by
`contactGap` (0.02) whenever the cam is lifting (that is how `D.valve[kind].camAxis` is defined).
- Valve spring: helix (TubeGeometry) between the deck and the retainer, inside the bucket; separate mesh with
  `noCollide = true`, scaled along local Y in `update` so it compresses with lift (it stays anchored to the deck:
  put it in a non-moving group, or counter-move it).

### `camIn`, `camEx` — parts `camIn` ("Sací vačková hřídel"), `camEx` ("Výfuková vačková hřídel"), plus `camSprocketIn/Ex` ("Řemenice vačky", same bodies)
Group at `(0, camAxis.y, camAxis.z)`, `rotation.x = camAngle(pose.crank)` (= pose.camIn / pose.camEx).
- shaft r = camShaftDiameter/2 from X ≈ `timingDrive.x − width/2 − 3` to ≈ block.rearX − 10.
- 8 lobes per shaft: for each cylinder and `which`, ExtrudeGeometry (depth `lobeWidth`, centred on the valve's X) of the
  closed outline `lobeOutline(kind, cyl)` — outline points are `[y, z]` in the camshaft local frame; build the Shape in
  a 2D plane and orient it so shape-x → local Y and shape-y → local Z (check with a test: the nose direction of
  cylinder 1's intake lobe must equal `lobeCentreAngle('in', 0)`).
- journals (slightly larger r, optional) at the pedestal positions.
- toothed sprocket at X = `timingDrive.x`: `camTeeth` teeth, pitch radius = camTeeth * pitch / (2π).

### `crank` (shared body!) — part `crankSprocket` ("Řemenice klikového hřídele")
Sprocket with `crankTeeth` teeth at X = `timingDrive.x` on the crank axis, bore = crank `noseDiameter` (the crankshaft
nose is built by another module; same body, so overlap is fine). `rotation.x = pose.crank`.

### Visual-only (noCollide) parts
- `belt` ("Rozvodový řemen"): closed loop around the crank sprocket and both cam sprockets (outer tangent lines +
  arcs, i.e. the convex hull of the three pitch circles; add a static tensioner/idler roller on the slack side if you
  like). Flat band (width `timingDrive.width`, thickness ≈ 2) + belt teeth as an InstancedMesh distributed along the
  path; `update` slides the teeth along the path by `pose.crank * pitchRadiusCrank` (mm) so the belt visibly runs in
  the direction that turns the cams the SAME way as the crank. mat `rubber`.
- `gas1..4`: per cylinder a transparent volume filling the chamber: a cylinder of radius R − 0.6 between the piston
  crown (`pistonCrownY(throwAngle(pose.crank, i))` from `src/kin/engine.js`) and the head face (scale a unit-height
  mesh in Y) plus a static pent-roof cap. Each has its own `MeshBasicMaterial({ transparent: true, depthWrite: false })`.
  `update` colours it from `pose.cylinders[i]` (`phase`, `burn`, `pBar`):
  intake `#5fb3ff` α 0.22; compression `#5fb3ff → #8f6bff`, α 0.22 → 0.5 with pressure; combustion `#fff1a8 → #ff7a1a`
  with burn, α 0.8; expansion `#ff7a1a → #7a2b12`, α 0.6 → 0.3 as pressure falls; exhaust `#8d8d8d` α 0.3.
- `spark1..4`: small emissive sphere at the plug tip, visible only while `pose.cylinders[i].spark` is true.
If `pose.cylinders` is missing, hide gas and sparks (do not throw).

## Acceptance tests (`test/collision/topEnd.test.js`)
1. Sweep crank 0…720° in 2° steps: zero collisions among `head`, `camIn`, `camEx`, all 16 valve bodies (and the
   `crank` body's sprocket).
2. Rigidity over the sweep.
3. Kinematic checks from the scene: each valve group's displacement along its axis equals
   `seatGap + valveLift(...)` (sample 72 angles); at ψ = 474° (cyl 1 → crank 474°) the intake valves of cylinder 1 are
   at max lift; cams turn at half crank speed in the crank direction; lobe nose direction test described above.
4. Two-sided contact, for every valve body at crank = 0…720 step 30: displaced +0.30 mm along its axis (toward the cam)
   it must intersect its camshaft (cam–bucket gap is ≤ lash + contactGap = 0.22); displaced +0.30 mm along its axis it
   must also intersect `head` when the valve is closed (seat contact; gap = seatGap) — nominal position: no intersection.
5. Negative controls: `camIn` rotated by 90° about its axis (valves left in place) intersects an intake valve body;
   a closed valve displaced 1.5 mm sideways (X) intersects `head`.
6. Report with `clearanceAlong`: minimum over the sweep of the distance between the intake and exhaust valve heads of
   cylinder 1 (probe one toward the other), expect > 0.5 mm.
7. Log triangle counts; module < 350 k triangles; build < 6 s (CSG).
