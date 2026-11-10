# Task C3 — shift mechanism + gearbox case (`src/model/shift.js`, test `test/collision/shift.test.js`)

Follow `docs/plan/MODEL-common.md`. Export `buildShift(spec = SPEC)`. Another agent builds the rotating gearbox parts
(`src/model/gearbox.js`, task `docs/plan/C2-gearbox.md` — read it for the layout); you build everything that is fixed
or belongs to the shift linkage. Use `derive()` (`D.gearbox.counterAxis`, `idlerAxis`, gear radii `ra`) and SPEC.

## Interface with the gearbox module (do not deviate)
- Sleeves: outer radius 44, width 20, centred at `hub.x + pose.sleeves.sNN`; fork groove centred on the sleeve,
  8 mm wide, floor radius 40.
- Shaft diameters inside the wall X ranges: input shaft Ø 25 (front wall), mainshaft Ø 30 (centre and rear walls),
  countershaft Ø 32 (all three walls; the countershaft ends at the outer faces of the front and rear walls).
- Reverse idler: spur gear, tip radius `D.gearbox.gears['rev.idler'].ra` (24), 12 mm wide, at `idlerAxis`,
  X range `reverse.idlerNeutralX` shifted by `pose.idlerX` (−9.5 in reverse, 0 in neutral, and +9.5 when 5th is
  engaged because the idler fork is rigid on the 5th/reverse rail: `pose.idlerX` then follows `pose.sleeves.s5`); bore Ø 16.4.
- Largest rotating radii to clear (around the main axis unless noted): sleeves 44, gear1 tip 55.9, reverse gear 52,
  hubs 35.5; around the countershaft axis: c5 tip 50.2, input counter gear 45.5.
- Release bearing (other module) slides on your quill: quill OD 36, bore Ø 28, from the front wall forward to `clutch.quill.frontX`.

## Bodies and parts

### `gearCase` (static, housing) — parts `gearCase` ("Skříň převodovky"), `idlerShaft` ("Čep vloženého kola", not housing), `quill` ("Vodicí trubka vypínacího ložiska", not housing)
- Three walls normal to X at `walls.front / centre / rear`: plates (ExtrudeGeometry along X of the case cross-section)
  with bearing holes: main axis r = shaft radius + 0.2 (front 12.7, centre/rear 15.2), countershaft r 16.2, and three rail
  holes r = railDiameter/2 + 0.2 at (y = `shift.railY`, z = `shift.railZ.*`). The centre wall also needs a clearance
  notch/hole wherever the idler fork arm or anything else passes — check with the collision test.
  Draw the rolling bearings as simple ring pairs inside the wall thickness if you like (same static body, bores as above).
- Shell: cross-section = rounded rectangle, inner bounds `case.innerY` (−140…112) and ± `case.innerHalfWidthZ`,
  wall `case.wall`, extruded from the front wall to the rear wall, plus a short tail housing to `shafts.mainEndX − 14`
  (the output flange stays outside). A raised tower on top around the lever pivot with an opening for the lever.
- Idler shaft: fixed Ø `reverse.idlerShaftDiameter` pin at `idlerAxis`, from X ≈ 676 into the centre wall.
- Quill: tube OD 36 / bore 28 from the front wall's front face forward to `clutch.quill.frontX`, with a small flange
  on the wall.
All shell/wall meshes `userData.housing = true`.

### `fork12`, `fork34`, `fork5` — parts "Řadicí vidlice 1–2 / 3–4 / 5–R" (rail + fork + gate lug = one body each), mat `shiftSteel`
`position.x = pose.sleeves.sNN` (rails follow their sleeves 1:1; build each body around its neutral position).
- Rail: Ø `railDiameter` rod at (y = railY, z = railZ[s]), long enough to stay in all three wall holes over ±travel
  (e.g. X 478…832; check the rear end against the tail housing and the front end stays behind the clutch cover, X > 455).
