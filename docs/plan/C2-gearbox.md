# Task C2 — gearbox rotating parts (`src/model/gearbox.js`, `src/geo/gear.js`, `src/geo/spline.js`, test `test/collision/gearbox.test.js`)

Follow `docs/plan/MODEL-common.md`. Export `buildGearbox(spec = SPEC)`. Kinematics: `src/kin/derive.js`
(`D.gearbox.gears[id]`, `counterAxis`, `idlerAxis`, `D.synchro`), `src/kin/gears.js`, `src/kin/synchro.js`,
`src/kin/pose.js` (`poseAt`, `poseForGear`). Layout: longitudinal 3-shaft constant-mesh box. Input shaft and
mainshaft are coaxial on the main axis (y = 0, z = 0); countershaft at `counterAxis` (y ≈ −76.05). All helical gear
pairs are permanently meshed; free gears spin on the mainshaft and are locked to it by sliding synchro sleeves;
4th = sleeve locks the input shaft directly to the mainshaft; reverse = a sliding spur idler.

## A. Geometry builders

### `src/geo/gear.js` — `gearRimGeometry(g, { width = g.width, innerRadius, slices })`
Involute toothed rim (annulus from `innerRadius` to the tips), axis X, centred on x = 0 (mid-plane), tooth 0 centred
on local +Y at the mid-plane. Helical when `g.beta ≠ 0`: the transverse section at axial position x is rotated by
`g.hand * x * tan(g.beta) / g.r`. Use `toothHalfAngle(g, rho)` from `src/kin/gears.js` for the flank.
This reference implementation was validated in a spike (0 collisions for a correctly phased 17/43 pair, collisions as
soon as one gear is turned by the backlash) — reuse it, adapting names:

```js
function gearProfile(g, { nFlank = 10, nTip = 3, nRoot = 4 } = {}) {      // 2D transverse outline, [radius, angle]
  const { z, r, rb, ra, rf } = g, pitch = 2 * Math.PI / z, rStart = Math.max(rb, rf), pts = [];
  const half = rho => toothHalfAngle(g, rho);
  for (let k = 0; k < z; k++) {
    const c = k * pitch;
    if (rf < rb) pts.push([rf, c - half(rb)]);
    for (let i = 0; i <= nFlank; i++) { const rho = rStart + (ra - rStart) * i / nFlank; pts.push([rho, c - half(rho)]); }
    const hTip = half(ra);
    for (let i = 1; i < nTip; i++) pts.push([ra, c - hTip + 2 * hTip * i / nTip]);
    for (let i = nFlank; i >= 0; i--) { const rho = rStart + (ra - rStart) * i / nFlank; pts.push([rho, c + half(rho)]); }
    if (rf < rb) pts.push([rf, c + half(rb)]);
    const a0 = c + half(rStart), a1 = c + pitch - half(rStart);
    for (let i = 1; i < nRoot; i++) pts.push([rf, a0 + (a1 - a0) * i / nRoot]);
  }
  return pts;
}
// vertices: for slice s (x = -width/2 + width*s/slices, tw = hand*x*tan(beta)/r): (x, rho*cos(a+tw), rho*sin(a+tw))
// side quads between consecutive slices; end caps as quads between the outline and a ring of radius innerRadius
// (same angles); inner bore surface between the two inner rings. Wind triangles consistently (outward normals).
```
Slices: ≥ 8 for helical (keep the twist per slice ≤ 3°), 1 for spur.

### `src/geo/spline.js` — `clutchTeethGeometry({ n, rInner, rOuter, x0, x1, pointed, halfAngle, chamferAngleAtPitch })`
The teeth of synchro hubs, sleeves, blocker rings and gear dog rings. All four use the SAME tooth form so the
chamfer maths in `src/kin/synchro.js` holds at every radius:
- tooth k is centred on local angle `k * pitchAngle`; it is an **annular sector**: at axial distance t from a pointed
  tip the angular half-width is `min(halfAngle, t / (pitchRadius * tan(chamferAngle)))` where
  `halfAngle = D.synchro.w / (2 * pitchRadius)` (constant ANGULAR width at all radii);
- `pointed`: 'x0' | 'x1' | 'both' | 'none' — which axial ends taper to a radial ridge line;
- radial extent rInner…rOuter, subdivided radially into ≥ 3 strips and the chamfer axially into ≥ 2 strips (the chamfer
  faces are slightly twisted surfaces; subdivision keeps mating parts consistent to a few µm);
