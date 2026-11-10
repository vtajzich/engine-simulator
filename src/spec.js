// SINGLE SOURCE OF TRUTH for every dimension of the model. See docs/research.md for provenance.
// Units: millimetres, degrees, kg, N·m.
//
// COORDINATE SYSTEM (right-handed, Three.js default):
//   +X  crankshaft axis, pointing from the engine FRONT (timing drive) to the REAR (flywheel, gearbox).
//       X = 0 is the centre of cylinder 1.
//   +Y  up, along the cylinder axis. Y = 0 is the crankshaft axis.
//   +Z  intake side of the engine (= left side of the car; the car drives toward -X).
// ROTATION SIGN: a positive angle is a right-handed rotation about +X (takes +Y toward +Z). Seen from the front
//   of the engine looking rearward this is CLOCKWISE = the normal running direction of the crankshaft
//   (SAE: counter-clockwise seen from the flywheel end).
// ANGLE REFERENCE on any shaft: "angle from +Y toward +Z": a point at radius r, angle a lies at (y, z) = (r cos a, r sin a).
//
// Tags in comments:  SRC = sourced (research.md), EST = estimate, MODEL = deliberate simplification / exaggeration
// (e.g. running clearances enlarged above the mesh tessellation error so the collision pipeline can verify them).
// Reference engine: Toyota 3S-GE (86 x 86 mm, DOHC 16V, direct bucket tappets). Reference gearbox: Toyota W58 ratios.

