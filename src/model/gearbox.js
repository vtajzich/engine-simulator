// Gearbox rotating parts: input shaft + 34 T gear, countershaft, mainshaft (+ synchro hubs, reverse gear, flange),
// free gears with dog rings and cones, reverse idler, sliding sleeves, blocker rings. See docs/plan/C2-gearbox.md.
import * as THREE from 'three';
import { SPEC } from '../spec.js';
import { derive } from '../kin/derive.js';
import { mat } from '../geo/materials.js';
import { partGroup, segs } from '../geo/parts.js';
import { gearRimSoup, extrudeOutline } from '../geo/gear.js';
import { clutchTeethSoup } from '../geo/spline.js';
import { revolveX, placeX, translate, concat, soupGeometry } from '../geo/gearboxGeo.js';

const LOCAL = {
  // OVERRIDES the task text "ring/cone radial gap 0.05 when seated": with a 7° cone, an axial displacement of 0.3 mm
  // only closes 0.3*tan(7°) = 0.037 mm radially, so the two-sided cone test ("displaced 0.3 mm intersects") is
  // impossible with 0.05. 0.03 mm (= 0.24 mm axial play) keeps nominal clear, 128 segments keep chord error < 0.01.
  coneGap: 0.03,
  coneSegs: 128,
  freeBore: 15.3,            // Ø30.6 bore of the free gears on the Ø30 mainshaft
  inputPilotBoreR: 8.2,      // Ø16.4 over the mainshaft pilot
  inputBoreStepX: 532,       // x where the input gear bore steps from r 8.2 to r 15.3
  pilotTipGap: 0.5,          // mainshaft pilot tip to closed end of the pilot hole
  shoulderX: 532.5,          // mainshaft Ø16 -> Ø30 shoulder
  collarR: 20, collarW: 3, collarGap: 0.5,
  hubBossHalf: 5, hubWebHalf: 4, hubBossR: 22, hubRimInnerR: 31,
  ringBodyOuterR: 30.7, ringBodyStartU: 5.8, ringRetreat: 0.4,
  toothEmbed: 0.5,           // teeth are sunk this far into their carrier so the union is watertight visually
  toothClear: 0.2,           // radial clearance external tip <-> internal bore / internal tip <-> carrier
  sleeveSetback: 0.02,       // sleeve tooth tips stop 0.02 mm short of the end face: tip-to-tip ridge contact (misalign = P/2 exactly at xDogTip) must not be a coincident-edge touch
  rimWebOverlap: 1.0, rimInsetFree: 2.5,
};

const rad = d => d * Math.PI / 180;
const mm = (name, geomSoup, matName) => {
  const m = new THREE.Mesh(soupGeometry(geomSoup), mat(matName));
  m.name = name;
  return m;
};