- closed solid per tooth (it will be merged with / overlap the carrier ring it belongs to).
Radial bands (pitchRadius ± toothHeight/2 = 32.5…35.5): EXTERNAL teeth (hub, ring, dog) 32.5 → 35.3 on a carrier
cylinder of r = 32.5; INTERNAL teeth (sleeve) 32.7 → 35.5 hanging from the sleeve bore r = 35.5.
Phase conventions are in `docs/plan/A1-kinematics.md` §5 (sleeve teeth on k·pitchAngle in the mainshaft frame, hub
teeth on (k+½)·pitchAngle, ring and dog teeth on k·pitchAngle in their own frames).

## B. Bodies (X positions absolute; hub centres `synchro.hubs.*.x` = 551 / 635 / 763; offsets below are measured from the
hub centre toward the gear, mirror for the other side)

Synchro stack on each active side: hub rim ±10 → blocker ring teeth band `ringTeethX` (10.5…14.5, pointed end at 10.5
facing the sleeve) → gear dog teeth band `dogTeethX` (16…21, pointed end at 16) → gear rim starts at 21.
Gear cone (male, part of the gear): from offset `coneX[1]` (16, radius `coneRadiusAtDog` = 28) tapering toward the hub
with half-angle 7° to offset `coneX[0]` (5.5).

### `inputShaft` — part "Vstupní hřídel" (+ part `inputGear` "Kolo stálého záběru (34 z)", same body); `rotation.x = pose.input`
Pilot Ø `inputPilotDiameter` over `inputPilotX`; splined section over `inputSplineX`: Ø 25 cylinder with shallow
longitudinal grooves cut INTO it (nothing may exceed r = 12.5; the clutch disc hub bore is Ø 25.5); plain Ø 25 up to
the gear; **exactly Ø 25 inside the front wall X range** (`walls.front`, bearing bore there is Ø 25.4).
Input gear: helical rim `input.main` at its X range; behind it (toward the hub s34) the dog ring and cone for 4th
(mirror of the stack above: dog band at hub − 21…−16, cone to hub − 5.5). Hollow from the rear: bore r 15.3 from the
cone end to X ≈ 532 and r 8.2 over `mainPilotX` (the mainshaft pilot runs inside).

### `counterShaft` — part "Předlohový hřídel"; position at counterAxis; `rotation.x = pose.counter`
Shaft Ø `counterDiameter` over `counterX` (exactly Ø 32 inside the three wall X ranges), with the five helical
`*.counter` rims (hand −1) and the wide spur `rev.counter` rim, each with a solid web down to the shaft, tooth 0 of
every gear on the shaft's local +Y. **Make each helical counter rim 1 mm shorter at both ends than its pair's X range**
(same mid-plane) so it keeps clear of the neighbouring dog rings/sleeves on the main axis.

### `mainShaft` — parts `mainShaft` ("Výstupní hřídel"), `hub12`, `hub34`, `hub5` ("Náboj synchronu"), `revGear` ("Kolo zpátečky (50 z)"), `outputFlange` ("Výstupní příruba"); one body; `rotation.x = pose.main`
Shaft: pilot Ø `mainPilotDiameter` over `mainPilotX`, then Ø `mainDiameter` to `mainEndX` (exactly Ø 30 inside the
centre and rear wall X ranges); thrust collars (r ≈ 20) in the gaps between neighbouring free gears. Hubs: boss r 22,
thin web (|x| ≤ 4 between r 22 and r 31, so the rings and cones fit in the recess), rim r 31…32.5 over ±hubHalfWidth with
external teeth (`pointed: 'none'`, phase (k+½)·pitchAngle); hub5 is single-sided (no ring/gear in front) but shaped the same.
Reverse gear: spur rim `rev.main` over `reverse.mainX`, tooth 0 on local +Y. Output flange at `outputFlange.x`.

### `gear1`, `gear2`, `gear3`, `gear5` — parts "Kolo 1. stupně" …; `rotation.x = pose.gears.g1` …
Each: helical rim `gN.main` (hand +1) on a web, bore Ø 30.6 (runs on the mainshaft), plus on the side facing its hub
the dog ring (carrier r 32.5 over the dog band, external teeth pointed toward the hub) and the cone.
Tooth 0 of the rim AND dog tooth 0 are both on the gear's local +Y.

