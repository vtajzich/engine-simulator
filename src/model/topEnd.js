import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SPEC } from '../spec.js';
import { derive } from '../kin/derive.js';
import { valveLift, camAngle } from '../kin/cam.js';
import { pistonCrownY, throwAngle } from '../kin/engine.js';
import { mat } from '../geo/materials.js';
import { partGroup, segs } from '../geo/parts.js';
import { buildHeadGeometry, buildPedestalGeometry, headTopY } from '../geo/topHead.js';
import { buildValveGeometries, latheSolid } from '../geo/topValve.js';
import { lobeGeometry, shaftGeometry, sprocketGeometry, flangeGeometry, beltPath, beltBandGeometry } from '../geo/topCam.js';

// Dimensions that are not in SPEC (decorative / construction choices of this module).
const LOCAL = {
  headTopAbove: 60,        // head casting top = deckHeight + this (SPEC.head.height is the visual casting height; only the lower part is modelled)
  halfZ: 78,               // head half width in Z
  wellStart: 25, wellRadius: 11,          // plug well: floor at apex + wellStart, radius
  neckTop: 16, portStart: 12, portTiltDeg: 55,   // valve neck height / port start along the valve axis / port tilt from the axis
  guideClearance: 0.25, pocketClearance: 0.3,
  pedHalfLen: 8, pedHalfZ: 22, pedBore: 0.2,     // cam bearing pedestals: 16 mm long in X
  tulipLength: 11, retainerRadius: 12.5, retainerFromTip: 10, retainerThickness: 3, bucketWall: 2,
  beltThickness: 2, beltToothPitch: 8, sprocketFlange: 1.5,
  plugShellRadius: 6, plugNutRadius: 9.2,
};

const YELLOW = new THREE.Color();
const hex = h => new THREE.Color(h);
const C = {
  intake: hex('#5fb3ff'), compA: hex('#5fb3ff'), compB: hex('#8f6bff'), burnA: hex('#fff1a8'), burnB: hex('#ff7a1a'),
  expA: hex('#ff7a1a'), expB: hex('#7a2b12'), exhaust: hex('#8d8d8d'),
};
const clamp01 = x => Math.min(1, Math.max(0, x));

