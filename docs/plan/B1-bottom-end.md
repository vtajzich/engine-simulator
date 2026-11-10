# Task B1 — engine bottom end (`src/model/bottomEnd.js`, test `test/collision/bottomEnd.test.js`)

Follow `docs/plan/MODEL-common.md`. Export `buildBottomEnd(spec = SPEC)`.
Numbers below are for orientation (SPEC/derive are authoritative): R = 43, r = 43, L = 138, cylX = 0/96/192/288,
mainX = −48/48/144/240/336, deck Y = 215, pin height 181 (TDC) … 95 (BDC).

## Bodies and parts

### `crank` — part `crankshaft` ("Klikový hřídel"), steel
One merged solid rotating about X: `group.rotation.x = pose.crank`.
- 5 main journals: r = mainJournalDiameter/2, length mainJournalWidth, centred at each `mainX`.
- 4 crankpins: r = pinDiameter/2, length pinWidth, centred at X = cylX[i], axis offset by the crank radius r in the
  direction `throwPhase[i]` (angle from +Y toward +Z; at crank = 0 cylinders 1 and 4 have their pins straight up).
- 8 webs (cheeks), each `webThickness` thick, filling exactly the X gap between a main journal and the adjacent pin
  (e.g. X ∈ [11, 37] and [−37, −11] for cylinder 1). Shape in the plane normal to X (ExtrudeGeometry along X):
  an arm covering both the main journal circle and the crankpin circle (stadium/tear shape, ≈ 32 mm radius around
  each centre) plus a counterweight on the opposite side of the pin: an annular sector of radius
  `counterweightRadius`, half-angle `counterweightHalfAngleDeg`, centred on the direction opposite the pin.
- Nose: cylinder r = noseDiameter/2 from the front main journal to `noseEndX`.
- Rear: a seal journal (r ≈ 40) between the last main journal and the flange, then the flange
  (r = flangeDiameter/2, X = flangeX) with a concentric pilot bore (r = pilotBoreDiameter/2, depth pilotBoreDepth,
  open to the rear face) — build the rear end as a LatheGeometry so the bore is a real recess. Six bolt heads are optional décor.

### `piston1..4` — part `piston{n}` ("Píst n"), aluminium; pin steel; rings steelDark
Position `(cylX[i], pistonPinY(throwAngle(pose.crank, i)), 0)`; local origin = pin centre. No rotation.
- Lathe body about Y: outer radius `R − radialClearance`; flat crown at `+compressionHeight`; three ring grooves
  (SPEC `ringGrooves`: distance below crown / height, groove depth ≈ 3); skirt down to `−skirtBelowPin`; hollow
  underside (crown thickness `crownThickness`, skirt wall ≈ 3.5).
- Two pin bosses inside (cylinders about X, r ≈ 15, from |x| = pinBossGap/2 to the skirt wall), pin bore through them.
- Pin: cylinder r = pinDiameter/2, length pinLength, axis X (same body).
- Rings: thin rings seated in the grooves, outer radius `R − 0.15` (same body).

### `rod1..4` — part `rod{n}` ("Ojnice n"), steel
Local origin = small-end centre, big end at local (0, −L, 0). Position = piston pin centre;
`rotation.x = rodAngle(throwAngle(pose.crank, i))`.
- One ExtrudeGeometry along X (depth = bigEndWidth, centred) of a 2D outline in the Y–Z plane: small-end ring
  (OD smallEndOD, bore = pinDiameter + 2·bearingClearance), big-end ring (OD bigEndOD, bore = crank pinDiameter +
  2·bearingClearance), tapered beam between (width beamWidth near the small end, wider at the big end). The beam may be
  thinned along X to `beamThickness` (I-beam look) by building it as a separate narrower extrusion merged in.
- Big-end cap split line / two bolts: optional décor.

### `block` (static, housing) — part `block` ("Blok motoru")
Must leave every moving part free. Build from simple solids (they may overlap each other — same static body):
- Cylinder bank: ExtrudeGeometry along Y of the top-view outline (X from `block.frontX` to `block.rearX`,
  Z ≈ ±60) with four circular holes of radius R at cylX, from `block.linerBottomY` up to `deckHeight`.
- Crankcase side walls: two plates at |Z| ≈ 88…94, from Y ≈ −70 up to linerBottomY, joined to the bank by a shelf.
  (Largest swept radius inside: crank radius + big-end radius ≈ 74, counterweights 64.)
- 5 main-bearing bulkheads at `mainX`: plate normal to X spanning the crankcase width, with a main bore of
  r = mainJournalDiameter/2 + 0.2. IMPORTANT geometry constraint: the piston skirts come down to Y ≈ 71 at BDC, i.e.
  17 mm below the liners, and the pistons of neighbouring cylinders are only 10 mm apart in X. So each bulkhead is
  **≤ 8 mm thick (centred on mainX) above Y = 60** and may be `mainJournalWidth − 2` thick below Y = 60 (down to the
  bearing cap bottom, Y ≈ −38). The crank webs sit 1 mm from the thick part on each side.
  The front and rear bulkheads double as the end walls (the crank nose / rear seal journal pass through bores with
  0.3 mm radial clearance).
- Optional oil pan (same body): shallow box below, floor at Y ≤ −95.
Mark all block meshes `userData.housing = true`.

## update(pose)
Uses only `pose.crank`. crank rotation; per cylinder α = `throwAngle(pose.crank, i)`: piston Y, rod position + angle.

## Acceptance tests (`test/collision/bottomEnd.test.js`)
1. Sweep crank 0…720° in 2° steps: zero collisions among `block`, `crank`, `piston1..4`, `rod1..4`.
2. Rigidity over the sweep.
3. Geometric invariants measured from the scene (world matrices), at 24 angles: distance between each rod's small-end
   centre and the matching crankpin centre (crankpin centre obtained by transforming the pin's local centre with the
   crank group's matrixWorld) equals L within 1e-6; piston crown world Y equals `pistonCrownY`; at crank = 0 pistons
   1 & 4 are at TDC (crown Y = 214.8) and 2 & 3 at BDC.
4. Clearances reported (console.log a small table) with `clearanceAlong`: piston1 → block sideways (+Z) ≈ 0.2–0.3 mm;
   counterweight-to-skirt: minimum over the sweep of the gap piston1 ↔ crank probing −Y (expect several mm, must be > 2).
5. Negative controls (use `bodiesIntersectDisplaced`): piston1 shifted +0.5 mm in Z hits `block`; `crank` rotated
   by 15° about X (rods left in place) hits a rod; rod1 shifted 1.5 mm in X hits `crank` (web) or `piston1` (boss).
6. Triangle count per body logged; whole module < 250 k triangles; build < 4 s.