export function buildGearbox(spec = SPEC) {
  const GB = spec.gearbox, SY = GB.synchro, SH = GB.shafts, RV = GB.reverse;
  const D = derive(spec);
  const G = D.gearbox.gears;
  const n = SY.teeth, pitchAngle = D.synchro.pitchAngle;
  const PR = SY.pitchRadius, HT = SY.toothHeight;
  const halfAngle = D.synchro.w / (2 * PR), chi = rad(SY.chamferAngleDeg);
  const carrierR = PR - HT / 2, extTipR = PR + HT / 2 - LOCAL.toothClear;
  const intTipR = PR - HT / 2 + LOCAL.toothClear, sleeveBoreR = PR + HT / 2;
  const tanCone = Math.tan(rad(SY.coneHalfAngleDeg));
  const [cone0, cone1] = SY.coneX, [dog0, dog1] = SY.dogTeethX, [ring0, ring1] = SY.ringTeethX;
  const coneR = u => SY.coneRadiusAtDog - (cone1 - u) * tanCone;

  const group = new THREE.Group();
  group.name = 'gearbox';
  const parts = {};
  const addPart = (id, body, label, meshes, pos = null) => {
    const p = partGroup(id, body, label);
    for (const m of meshes) p.add(m);
    if (pos) p.position.set(...pos);
    group.add(p);
    parts[id] = p;
    return p;
  };

  const teeth = o => clutchTeethSoup({ n, halfAngle, pitchRadius: PR, chamferAngle: chi, ...o });
  const rim = (id, inner, opt = {}) => translate(gearRimSoup(G[id], { innerRadius: inner, ...opt }), G[id].mid);

  // ---------------------------------------------------------------- hubs / gear layout
  const sides = {   // gear name -> { hub, sign, ring }
    input: { hub: 's34', sign: -1, ring: 'ring4' }, g3: { hub: 's34', sign: 1, ring: 'ring3' },
    g2: { hub: 's12', sign: -1, ring: 'ring2' }, g1: { hub: 's12', sign: 1, ring: 'ring1' },
    g5: { hub: 's5', sign: 1, ring: 'ring5' },
  };
  const hubX = h => SY.hubs[h].x;

  // ---------------------------------------------------------------- free gear body (g1, g2, g3, g5; input gear shares the stack)
  // profile in u = offset from hub centre toward the gear
  const stackProfile = (rWeb, uEnd) => [
    [cone0, LOCAL.freeBore], [cone0, coneR(cone0)], [cone1, coneR(cone1)], [cone1, carrierR], [dog1, carrierR],
    [dog1, rWeb], [uEnd, rWeb], [uEnd, LOCAL.freeBore],
  ];
  const dogRing = () => teeth({ rInner: carrierR - LOCAL.toothEmbed, rOuter: extTipR, x0: dog0, x1: dog1, pointed: 'x0' });
  const freeGear = (name) => {
    const { hub, sign } = sides[name], g = G[`${name}.main`], hx = hubX(hub);
    const uEnd = dog1 + g.width, rWeb = g.rf - LOCAL.rimWebOverlap;
    const body = placeX(revolveX(stackProfile(rWeb, uEnd), LOCAL.coneSegs), sign, hx);
    const dogs = placeX(dogRing(), sign, hx);
    const r = rim(`${name}.main`, g.rf - LOCAL.rimInsetFree);
    return concat([body, dogs, r]);
  };
  const gearNames = { g1: 'gear1', g2: 'gear2', g3: 'gear3', g5: 'gear5' };
  const gearLabel = { g1: 'Kolo 1. stupně', g2: 'Kolo 2. stupně', g3: 'Kolo 3. stupně', g5: 'Kolo 5. stupně' };
  const gearGroups = {};
  for (const [name, body] of Object.entries(gearNames)) {
    gearGroups[name] = addPart(body, body, gearLabel[name], [mm(body, freeGear(name), name === 'g1' || name === 'g3' ? 'gearA' : 'gearB')]);
  }

  // ---------------------------------------------------------------- input shaft + constant-mesh gear
  const ig = G['input.main'], hx4 = hubX('s34');
  const shaftProfile = [
    [SH.inputPilotX[0], 0], [SH.inputPilotX[0], SH.inputPilotDiameter / 2], [SH.inputPilotX[1], SH.inputPilotDiameter / 2],
    [SH.inputSplineX[0], 11], [SH.inputSplineX[1], 11], [SH.inputSplineX[1], SH.inputDiameter / 2],
    [ig.x[0], SH.inputDiameter / 2], [ig.x[0], 11], [GB.shafts.mainPilotX[0], 11], [GB.shafts.mainPilotX[0], 0],
  ];
  // the spline section: Ø25 lands with shallow grooves cut INTO the shaft (nothing beyond r 12.5)
  const splineOutline = [];
  const NS = spec.clutch.disc.splineTeeth, sp = 2 * Math.PI / NS, rLand = SH.inputDiameter / 2, rGroove = rLand - 1.2;
  for (let k = 0; k < NS; k++) {
    const c = k * sp;
    splineOutline.push([rGroove, c - 0.30 * sp], [rLand, c - 0.22 * sp], [rLand, c + 0.22 * sp], [rGroove, c + 0.30 * sp]);
  }
  const splineLen = SH.inputSplineX[1] - SH.inputSplineX[0];
  const splines = translate(extrudeOutline(splineOutline, { width: splineLen, innerRadius: 9 }), (SH.inputSplineX[0] + SH.inputSplineX[1]) / 2);
  addPart('inputShaft', 'inputShaft', 'Vstupní hřídel', [
    mm('inputShaft', concat([revolveX(shaftProfile, 64), splines]), 'steel'),
  ]);
  {
    const pilotBoreX = SH.mainPilotX[0];                                    // closed end of the pilot hole
    const uAt = x => hx4 - x;
    const rWeb = ig.rf - LOCAL.rimWebOverlap;
    const prof = [
      [cone0, LOCAL.freeBore], [cone0, coneR(cone0)], [cone1, coneR(cone1)], [cone1, carrierR], [dog1, carrierR],
      [dog1, rWeb], [uAt(ig.x[0]), rWeb], [uAt(ig.x[0]), 10], [uAt(pilotBoreX), 10],
      [uAt(pilotBoreX), LOCAL.inputPilotBoreR], [uAt(LOCAL.inputBoreStepX), LOCAL.inputPilotBoreR],
      [uAt(LOCAL.inputBoreStepX), LOCAL.freeBore],
    ];
    const body = placeX(revolveX(prof, LOCAL.coneSegs), -1, hx4);
    const dogs = placeX(dogRing(), -1, hx4);
    const r = rim('input.main', ig.rf - LOCAL.rimInsetFree);
    addPart('inputGear', 'inputShaft', 'Kolo stálého záběru (34 z)', [mm('inputGear', concat([body, dogs, r]), 'gearA')]);
  }

  // ---------------------------------------------------------------- countershaft
  const counterGroup = (() => {
    const list = [revolveX([[SH.counterX[0], 0], [SH.counterX[0], SH.counterDiameter / 2], [SH.counterX[1], SH.counterDiameter / 2], [SH.counterX[1], 0]], 64)];
    const addGear = (id, shrink) => {
      const g = G[id], inner = Math.max(14, g.rf - 3);
      const w = g.width - 2 * shrink, lo = g.mid - w / 2, hi = g.mid + w / 2;
      list.push(translate(gearRimSoup(g, { width: w, innerRadius: inner }), g.mid));
      list.push(revolveX([[lo, 14], [lo, inner + 1], [hi, inner + 1], [hi, 14]], segs(inner + 1)));
    };
    for (const name of Object.keys(GB.pairs)) addGear(`${name}.counter`, 1);       // 1 mm shorter at both ends
    addGear('rev.counter', 0);
    return addPart('counterShaft', 'counterShaft', 'Předlohový hřídel', [mm('counterShaft', concat(list), 'steel')],
      [0, D.gearbox.counterAxis.y, 0]);
  })();

  // ---------------------------------------------------------------- mainshaft with hubs, reverse gear, flange
  const mainParts = [];
  {
    const sh = [[SH.mainPilotX[0] + LOCAL.pilotTipGap, 0], [SH.mainPilotX[0] + LOCAL.pilotTipGap, SH.mainPilotDiameter / 2],
      [LOCAL.shoulderX, SH.mainPilotDiameter / 2], [LOCAL.shoulderX, SH.mainDiameter / 2]];
    const collars = [
      [GB.pairs.g3.x[1], GB.pairs.g2.x[0]], [GB.pairs.g1.x[1], RV.mainX[0]], [GB.pairs.g5.x[1], GB.pairs.g5.x[1] + LOCAL.collarW + 2 * LOCAL.collarGap],
    ];
    const rS = SH.mainDiameter / 2;
    for (const [a, b] of collars) {
      sh.push([a + LOCAL.collarGap, rS], [a + LOCAL.collarGap, LOCAL.collarR], [b - LOCAL.collarGap, LOCAL.collarR], [b - LOCAL.collarGap, rS]);
    }
    sh.push([SH.outputFlange.x[0] + 1, rS], [SH.outputFlange.x[0] + 1, 0]);
    mainParts.push(addPart('mainShaft', 'mainShaft', 'Výstupní hřídel', [mm('mainShaft', revolveX(sh, 64), 'steel')]));
  }
  const hubLabel = { s12: 'Náboj synchronu 1–2', s34: 'Náboj synchronu 3–4', s5: 'Náboj synchronu 5' };
  const hubId = { s12: 'hub12', s34: 'hub34', s5: 'hub5' };
  for (const h of Object.keys(SY.hubs)) {
    const hw = SY.hubHalfWidth, B = LOCAL.hubBossHalf, W = LOCAL.hubWebHalf;
    const prof = [[-B, 14], [-B, LOCAL.hubBossR], [-W, LOCAL.hubBossR], [-W, LOCAL.hubRimInnerR], [-hw, LOCAL.hubRimInnerR], [-hw, carrierR],
      [hw, carrierR], [hw, LOCAL.hubRimInnerR], [W, LOCAL.hubRimInnerR], [W, LOCAL.hubBossR], [B, LOCAL.hubBossR], [B, 14]];
    const hubTeeth = teeth({ rInner: carrierR - LOCAL.toothEmbed, rOuter: extTipR, x0: -hw, x1: hw, pointed: 'none', phase: pitchAngle / 2 });
    mainParts.push(addPart(hubId[h], 'mainShaft', hubLabel[h],
      [mm(hubId[h], translate(concat([revolveX(prof, 64), hubTeeth]), hubX(h)), 'steelDark')]));
  }
  {
    const g = G['rev.main'];
    const solid = translate(gearRimSoup(g, { innerRadius: 14 }), g.mid);
    mainParts.push(addPart('revGear', 'mainShaft', 'Kolo zpátečky (50 z)', [mm('revGear', solid, 'gearB')]));
    const [fa, fb] = SH.outputFlange.x;
    const fr = SH.outputFlange.diameter / 2;
    mainParts.push(addPart('outputFlange', 'mainShaft', 'Výstupní příruba', [
      mm('outputFlange', revolveX([[fa, 14], [fa, 26], [fa + 3, fr], [fb, fr], [fb, 14]], 96), 'steelDark')]));
  }

  // ---------------------------------------------------------------- reverse idler
  const ri = G['rev.idler'];
  const idlerGroup = addPart('idlerR', 'idlerR', 'Vložené kolo zpátečky',
    [mm('idlerR', gearRimSoup(ri, { innerRadius: RV.idlerShaftDiameter / 2 + 0.2 }), 'gearB')],
    [ri.mid, D.gearbox.idlerAxis.y, D.gearbox.idlerAxis.z]);

  // ---------------------------------------------------------------- sleeves
  const sleeveGroups = {};
  const sleeveLabel = { s12: 'Přesuvná objímka 1–2', s34: 'Přesuvná objímka 3–4', s5: 'Přesuvná objímka 5' };
  const sleeveId = { s12: 'sleeve12', s34: 'sleeve34', s5: 'sleeve5' };
  {
    const hw = SY.sleeveHalfWidth, gw = SY.forkGrooveWidth / 2, Ro = SY.sleeveOuterRadius, Rg = Ro - SY.forkGrooveDepth, c = 1;
    const prof = [[-hw, sleeveBoreR], [-hw, Ro - c], [-hw + c, Ro], [-gw, Ro], [-gw, Rg], [gw, Rg], [gw, Ro], [hw - c, Ro], [hw, Ro - c], [hw, sleeveBoreR]];
    const body = revolveX(prof, segs(Ro));
    const sTeeth = teeth({ rInner: intTipR, rOuter: sleeveBoreR + LOCAL.toothEmbed, x0: -hw + LOCAL.sleeveSetback, x1: hw - LOCAL.sleeveSetback, pointed: 'both' });
    const soup = concat([body, sTeeth]);
    for (const h of Object.keys(SY.hubs)) {
      sleeveGroups[h] = addPart(sleeveId[h], sleeveId[h], sleeveLabel[h], [mm(sleeveId[h], soup, 'aluminium')], [hubX(h), 0, 0]);
    }
  }

  // ---------------------------------------------------------------- blocker rings
  const ringGroups = {};
  for (const name of Object.keys(sides)) {
    const { hub, sign, ring } = sides[name];
    const rin = u => coneR(u) + LOCAL.coneGap;
    const u0 = LOCAL.ringBodyStartU, rb = LOCAL.ringBodyOuterR;
    const prof = [[u0, rin(u0)], [u0, rb], [ring0, rb], [ring0, carrierR], [ring1, carrierR], [ring1, rin(ring1)]];
    const body = placeX(revolveX(prof, LOCAL.coneSegs), sign, 0);
    const rt = placeX(teeth({ rInner: carrierR - LOCAL.toothEmbed, rOuter: extTipR, x0: ring0, x1: ring1, pointed: 'x0' }), sign, 0);
    ringGroups[ring] = addPart(ring, ring, `Synchronizační kroužek ${ring.slice(4)}`, [mm(ring, concat([body, rt]), 'brass')], [hubX(hub), 0, 0]);
    ringGroups[ring].userData.sign = sign;
  }

  // ---------------------------------------------------------------- update
  const mainGroups = mainParts, gearsOf = Object.entries(gearGroups);
  const inputParts = [parts.inputShaft, parts.inputGear];
  const idlerBaseX = ri.mid;
  function update(pose) {
    for (const p of inputParts) p.rotation.x = pose.input;
    counterGroup.rotation.x = pose.counter;
    for (const p of mainGroups) p.rotation.x = pose.main;
    for (const [name, p] of gearsOf) p.rotation.x = pose.gears[name];
    idlerGroup.position.x = idlerBaseX + pose.idlerX;
    idlerGroup.rotation.x = pose.gears.idler;
    for (const h of Object.keys(SY.hubs)) {
      const s = sleeveGroups[h];
      s.position.x = hubX(h) + pose.sleeves[h];
      s.rotation.x = pose.main;
    }
    for (const [ring, p] of Object.entries(ringGroups)) {
      const r = pose.rings[ring], hub = ring === 'ring1' || ring === 'ring2' ? 's12' : ring === 'ring3' || ring === 'ring4' ? 's34' : 's5';
      p.position.x = hubX(hub) - p.userData.sign * LOCAL.ringRetreat * (1 - r.push);
      p.rotation.x = r.angle;
    }
  }
  update({
    input: 0, counter: 0, main: 0, gears: { g1: 0, g2: 0, g3: 0, g5: 0, idler: 0 }, idlerX: 0,
    sleeves: { s12: 0, s34: 0, s5: 0 }, rings: Object.fromEntries(Object.keys(ringGroups).map(k => [k, { angle: 0, push: 0 }])),
  });
  return { group, update };
}