- Fork: boss on the rail above the sleeve, arms reaching down and around the sleeve, ending in a C-shaped pad that sits in
  the sleeve groove: pad 7.5 mm wide (0.25 mm side clearance), inner radius 40.4, outer radius ≈ 49, spanning ≈ ±65°
  around the direction from the main axis toward the rail. Forks of the outer rails (z = ±28) are cranked inward.
  Everything outside the groove must stay ≥ 1.5 mm outside the sleeve OD and clear of gears (gear1 tip 55.9 next to sleeve12!).
- Gate lug: a block on top of each rail near X ≈ `leverPivot[0]` with a slot (11 mm wide in X, open in ±Z and upward) for the
  lever finger; the slot centres are at z = −13 (s12), 0 (s34), +13 (s5) — outer lugs reach inward — so that in neutral the
  three slots form one cross-gate channel along Z.
- `fork5` additionally carries the **reverse-idler fork**: an arm from the s5 rail going outward to z ≈ +85, down the
  side of the case, and inward to a yoke that straddles the idler gear rim at its outer side (the side away from both
  the main and counter axes), with a prong on each end face of the idler (0.3 mm axial clearance each side, reaching
  radially from just outside the tip circle inward ≈ 5 mm). Arm X thickness ≈ 8, centred on the idler mid-plane; it travels
  ±9.5 with the rail, so it needs room between gear1's rim (X ≤ 678) and the centre wall (X ≥ 722) — and passes the
  reverse gears only outside their tip circles.

### `shiftLever` — part "Řadicí páka" (mat `shiftSteel`, knob `knob`)
Straight lever through a ball at `leverPivot`; knob at `leverKnob` (neutral), lower finger ending in a Ø 10 ball whose
centre in neutral is at (pivotX, `leverFingerY` + 3, 0) inside the centre gate slot. Group positioned at the pivot:
`rotation.z = asin(dx / l)` where `dx = row * railTravel` is the required +X displacement of the finger ball and `l` the
pivot-to-ball length (knob forward (−X) ⇔ finger and rail rearward (+X) ⇔ row = +1);
`rotation.x = −col * asin(13 / l)` (col = −1 ⇒ knob to +Z, finger to z = −13, the s12 gate).
Apply the two tilts so that the ball centre lands exactly at x = pivotX + row·railTravel, z = col·13·(−1)… verify numerically
in the test for all seven gate positions (ball centre within 0.05 mm in X and Z of the selected rail's slot centre, which is
at pivotX + pose.sleeves[s]). A rubber boot is optional (noCollide).

## update(pose)
Uses `pose.sleeves`, `pose.lever`. (Idler fork follows `pose.sleeves.s5`.)

## Acceptance tests (`test/collision/shift.test.js`)
Build your module together with the gearbox module if it is already implemented (`buildGearbox` — it may still be a
stub returning an empty group while the other agent works; write the tests so they run in both situations: assertions
that need gearbox bodies are skipped with `it.skipIf(!bodies.has('sleeve12'))`).
1. For each gear in N, 1…5, R: `poseForGear(g, { main: m })` for m = 0…2π in 24 steps: zero collisions among your
   bodies, and between your bodies and all gearbox bodies when present.
2. Shift travel sweeps: for each rail, `sleeves[s]` from −9.5 to +9.5 in 0.5 steps with the lever following
   (`lever = { col: gate column of that rail, row: x / railTravel }`, and for s5 `idlerX = sleeves.s5`... note: when the
   gearbox module is present use `poseAt` and only move the sleeve within ±0.4 mm unless you also set aligned gear angles —
   simplest is to sweep with gearbox bodies excluded via `options.only`, then test the end positions with `poseForGear`).
3. Cross-gate sweep in neutral: col −1…1 in 20 steps, row 0: zero collisions (finger ball travels through the three slots).
4. Rigidity. Lever ball position check described above.
5. Fork-in-groove two-sided contact (when the gearbox is present): fork12 displaced ±0.5 mm in X intersects sleeve12
   (same for the other two); idler prongs: fork5 displaced ±0.6 mm in X intersects idlerR.
6. Negative control: lever at gate '1' (col −1,row 1) while all rails are in neutral → shiftLever intersects fork12 (lug).
7. Triangle counts logged; module < 150 k triangles; build < 4 s.