export function buildTopEnd(spec = SPEC) {
  const D = derive(spec), E = spec.engine, VT = E.valvetrain, TD = E.timingDrive, V = E.valves;
  const L = LOCAL;
  const group = new THREE.Group();
  group.name = 'topEnd';
  const topY = headTopY(spec, L);
  const apex = D.roofApexY, gamma = D.gamma;

  // ───────────── head (static) ─────────────
  const headPart = partGroup('head', 'head', 'Hlava válců', { static: true });
  const headMesh = new THREE.Mesh(buildHeadGeometry(spec, L), mat('housing'));
  headMesh.userData.housing = true;
  headMesh.name = 'headCasting';
  headPart.add(headMesh);
  group.add(headPart);

  const capsPart = partGroup('camCaps', 'head', 'Ložiska vačkových hřídelí', { static: true });
  const capsMesh = new THREE.Mesh(mergeGeometries(buildPedestalGeometry(spec, L)), mat('housing'));
  capsMesh.userData.housing = true;
  capsPart.add(capsMesh);
  group.add(capsPart);

  // spark plugs (body head, not housing)
  const plugGeos = [];
  {
    const tip = E.head.sparkPlug.tipProtrusion, rT = L.plugShellRadius, ws = L.wellStart;
    const shell = latheSolid([[0, -tip], [rT, -tip], [rT, ws - 0.1], [0, ws - 0.1]], 48);
    const nut = new THREE.CylinderGeometry(L.plugNutRadius, L.plugNutRadius, 8, 6); nut.translate(0, ws + 0.2 + 4, 0);
    const y0 = ws + 8.2;
    const ceramic = latheSolid([[0, y0 - 1], [5.2, y0 - 1], [5.2, y0 + 14], [4.2, y0 + 16], [4.2, y0 + 40], [0, y0 + 40]], 48);
    const term = latheSolid([[0, y0 + 39], [1.6, y0 + 39], [1.6, y0 + 52], [3.0, y0 + 52], [3.0, y0 + 55], [0, y0 + 55]], 32);
    plugGeos.push([shell, mat('steel')], [nut, mat('steelDark')], [ceramic, mat('ceramic')], [term, mat('steel')]);
  }
  D.cylX.forEach((cx, i) => {
    const p = partGroup(`sparkPlug${i + 1}`, 'head', `Zapalovací svíčka ${i + 1}`, { static: true });
    p.position.set(cx, apex, 0);
    for (const [g, m] of plugGeos) p.add(new THREE.Mesh(g, m));
    group.add(p);
  });

  // ───────────── valves ─────────────
  const valves = [];   // { part, seat, axis, kind, cyl, spring }
  const gV = {};
  for (const kind of ['in', 'ex']) {
    const vd = D.valve[kind];
    const seat0 = vd.seat(0, 0);
    const t0 = (topY - seat0[1]) / Math.cos(gamma);       // spring seat on the head top, along the valve axis
    gV[kind] = buildValveGeometries(spec, L, kind, vd.headRadius, t0);
    gV[kind].t0 = t0;
  }
  for (const kind of ['in', 'ex']) {
    const vd = D.valve[kind], g = gV[kind];
    const nm = kind === 'in' ? 'valveIn' : 'valveEx';
    const label = kind === 'in' ? 'Sací ventil' : 'Výfukový ventil';
    const m = mat(kind === 'in' ? 'intake' : 'exhaust');
    for (let c = 0; c < E.cylinders; c++) {
      for (const which of [0, 1]) {
        const id = `${nm}${c + 1}${which ? 'b' : 'a'}`;
        const seat = vd.seat(c, which);
        const part = partGroup(id, id, label);
        part.rotation.x = vd.side * gamma;
        part.position.set(seat[0], seat[1], seat[2]);
        part.add(new THREE.Mesh(g.valve, m), new THREE.Mesh(g.retainer, mat('steel')), new THREE.Mesh(g.bucket, mat('polished')));
        group.add(part);

        const sp = partGroup(id.replace('valve', 'spring'), 'head', 'Pružina ventilu', { static: true });
        sp.rotation.x = vd.side * gamma;
        sp.position.set(seat[0] + vd.axis[0] * g.t0, seat[1] + vd.axis[1] * g.t0, seat[2] + vd.axis[2] * g.t0);
        const sm = new THREE.Mesh(g.spring, mat('steelDark'));
        sm.userData.noCollide = true;
        sp.add(sm);
        group.add(sp);
        valves.push({ part, seat, axis: vd.axis, kind, c, springMesh: sm, springLen: g.springLen });
      }
    }
  }

  // ───────────── camshafts ─────────────
  const camX0 = TD.x - TD.width / 2 - L.sprocketFlange - 3, camX1 = E.block.rearX - 10;
  const cams = {};
  for (const kind of ['in', 'ex']) {
    const ax = D.valve[kind].camAxis, K = kind === 'in' ? 'In' : 'Ex';
    const cam = partGroup(`cam${K}`, `cam${K}`, kind === 'in' ? 'Sací vačková hřídel' : 'Výfuková vačková hřídel');
    cam.position.set(0, ax.y, ax.z);
    const shaft = new THREE.Mesh(shaftGeometry(VT.camShaftDiameter / 2, camX0, camX1, segs(12)), mat('steel'));
    shaft.name = `shaft${K}`;
    cam.add(shaft);
    for (let c = 0; c < E.cylinders; c++) for (const which of [0, 1]) {
      const xc = D.valve[kind].seat(c, which)[0];
      const lobe = new THREE.Mesh(lobeGeometry(kind, c, VT.lobeWidth, xc), mat('steelDark'));
      lobe.name = `lobe${K}${c + 1}${which ? 'b' : 'a'}`;
      cam.add(lobe);
    }
    group.add(cam);
    const spr = partGroup(`camSprocket${K}`, `cam${K}`, 'Řemenice vačky');
    spr.position.copy(cam.position);
    const s = sprocketGeometry(TD.camTeeth, TD.pitch, TD.width, TD.x);
    spr.add(new THREE.Mesh(s.body, mat('aluminium')));
    for (const sgn of [-1, 1]) {
      const xa = TD.x + sgn * TD.width / 2;
      spr.add(new THREE.Mesh(flangeGeometry(s.rp + 2, 0, Math.min(xa, xa + sgn * L.sprocketFlange), Math.max(xa, xa + sgn * L.sprocketFlange)), mat('aluminium')));
    }
    group.add(spr);
    cams[kind] = { cam, spr, rp: s.rp };
  }

  // ───────────── crank sprocket (body crank) ─────────────
  const crankSpr = partGroup('crankSprocket', 'crank', 'Řemenice klikového hřídele');
  const cs = sprocketGeometry(TD.crankTeeth, TD.pitch, TD.width, TD.x, E.crank.noseDiameter / 2);
  crankSpr.add(new THREE.Mesh(cs.body, mat('aluminium')));
  for (const sgn of [-1, 1]) {
    const xa = TD.x + sgn * TD.width / 2;
    crankSpr.add(new THREE.Mesh(flangeGeometry(cs.rp + 2, E.crank.noseDiameter / 2, Math.min(xa, xa + sgn * L.sprocketFlange), Math.max(xa, xa + sgn * L.sprocketFlange)), mat('aluminium')));
  }
  group.add(crankSpr);

  // ───────────── belt (visual only) ─────────────
  const path = beltPath([
    { p: 0, q: 0, r: cs.rp },
    { p: D.valve.in.camAxis.y, q: D.valve.in.camAxis.z, r: cams.in.rp },
    { p: D.valve.ex.camAxis.y, q: D.valve.ex.camAxis.z, r: cams.ex.rp },
  ]);
  const beltPart = partGroup('belt', 'head', 'Rozvodový řemen', { static: true });
  const band = new THREE.Mesh(beltBandGeometry(path, -0.6, -0.6 + L.beltThickness, TD.width, TD.x), mat('rubber'));
  band.userData.noCollide = true;
  beltPart.add(band);
  const nTeeth = Math.round(path.total / L.beltToothPitch);
  const toothGeo = new THREE.BoxGeometry(TD.width - 2, 2.0, L.beltToothPitch * 0.5);
  const teeth = new THREE.InstancedMesh(toothGeo, mat('rubber'), nTeeth);
  teeth.userData.noCollide = true;
  teeth.frustumCulled = false;
  beltPart.add(teeth);
  group.add(beltPart);
  const tmpPt = { p: 0, q: 0, nAngle: 0 };
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
  const X_AXIS = new THREE.Vector3(1, 0, 0);
  function updateBelt(crank) {
    const shift = crank * cs.rp, pitch = path.total / nTeeth;
    for (let k = 0; k < nTeeth; k++) {
      path.at(k * pitch + shift, -1.6, tmpPt);
      _q.setFromAxisAngle(X_AXIS, tmpPt.nAngle);
      _p.set(TD.x, tmpPt.p, tmpPt.q);
      teeth.setMatrixAt(k, _m.compose(_p, _q, _s));
    }
    teeth.instanceMatrix.needsUpdate = true;
  }

  // ───────────── gas volumes and sparks (visual only) ─────────────
  const Rg = D.R - 0.6;
  const gasLower = new THREE.CylinderGeometry(Rg, Rg, 1, 48, 1, false);
  gasLower.translate(0, 0.5, 0);
  const gasCap = new THREE.CylinderGeometry(Rg, Rg, 1, 64, 1, false);
  {
    const pos = gasCap.attributes.position, H = apex - D.headFaceY;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, pos.getY(i) > 0 ? H - Math.abs(pos.getZ(i)) * Math.tan(gamma) : 0);
    }
    gasCap.translate(0, D.headFaceY, 0);
    gasCap.computeVertexNormals();
  }
  const gas = [], sparks = [];
  const sparkGeo = new THREE.SphereGeometry(2.5, 16, 12);
  const sparkMat = new THREE.MeshBasicMaterial({ color: 0xfff4b0 });
  D.cylX.forEach((cx, i) => {
    const gm = new THREE.MeshBasicMaterial({ color: 0x5fb3ff, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
    const gp = partGroup(`gas${i + 1}`, 'head', `Plyn ve válci ${i + 1}`, { static: true });
    gp.position.x = cx;
    const lower = new THREE.Mesh(gasLower, gm); lower.userData.noCollide = true;
    const cap = new THREE.Mesh(gasCap, gm); cap.userData.noCollide = true;
    gp.add(lower, cap);
    group.add(gp);
    gas.push({ gp, lower, mat: gm });

    const sp = partGroup(`spark${i + 1}`, 'head', `Jiskra ${i + 1}`, { static: true });
    sp.position.set(cx, apex - E.head.sparkPlug.tipProtrusion - 1, 0);
    const sm = new THREE.Mesh(sparkGeo, sparkMat); sm.userData.noCollide = true; sm.visible = false;
    sp.add(sm);
    group.add(sp);
    sparks.push(sm);
  });

  function updateGas(pose) {
    const cyl = pose.cylinders;
    for (let i = 0; i < gas.length; i++) {
      const g = gas[i];
      if (!cyl || !cyl[i]) { g.gp.visible = false; sparks[i].visible = false; continue; }
      const s = cyl[i];
      g.gp.visible = true;
      const crown = pistonCrownY(throwAngle(pose.crank, i));
      g.lower.position.y = crown;
      g.lower.scale.y = Math.max(1e-3, D.headFaceY - crown);
      const col = g.mat.color;
      let a;
      switch (s.phase) {
        case 'intake': col.copy(C.intake); a = 0.22; break;
        case 'compression': { const t = clamp01((s.pBar - 1) / 15); col.copy(C.compA).lerp(C.compB, t); a = 0.22 + 0.28 * t; break; }
        case 'combustion': col.copy(C.burnA).lerp(C.burnB, clamp01(s.burn)); a = 0.8; break;
        case 'expansion': { const t = 1 - clamp01((s.pBar - 1) / 40); col.copy(C.expA).lerp(C.expB, t); a = 0.6 - 0.3 * t; break; }
        default: col.copy(C.exhaust); a = 0.3;
      }
      g.mat.opacity = a;
      sparks[i].visible = !!s.spark;
    }
  }

  function update(pose) {
    const cr = pose.crank;
    for (const v of valves) {
      const d = E.valves.seatGap + valveLift(v.kind, v.c, cr);
      v.part.position.set(v.seat[0] - v.axis[0] * d, v.seat[1] - v.axis[1] * d, v.seat[2] - v.axis[2] * d);
      v.springMesh.scale.y = Math.max(0.05, 1 - (d - E.valves.seatGap) / v.springLen);
    }
    const ai = pose.camIn ?? camAngle(cr), ae = pose.camEx ?? camAngle(cr);
    cams.in.cam.rotation.x = ai; cams.in.spr.rotation.x = ai;
    cams.ex.cam.rotation.x = ae; cams.ex.spr.rotation.x = ae;
    crankSpr.rotation.x = cr;
    updateBelt(cr);
    updateGas(pose);
  }
  update({ crank: 0 });
  return { group, update };
}