### `idlerR` — part "Vložené kolo zpátečky"; position (idlerNeutralX mid + pose.idlerX, idlerAxis.y, idlerAxis.z); `rotation.x = pose.gears.idler`
Spur rim `rev.idler` (width = idlerNeutralX width), bore Ø 16.4 (fixed Ø 16 shaft belongs to the case module). Plain
end faces (the shift fork straddles the rim from the outside; no collar).

### `sleeve12`, `sleeve34`, `sleeve5` — parts "Přesuvná objímka 1–2 / 3–4 / 5"; `position.x = hub.x + pose.sleeves.sNN`, `rotation.x = pose.main`
Ring r 35.5…`sleeveOuterRadius`, width 2·sleeveHalfWidth, fork groove centred (`forkGrooveWidth` × `forkGrooveDepth`,
i.e. groove floor r = 40), internal teeth over the full width, `pointed: 'both'`, phase k·pitchAngle.

### `ring1`, `ring2`, `ring3`, `ring4`, `ring5` — parts "Synchronizační kroužek …", mat `brass`
ring1 ↔ gear1, ring2 ↔ gear2, ring3 ↔ gear3, ring4 ↔ input gear, ring5 ↔ gear5. Body r ≈ cone + 0.05 … 31 over offsets
≈ 5.8…14.5 with a female cone matching the gear cone (radial gap 0.05 when seated), carrier r 32.5 and external teeth over
`ringTeethX`, pointed toward the hub. Pose: `rotation.x = pose.rings[name].angle`; axial position = seated position
shifted `0.4 * (1 − push)` mm toward the hub (push 0 = neutral, retreated off the cone; push 1 = seated).
Three small lugs toward the hub are optional décor (keep them inside the hub recess, `noCollide` if they are only visual).
Struts/keys in the hub: visual only, `noCollide`.

## update(pose)
Uses `pose.input, counter, main, gears.{g1,g2,g3,g5,idler}, idlerX, sleeves, rings`.

## Acceptance tests (`test/collision/gearbox.test.js`)
Helper: `P = D.synchro.P`, angles = mm / pitchRadius.
1. Neutral, clutch engaged: `poseAt({ crank: a, input: a, main: 0 })` for a = 0…4π in 180 steps, and with the
   mainshaft turning too (`main: 0.37 * a`): zero collisions among all gearbox bodies.
2. Each gear '1'…'5': `poseForGear(g, { main: m })` for m = 0…2π in 60 steps: zero collisions. 'R':
   `poseForGear('R', { main: m })`: zero collisions.
3. Rigidity over all of the above.
4. Speed/direction checks from poses: counter turns against the input, forward free gears with it, idler with it.
5. Gear-mesh two-sided checks for every helical pair and both reverse meshes, at 12 phases each: nominal → no
   intersection; one gear rotated about its own axis by ±1.3 × (backlash / r) → intersection (use
   `bodiesIntersectDisplaced` with `angle/axisPoint/axisDir`).
6. Shift sweeps for every active sleeve side (s12 ±, s34 ±, s5 +), main = 0.3 rad, x = 0…travel in 0.25 mm steps:
   the engaging gear's angle is set to the WORST allowed misalignment `d_g = maxMisalign(advanceDog(x))` and its ring to
   `d_r = min(ringIndexFraction * P, maxMisalign(advanceRing(x)))`, ring `push = clamp(x / 0.3, 0, 1)`, for both signs
   of the misalignment. To realise a gear misalignment solve the input angle with `gearLinear`:
   `gearAngle = main + pitchAngle/2 ± d_g / pitchRadius` → `input = (gearAngle − B) / A`. Zero collisions.
   (This proves the chamfer rule used by the simulator is collision-free at its limit.)
7. Negative controls: (a) same as 6 at x = xDogTip + 1.5 but with the gear misaligned by `maxMisalign(...) + 0.35 mm`
   → sleeve ↔ gear collision; (b) ring at full index (P/4) with the sleeve at x = xBlock + 0.4 → sleeve ↔ ring
   collision; (c) reverse: `idlerX = idlerTravel` with the input turned so `revMainRequired` is off by half a tooth
   pitch of the 50 T gear → idlerR ↔ mainShaft collision; with correct phase → none; (d) `idlerX = 0` and any phase → none.
8. Two-sided cone contact: seated ring (push 1) displaced 0.3 mm toward its gear intersects the gear.
9. Triangle counts logged; module < 450 k triangles; build < 5 s.