export const SPEC = {
  // ───────────────────────────── ENGINE ─────────────────────────────
  engine: {
    cylinders: 4,
    firingOrder: [1, 3, 4, 2],                 // SRC
    firingAngleDeg: [0, 540, 180, 360],        // crank angle (0..720) of FIRING TDC per cylinder, index 0 = cyl 1
    throwPhaseDeg: [0, 180, 180, 0],           // flat-plane crank: pistons 1&4 and 2&3 move together
    bore: 86,                                  // SRC
    stroke: 86,                                // SRC
    rodLength: 138,                            // SRC (weak)
    boreSpacing: 96,                           // EST
    compressionHeight: 33.8,                   // SRC (weak) piston pin centre -> crown
    deckHeight: 215,                           // EST crank axis -> block deck (43 + 138 + 33.8 = 214.8 -> piston 0.2 below deck)
    headGasket: 0.85,                          // EST; head face is at deckHeight + headGasket
    targetCompressionRatio: 11.0,              // SRC; the geometry below yields ≈ 11.0 (verified by test)
    idleRpm: 800, redlineRpm: 7500, maxTorqueNm: 190,
    sparkAdvanceDeg: { idle: 10, load: 30 },   // EST, deg BTDC

    piston: {
      radialClearance: 0.25,                   // MODEL (real ≈ 0.02–0.04)
      crownThickness: 8,
      skirtBelowPin: 24,                       // skirt bottom below pin centre
      pinDiameter: 22,                         // SRC (weak)
      pinLength: 62,
      pinBossGap: 23,                          // free axial space between pin bosses (rod small end lives here)
      ringGrooves: [{ below: 6, height: 1.5 }, { below: 11, height: 1.5 }, { below: 16, height: 3 }],
    },
    rod: {
      smallEndOD: 32, smallEndWidth: 21,
      bigEndOD: 62, bigEndWidth: 21,           // crankpin width 22 -> 0.5 side clearance each side (MODEL)
      beamWidth: 16, beamThickness: 12,        // beam envelope: width in the swing plane (Z), thickness along X
      bearingClearance: 0.2,                   // MODEL radial clearance on piston pin and crankpin
    },
    crank: {
      mainJournalDiameter: 55, mainJournalWidth: 22,   // SRC (weak)
      pinDiameter: 48, pinWidth: 22,                   // SRC (weak)
      webThickness: 26,
      counterweights: 8,                               // EST
      counterweightRadius: 64,                         // must clear the piston skirt at BDC (collision sweep)
      counterweightHalfAngleDeg: 62,
      mainX: [-48, 48, 144, 240, 336],                 // centres of the 5 main journals
      noseDiameter: 30, noseEndX: -112,
      flangeDiameter: 84, flangeX: [349, 361],         // rear flange; flywheel bolts to its rear face
      pilotBoreDiameter: 16, pilotBoreDepth: 12,       // bore in the rear end for the gearbox input-shaft pilot
    },
    block: { frontX: -62, rearX: 349, linerBottomY: 88, wall: 6 },

    head: {
      roofAngleDeg: 17,        // MODEL pent-roof half angle = valve inclination from the cylinder axis (included 34°;
                               // 3S-GE: 22.5° Gen4 … wider on early generations). Chosen so a flat piston gives CR ≈ 11.
      height: 150,             // casting height above the head face (visual)
      sparkPlug: { threadDiameter: 12, tipProtrusion: 2.5 },
    },
    valves: {
      stemDiameter: 5.5,       // EST
      length: 100,             // EST seat-face plane -> stem tip, along the valve axis
      headThickness: 2.2,      // cylindrical margin of the head
      seatGap: 0.05,           // MODEL: a closed valve rests this far off its seat (contact pair)
      // headDiameter: MODEL (3S-GE 34.5 / 29.5, reduced to fit the simplified full-bore pent roof)
      // dx    = ± offset of the two valves of a cylinder along X
      // slope = distance of the valve head centre from the roof apex line, measured along the roof plane
      intake:  { headDiameter: 33.0, dx: 17.6, slope: 18.3, maxLift: 8.56 },   // lift SRC
      exhaust: { headDiameter: 28.5, dx: 15.6, slope: 16.2, maxLift: 8.31 },   // lift SRC
    },
    valvetrain: {
      // events in crank degrees relative to the named dead centre, at zero cam lift (lash not included).
      // 10 + 180 + 58 = 248° duration (SRC advertised duration; individual events EST)
      intakeOpensBTDC: 10, intakeClosesABDC: 58,
      exhaustOpensBBDC: 58, exhaustClosesATDC: 10,
      lash: 0.2,               // EST cold clearance between cam base circle and bucket
      contactGap: 0.02,        // MODEL: extra gap so touching meshes never numerically intersect
      baseCircleRadius: 17,    // EST (Ø 34; must be ≥ ~16.5 for a convex lobe with this lift law)
      lobeWidth: 14,
      bucketDiameter: 31,      // SRC (weak)
      bucketHeight: 26, bucketTopThickness: 3,
      // lift law per flank: constant acceleration (fraction f1 of the half duration), constant velocity,
      // constant deceleration (fraction f3) up to the nose. Flat follower => cam profile is the exact envelope.
      profile: { f1: 0.15, f3: 0.62 },
      camShaftDiameter: 24,
      springOD: 25, springWire: 3.4, springCoils: 6,
    },
    timingDrive: { type: 'belt', pitch: 8, crankTeeth: 18, camTeeth: 36, width: 22, x: -86 },   // 2:1, EST
  },

  // ───────────────────────────── FLYWHEEL + CLUTCH ─────────────────────────────
  clutch: {
    flywheel: { x: [361, 389], diameter: 300, frictionOD: 245, ringGearTeeth: 132, ringGearModule: 2.25, centreHole: 44 },  // EST
    disc: {                                    // friction (driven) plate, splined to the gearbox input shaft
      outerDiameter: 225, innerDiameter: 150, thickness: 8,     // EST
      hubLength: 24, hubOD: 44, damperSprings: 6, damperRadius: 48, splineTeeth: 21,
    },
    pressurePlate: { outerDiameter: 230, innerDiameter: 146, thickness: 14, ridgeRadius: 110, ridgeHeight: 6 },
    faceGap: 0.05,             // MODEL gap between clamped friction faces (contact pair)
    plateLift: 1.8,            // EST pressure plate travel at full pedal (range 1.5–2.0)
    diaphragm: { fingers: 18, tipRadius: 26, fulcrumRadius: 95, outerRadius: 110, thickness: 2.6, coneRise: 18 },
    cover: { outerRadius: 138, rearX: 448, thickness: 3, openingRadius: 62, bolts: 6 },
    releaseBearing: { od: 62, id: 37, length: 18, freePlay: 1.5 },
    quill: { od: 36, id: 28, frontX: 428 },   // guide tube fixed to the gearbox front wall
    bellhousing: { frontRadius: 172, rearRadius: 125, wall: 5 },
    cushionTravel: 0.8,        // EST plate lift over which the disc's cushion springs relax: torque capacity falls 100 % -> 0
    maxTorqueNm: 260,
  },

  // ───────────────────────────── GEARBOX (longitudinal, 3 shafts, 5 + R) ─────────────────────────────
  gearbox: {
    // helical forward gears: every pair has tooth sum 80  =>  common centre distance
    normalModule: 1.75, helixAngleDeg: 23, normalPressureAngleDeg: 20,     // EST
    toothSum: 80,                                                         // centreDistance = mn*80/(2 cos β) ≈ 76.04
    backlash: 0.10,            // circumferential on the pitch circle (EST 0.04–0.15)
    // x = X range of the toothed rim. "main" = gear on the input/main axis (y=0,z=0), "counter" = on the countershaft.
    pairs: {
      input: { x: [508, 530], main: 34, counter: 46 },   // SRC (weak, W58). The 34 T gear is integral with the INPUT shaft
      g3:    { x: [572, 590], main: 39, counter: 41 },
      g2:    { x: [594, 614], main: 47, counter: 33 },
      g1:    { x: [656, 678], main: 57, counter: 23 },
      g5:    { x: [784, 800], main: 29, counter: 51 },
    },
    // reverse: straight-cut (spur) SLIDING IDLER. The counter gear is wide and always meshed with the idler;
    // the idler slides -X into mesh with the reverse gear that is FIXED (splined) to the mainshaft.
    // The idler fork sits rigidly on the 5th/reverse rail, so the idler also moves +9.5 (idle) when 5th is selected.
    reverse: {
      module: 2.0, pressureAngleDeg: 20,
      counter: 18, idler: 22, main: 50,
      counterX: [684, 717], mainX: [683, 693],
      idlerNeutralX: [694.5, 706.5], idlerTravel: -9.5,    // MODEL: 8 of 10 mm face width engaged
      entryGap: 1.5,           // axial gap idler face <-> reverse gear face in neutral
      idlerSide: 1,            // idler axis on the +Z side
      idlerShaftDiameter: 16,
    },
    walls: { front: [485, 503], centre: [722, 740], rear: [805, 823] },
    shafts: {
      inputDiameter: 25, inputSplineX: [378, 412], inputPilotDiameter: 15, inputPilotX: [351, 378],
      mainDiameter: 30, mainPilotDiameter: 16, mainPilotX: [514, 530], mainEndX: 860,
      counterDiameter: 32, counterX: [485, 823],
      outputFlange: { x: [848, 860], diameter: 90 },
    },
    synchro: {
      // hub centres on the main axis; sleeve position is -travel (toward front) … +travel (toward rear)
      hubs: {
        s34: { x: 551, front: 'input', rear: 'g3' },   // front = 4th (direct drive), rear = 3rd
        s12: { x: 635, front: 'g2',    rear: 'g1' },
        s5:  { x: 763, front: null,    rear: 'g5' },   // single-sided; its rail also moves the reverse idler
      },
      teeth: 36,                 // spline / dog tooth count of hub, sleeve, blocker ring and gear dog ring (EST 28–36)
      pitchRadius: 34,
      toothHeight: 3,            // radial: pitchRadius ± 1.5
      toothWidthFraction: 0.46,  // tangential tooth width / pitch, same for external and internal teeth (MODEL clearance)
      chamferAngleDeg: 45,       // pointed tooth ends, each face 45° from the axis (included 90°)
      hubHalfWidth: 10,
      sleeveHalfWidth: 10, sleeveOuterRadius: 44, forkGrooveWidth: 8, forkGrooveDepth: 4,
      ringTeethX: [10.5, 14.5],  // blocker ring tooth band, offset from the hub centre (mirrored for the other side)
      dogTeethX: [16, 21],       // gear dog ring band, offset from hub centre; the gear rim starts at 21
      coneX: [5.5, 16], coneRadiusAtDog: 28, coneHalfAngleDeg: 7,   // cone half-angle SRC (weak)
      travel: 9.5,               // sleeve travel neutral -> fully engaged (EST 8–10)
      ringIndexFraction: 0.25,   // blocker ring index while speeds differ: 1/4 pitch = half a tooth width
      struts: 3,
    },
    shift: {
      railY: 84, railDiameter: 14,
      railZ: { s12: -28, s34: 0, s5: 28 },
      railTravel: 9.5,
      leverPivot: [800, 150, 0], leverKnob: [800, 330, 0], leverFingerY: 92,
      shiftSpeed: 80,            // mm/s rail speed while the driver moves the lever
      selectTime: 0.12,          // s per gate column
      // H pattern: [column, row]. column -1 = knob to the left (+Z), row +1 = knob forward (toward the engine, -X)
      // knob forward -> lower finger and rail move +X (rear). 1/3/5 = rail +X, 2/4/R = rail -X.
      gate: { 1: [-1, 1], 2: [-1, -1], 3: [0, 1], 4: [0, -1], 5: [1, 1], R: [1, -1], N: [0, 0] },
    },
    case: { wall: 5, innerY: [-140, 112], innerHalfWidthZ: 100 },
    inputSideInertia: 0.008,     // kg·m² (disc + input shaft + cluster + free gears), EST
    inputDragNm: 0.5,            // oil/bearing drag on the input side, EST
    synchroTorqueNm: 5,          // equivalent cone torque referred to the input shaft (gives ≈ 0.2 s sync), EST
  },

  // ───────────────────────────── VEHICLE (driving simulation only) ─────────────────────────────
  vehicle: { finalDrive: 4.1, tyreRadiusM: 0.30, massKg: 1100, cdA: 0.62, rollingResistance: 0.013, engineInertia: 0.16 },
};

export default SPEC;
