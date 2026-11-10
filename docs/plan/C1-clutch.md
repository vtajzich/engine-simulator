# Task C1 — flywheel + clutch (`src/model/clutch.js`, test `test/collision/clutch.test.js`)

Follow `docs/plan/MODEL-common.md`. Export `buildClutch(spec = SPEC)`. Kinematics: `src/kin/clutch.js`
(`clutchStack()`, `fingerPoint()`, `releaseKin(pedal)`, `bearingFaceX(pedal)`). Push-type diaphragm clutch:
pressing the pedal moves the release bearing toward the engine (−X); it pushes the diaphragm finger tips forward; the
fingers pivot on the fulcrum ring in the cover; their outer ends move rearward (+X) and let the pressure plate lift off
the disc. Current numbers for orientation (always compute from the kin functions):
flywheel X 361…389; engaged disc faces 389.05 / 397.05; pressure plate 397.1…411.1, ridge top 417.1;
finger centreline: outer end O (ρ 110, x 418.45), fulcrum F (ρ 95, x 421.66), tip T (ρ 26, x 436.45);
full pedal: finger angle 0.1188 rad, tip travel 8.28, bearing travel 9.78 (incl. 1.5 free play), plate lift 1.8;
bearing front face 439.25 (pedal 0) → 429.47 (pedal 1).

## Bodies and parts

### `crank` (shared body) — parts `flywheel` ("Setrvačník") and `clutchCover` ("Štít spojky"); `rotation.x = pose.crank`
- Flywheel: disc from `flywheel.x[0]` to `x[1]`, outer Ø `diameter` including a starter ring gear (`ringGearTeeth`
  simple trapezoid teeth on the rim), flat friction face at X = x[1] between the disc's friction radii, centre hole
  Ø `centreHole`, lightening recess on the engine side optional, bolt circle to the crank flange as décor. castIron/steel.
- Cover (stamped steel shell, LatheGeometry about X): mounting flange on the flywheel rear face at ρ ≈ 124…`cover.outerRadius`,
  cylindrical wall, dished rear wall coming inward to `cover.openingRadius` at X ≈ `cover.rearX`, and the **fulcrum ring**:
  a rounded bead (torus) on the inside of the cover at ρ = `fulcrumRadius` whose front-most point is 0.05 mm behind the
  rear surface of the fingers at F (finger rear surface = centreline + thickness/2). Optionally a second wire ring on the
  flywheel side of the fingers at F (also 0.05 mm clear), held by 9 rivets passing between fingers. The cover must clear the
  fingers over their whole swing and the pressure plate over its lift. `cover.bolts` bolt heads as décor.

### `pressurePlate` — part "Přítlačný kotouč", castIron
Ring `innerDiameter`…`outerDiameter`, thickness per SPEC, friction face toward the disc, annular ridge at
`ridgeRadius` of height `ridgeHeight` on the rear. Rotates with the crank (`rotation.x = pose.crank`) and translates:
`position.x = releaseKin(pedal).plateLift`. 3 drive straps to the cover: visual, `noCollide`.

### `finger01` … `finger18` — parts "Jazýček talířové pružiny" (the diaphragm spring drawn as 18 rigid levers), steelDark
One shared geometry: a flat tapered plate lying along the finger centreline from ρ = `tipRadius` to ρ = `outerRadius`,
thickness `diaphragm.thickness`, tangential width ≈ 0.9 × (2πρ/18) at the outer end tapering to ≈ 0.8 × (2π·26/18)
at the tip. Build it in a local frame whose origin is the fulcrum point F with local +Y = radial outward, local +X = axial.
Scene graph per finger: `spin` group (`rotation.x = pose.crank + k·2π/18`) → `pivot` group at position (F.x, F.ρ, 0)
with `rotation.z = −releaseKin(pedal).fingerAngle` (this reproduces `fingerPoint`; verify numerically in the test) →
mesh. The part group with `userData.part` must be the `pivot` group (so the body anchor moves with the finger).

### `clutchDisc` — part "Spojková lamela"; `rotation.x = pose.input`, `position.x = releaseKin(pedal).discShift`
- two friction ring facings (mat `friction`) between `innerDiameter` and `outerDiameter`, total thickness `thickness`,
  front face at `clutchStack().discFrontX` (engaged);
