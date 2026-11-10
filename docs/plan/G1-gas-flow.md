# Task G1 — gas-exchange animation: intake charge, ignition and flame, exhaust (`src/model/topEnd.js`, `src/geo/top*.js`)

Context: `docs/design.md` (§3 parts, §4 `update(pose)` must be a PURE function of the pose — no time, no state carried
between calls, so that pausing and scrubbing the crank shows a consistent picture and Node tests work),
`docs/plan/B2-top-end.md` (the module you are extending), `src/kin/engine.js` (`gasState`, `cylinderVolume`,
`pistonCrownY`, `throwAngle`), `src/kin/cam.js` (`valveLift`), `src/kin/derive.js`.
Only touch `src/model/topEnd.js`, `src/geo/top*.js` and `test/collision/topEnd.test.js`. Everything you add is
visual-only (`mesh.userData.noCollide = true`) except the two manifold stubs in §4. Must run in Node (no DOM/textures).

Goal: the user wants to SEE the mixture being drawn in, the ignition, and the burnt gas being pushed out. Today a
cylinder only shows a tinted volume and a small spark sphere.

## 1. Charge particles inside each cylinder (the main effect)
Per cylinder an `InstancedMesh` of M ≈ 140 small spheres (r ≈ 1.3 mm, low-poly) placed inside the existing part group
`gas{n}` (so the app's "Plyn" toggle and picking exclusion keep working). Each particle k has fixed deterministic
normalised coordinates (ρ_k, φ_k, h_k) from a seeded low-discrepancy sequence (no Math.random): radius ρ_k·(R − 2),
angle φ_k, and height fraction h_k ∈ (0, 1) between the piston crown and the chamber roof at that (x, z)
(roof height = head face + pent-roof height at z; crown from `pistonCrownY`). As the piston moves, the cloud compresses
and expands with the real volume — density visibly rises during compression.
Per-instance colour (`instanceColor`) and visibility (scale 0 to hide) from the cylinder's cycle angle ψ and gas state:
- intake (intake valve lift > 0 … BDC … IVC): particles appear progressively: particle k is visible when
  `k/M < inducted`, `inducted = clamp((V(ψ) − Vc) / Vd, 0, 1)` rising from 0 to 1 over the intake stroke and staying 1;
  order them so that those nearest the intake valves appear first. Colour fresh-charge blue `#58b4ff`.
- compression: all visible, colour blends blue → violet `#9a7bff` with pressure.
- combustion: flame front spreading from the spark-plug tip: particle k has burned when its distance from the plug tip
  (in the current compressed geometry) < `Rf = burn^(1/3) * (distance of the farthest particle)`; burned particles
  are bright yellow-white at the front fading to orange `#ff7a1a` behind it; unburned stay violet.
- expansion: orange → dark red `#7a2b12` as pressure falls.
- exhaust (EVO … TDC … EVC): colour grey-brown `#8d8477`; particles disappear progressively:
  visible when `k'/M < remaining`, `remaining = clamp((V(ψ) − Vc) / Vd, 0, 1)` during the exhaust stroke with an extra
  quick drop of ≈ 35 % during blow-down right after EVO (while the piston is still near BDC) — order so that those
  nearest the exhaust valves leave last… or first, whichever reads better; state your choice.
Keep the existing tinted volume but lower its opacity (≈ 40 % of the current values) so the particles read clearly.

## 2. Port streams
Per cylinder and per port (2 intake, 2 exhaust) an InstancedMesh stream of ≈ 14 particles moving along a polyline
through the manifold stub and the port, around the valve stem and through the open valve curtain into (out of) the
cylinder. Particle position = point on the path at parameter `frac(j/N + phase)`, where `phase` is a pure function
of ψ: for intake `phase = 3 * inducted(ψ)`, for exhaust `phase = 3 * (1 − remaining(ψ))` (so the particles advance
with the volume actually moved, fast at mid-stroke, slow near the dead centres, and in the right direction: intake
from the +Z side inward and down, exhaust from the cylinder outward to −Z). A stream is visible only while its valve
lift > 0.3 mm, with opacity/size ramping with lift (min(1, lift / 2)). Intake stream colour `#58b4ff`, exhaust
`#8d8477` (hotter orange-grey `#c9703a` during blow-down). Paths must run inside the real port holes of the head
(derive them from the same numbers that cut the ports) and pass the valve head through the annular gap between head
and seat on the side toward the cylinder centre and outward — not through the valve head.

## 3. Ignition
At the plug tip: while `pose.cylinders[i].spark` is true show a bright spark (emissive sphere ≈ 3 mm plus a small
star/cross of thin boxes), and during combustion (burn in (0.02, 0.98)) a soft glow sphere (transparent, additive
blending if available in MeshBasicMaterial via `blending: THREE.AdditiveBlending`, `depthWrite: false`) whose radius
follows the flame front `Rf`, clipped visually by keeping it ≤ the distance to the piston crown. Put them in the
existing `spark{n}` parts. Optional: one `PointLight` per cylinder (intensity from burn, zero otherwise) — only if it
does not break running in Node; keep it cheap (4 lights max).

## 4. Manifold stubs (real geometry, static, body `head`, housing = true)
Short intake runners on the +Z face of the head and exhaust stubs on the −Z face: one tube per port (or one per
cylinder merging its two ports), ≈ 60 mm long, wall ≈ 2.5 mm, continuing the port direction, open at the outer end,
parts `intakeManifold` ("Sací potrubí") and `exhaustManifold` ("Výfukové potrubí"). They give the streams a visible
origin/destination. They are static like the head, so they cannot collide with it; make sure nothing moving comes near.

## 5. Behaviour contract
- Pure function of `pose` (`pose.crank`, `pose.cylinders[i]`); if `pose.cylinders` is missing hide all gas visuals.
- When a cylinder's state has `burn = 0`, `spark = false` (engine off) the combustion effects must not show, but
  intake/exhaust motion still follows the piston and valves (an engine being turned over still pumps air).
- No allocations per frame; update instance matrices/colours in place; set `instanceMatrix.needsUpdate` /
  `instanceColor.needsUpdate`.
- Total added cost: ≤ 1500 instances, ≤ 60 k triangles drawn.

## 6. Tests (extend `test/collision/topEnd.test.js`, keep everything green)
- Purity: call `update(poseA)`, snapshot all gas instance matrices/colours; `update(poseB)`; `update(poseA)` again →
  identical snapshot.
- Phase logic for cylinder 1 (firing TDC at crank 0): at ψ = 450 (mid intake) some but not all charge particles are
  visible and intake streams are visible, exhaust streams hidden; at ψ = 630 (mid compression) all M visible, no
  streams; at ψ = 20 with burn > 0 at least one particle is "burned" colour and the nearest-to-plug particle burned
  before the farthest; at ψ = 270 (mid exhaust) exhaust streams visible and fewer than M particles visible;
  at ψ = 365 (overlap) both stream kinds visible.
- Containment: every visible charge particle centre lies inside the cylinder (radius < R) and between the piston crown
  and the roof, for ψ = 0…720 step 15.
- Direction: over ψ = 380…520 the mean Z of a tracked intake-stream particle decreases toward the cylinder and its Y
  ends below the valve seat; for exhaust over ψ = 200…340 a tracked particle moves toward −Z.
- The existing collision sweep still passes (new solids are static).
Also render nothing in Node; visual check is done later in the browser by another task. Run only
`npx vitest run test/collision/topEnd.test.js`.

Final message (≤ 250 words): what you built, instance/triangle counts, test results, the ordering choices you made,
the exact part ids and any mesh `name`s the app could use, and where the port-stream paths start/end (coordinates) so a
camera can be framed on them.