- thin steel centre plate, hub of length `hubLength` and OD `hubOD` centred on the disc, **smooth bore Ø 25.5** (the
  gearbox input shaft's splined section, Ø 25, passes through with 0.25 mm radial clearance; do not model internal
  spline teeth as collidable geometry);
- `damperSprings` coil springs (short cylinders, axes tangential) in windows at ρ = `damperRadius`, with retaining plates.

### `releaseBearing` — part "Vypínací ložisko", steel; no rotation; `position.x` follows `bearingFaceX(pedal)`
Ring OD `od`, bore Ø `id` (slides on the Ø 36 guide quill built by another module), length `length`; a rounded contact
nose at ρ ≈ 26…30 on its front face that meets the finger tips: at pedal = 0 the gap to the finger front surface is the
free play (≈ 1.5), once the free play is taken up it is ≈ 0 — model the nose so that the nominal gap while pushing is
0.05 mm (derive the exact tip surface position with `fingerPoint`; the tip also moves ≈ 0.5 mm radially).
A rear flange (ρ up to ≈ 34) for the fork.

### `releaseFork` — part "Vypínací vidlice", steelDark
Lever pivoting about a vertical axis (parallel to Y) through a ball stud near the bellhousing wall at Z ≈ +105, X behind
the bearing; two prongs straddle the quill/input shaft (|y| ≈ 24…30, keep ≥ 2 mm from the Ø 36 quill and the bearing
bore) and press on the bearing's rear flange; the arm continues to Z ≈ −95 where the slave cylinder would push.
`rotation.y` = ±asin(bearingTravel / armLength) so the prong pads follow the bearing with a gap of 0.1–0.6 mm.

### `bellhousing` (static, housing) — part "Zvon spojky"
Shell (LatheGeometry about X, wall `bellhousing.wall`) from the block rear face (X = `engine.block.rearX`, inner radius
`frontRadius`) to the gearbox front wall (X = `gearbox.walls.front[0]`, inner radius ≥ `rearRadius`), shaped to clear
the flywheel/ring gear, cover, fork and bearing by ≥ 3 mm everywhere. It is open at both ends. `userData.housing = true`.

## update(pose)
Uses `pose.crank`, `pose.input`, `pose.clutchPedal`.

## Acceptance tests (`test/collision/clutch.test.js`)
1. Sweep pedal 0…1 in 21 steps × crank ∈ {0, 0.37, 1.9} rad × input ∈ {0, 0.5} rad: zero collisions among all bodies
   of this module.
2. Rigidity over the sweep (flywheel and cover share body `crank`).
3. Finger kinematics: for pedal ∈ {0, 0.3, 0.6, 1}, transform the finger's local tip/outer points to world and compare
   with `fingerPoint(T, φ)` / `fingerPoint(O, φ)` (ρ, x) within 1e-6.
4. Direction checks: bearing moves −X with pedal; finger tips −X; pressure plate +X by 1.8 at pedal 1; disc +0.9.
5. Two-sided contact (nominal: no intersection; displaced: intersection):
   - pedal 0: disc pushed 0.3 mm toward the flywheel (−X) hits `crank`; pressure plate pushed −0.3 hits `clutchDisc`;
     pressure plate pushed +0.3 hits a finger (ridge contact); a finger displaced +0.3 in X hits `crank` (fulcrum ring);
   - pedal 0.6 and 1: release bearing pushed −0.3 hits fingers; pressure plate pushed +0.3 hits fingers.
   - pedal 1: `clearanceAlong(disc, crank, −X)` ≈ 0.9 ± 0.15 and `clearanceAlong(pressurePlate → disc, −X)` ≈ 0.9 ± 0.15
     (the disc is free on both sides).
6. Negative controls: fork rotated an extra 6° hits the bearing; cover (body `crank`) vs finger when a finger is
   rotated by −0.12 rad extra (beyond engaged) → intersection with `crank` or `pressurePlate`.
7. Triangle counts logged; module < 200 k triangles; build < 4 s.
