import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SPEC } from '../spec.js';
import { derive, rad, deg, mod } from '../kin/derive.js';
import { valveLift, camAngle } from '../kin/cam.js';
import { pistonCrownY, throwAngle, cylinderVolume } from '../kin/engine.js';
import { mat } from '../geo/materials.js';
import { partGroup, segs } from '../geo/parts.js';
import { buildHeadGeometry, buildPedestalGeometry, headTopY } from '../geo/topHead.js';
import { buildValveGeometries, latheSolid } from '../geo/topValve.js';
import { chargeCloud, portFrame, buildManifoldGeometry, MANIFOLD_LEN } from '../geo/topGas.js';
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
// gas-exchange visuals (docs/plan/G1-gas-flow.md)
const G = { blue: hex('#58b4ff'), violet: hex('#9a7bff'), yw: hex('#fff1a8'), orange: hex('#ff7a1a'), dark: hex('#7a2b12'), exh: hex('#cdb38b'), hot: hex('#c9703a') };
const GAS = { M: 140, streamN: 14, chargeR: 1.9, streamR: 2.3, liftMin: 0.05 };

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

  // ───────────── manifold stubs (static, head body) ─────────────
  for (const [id, kind, label] of [['intakeManifold', 'in', 'Sací potrubí'], ['exhaustManifold', 'ex', 'Výfukové potrubí']]) {
    const part = partGroup(id, 'head', label, { static: true });
    const m = new THREE.Mesh(buildManifoldGeometry(spec, L, kind), mat('housing'));
    m.userData.housing = true;
    m.name = id + 'Tubes';
    part.add(m);
    group.add(part);
  }

  // ───────────── gas volumes, charge particles, port streams, sparks and flame (visual only) ─────────────
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
  const cloud = chargeCloud(spec, GAS.M), M = GAS.M, NS = GAS.streamN;
  const tanG = Math.tan(gamma), Vc = D.clearanceVolume, Vd = D.displacement;
  const EVO = D.valve.ex.openDeg;
  const tipY = apex - E.head.sparkPlug.tipProtrusion - 1;     // flame origin / spark position (cylinder-local x = 0, z = 0)
  const sphereLo = new THREE.IcosahedronGeometry(1, 0), sphereHi = new THREE.IcosahedronGeometry(1, 1);
  const chargeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const sparkMat = new THREE.MeshBasicMaterial({ color: 0xfff4b0 });
  const sparkGeo = new THREE.SphereGeometry(3, 16, 12);
  const starGeos = [new THREE.BoxGeometry(11, 0.7, 0.7), new THREE.BoxGeometry(0.7, 11, 0.7), new THREE.BoxGeometry(0.7, 0.7, 11)];
  const glowGeo = new THREE.SphereGeometry(1, 20, 14);

  const newInstanced = (geo, material, n, withColor) => {
    const im = new THREE.InstancedMesh(geo, material, n);
    im.userData.noCollide = true;
    im.frustumCulled = false;
    const e = im.instanceMatrix.array;
    for (let i = 0; i < n; i++) { e.fill(0, i * 16, i * 16 + 16); e[i * 16 + 15] = 1; }
    if (withColor) im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3);
    return im;
  };
  const putInst = (im, i, x, y, z, s) => {
    const e = im.instanceMatrix.array, o = i * 16;
    e[o] = s; e[o + 5] = s; e[o + 10] = s; e[o + 12] = x; e[o + 13] = y; e[o + 14] = z;
  };

  // port streams: waypoint polyline (outer -> inner) in the cylinder-local frame; points 5..7 depend on the valve lift
  const NP = 8;
  const makeStream = (kind, which) => {
    const f = portFrame(spec, L, kind, which);
    const sx = which ? 1 : -1, t = f.tFace;
    const pts = new Float64Array(NP * 3);
    const set = (i, x, y, r) => {                 // valve-local (x, y along the axis, r along the outward direction)
      pts[i * 3] = f.seat[0] + x;
      pts[i * 3 + 1] = f.seat[1] + f.a[1] * y + f.o[1] * r;
      pts[i * 3 + 2] = f.seat[2] + f.a[2] * y + f.o[2] * r;
    };
    const onPort = (i, tt) => { for (let c = 0; c < 3; c++) pts[i * 3 + c] = f.q0[c] + f.dir[c] * tt; };
    onPort(0, t + MANIFOLD_LEN - 2); onPort(1, t); onPort(2, 9);
    set(3, sx * 9, 10, 0); set(4, 0, 5, -(f.rNeck - 1.6));
    return { f, kind, which, pts, cum: new Float64Array(NP), set };
  };

  const gas = [], sparks = [];
  D.cylX.forEach((cx, i) => {
    const gm = new THREE.MeshBasicMaterial({ color: 0x5fb3ff, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
    const gp = partGroup(`gas${i + 1}`, 'head', `Plyn ve válci ${i + 1}`, { static: true });
    gp.position.x = cx;
    const lower = new THREE.Mesh(gasLower, gm); lower.userData.noCollide = true;
    const cap = new THREE.Mesh(gasCap, gm); cap.userData.noCollide = true;
    gp.add(lower, cap);
    const charge = newInstanced(sphereLo, chargeMat, M, true);
    charge.name = `gasCharge${i + 1}`;
    gp.add(charge);
    const streams = [];
    for (const kind of ['in', 'ex']) for (const which of [0, 1]) {
      const st = makeStream(kind, which);
      st.mat = new THREE.MeshBasicMaterial({ color: kind === 'in' ? 0x58b4ff : 0xcdb38b, toneMapped: false });
      st.mesh = newInstanced(sphereHi, st.mat, NS, false);
      st.mesh.name = `gasStream${i + 1}${kind}${which ? 'b' : 'a'}`;
      st.mesh.visible = false;
      gp.add(st.mesh);
      streams.push(st);
    }
    group.add(gp);
    gas.push({ gp, lower, mat: gm, charge, streams, dist: new Float32Array(M), Rf: 0 });

    const sp = partGroup(`spark${i + 1}`, 'head', `Jiskra ${i + 1}`, { static: true });
    sp.position.set(cx, tipY, 0);
    const sm = new THREE.Mesh(sparkGeo, sparkMat); sm.userData.noCollide = true; sm.visible = false; sm.name = `sparkCore${i + 1}`;
    sp.add(sm);                                   // children[0] stays the spark core (tests / app rely on it)
    const star = starGeos.map(g => { const m = new THREE.Mesh(g, sparkMat); m.userData.noCollide = true; m.visible = false; sp.add(m); return m; });
    const glow = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ color: 0xffa030, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    glow.userData.noCollide = true; glow.visible = false; glow.name = `flameGlow${i + 1}`;
    sp.add(glow);
    group.add(sp);
    sparks.push({ core: sm, star, glow });
    gas[i].spark = sparks[i];
  });

  const _c = new THREE.Color(), _c2 = new THREE.Color();
  const EDGE = 0.07;
  const edge = u => Math.min(1, u / EDGE, (1 - u) / EDGE);

  function updateStream(st, g, crown, lift, flow, phase, hot) {
    const mesh = st.mesh;
    const on = lift > GAS.liftMin && flow > 0;
    mesh.visible = on;
    if (st.kind === 'in') st.mat.color.copy(G.blue); else st.mat.color.copy(G.hot).lerp(G.exh, hot);
    if (!on) { for (let j = 0; j < NS; j++) putInst(mesh, j, 0, 0, 0, 0); mesh.instanceMatrix.needsUpdate = true; return; }
    const f = st.f, d = spec.engine.valves.seatGap + lift, sx = st.which ? 1 : -1, rh = f.rh;
    st.set(5, 0, 2.2 - d * 0.5, -(rh - 1.2));
    st.set(6, 0, (2.2 - d) * 0.5, -(rh + 0.9));
    st.set(7, 0, -d - 10, -(rh + 6));
    const p = st.pts, cum = st.cum;
    cum[0] = 0;
    for (let k = 1; k < NP; k++) cum[k] = cum[k - 1] + Math.hypot(p[k * 3] - p[k * 3 - 3], p[k * 3 + 1] - p[k * 3 - 2], p[k * 3 + 2] - p[k * 3 - 1]);
    const total = cum[NP - 1], inward = st.kind === 'in';
    const size = GAS.streamR * Math.max(0.3, Math.min(1, lift / 2)) * flow;
    for (let j = 0; j < NS; j++) {
      let u = j / NS + phase; u -= Math.floor(u);
      const sdist = (inward ? u : 1 - u) * total;
      let k = 1; while (k < NP - 1 && cum[k] < sdist) k++;
      const w = (sdist - cum[k - 1]) / Math.max(1e-9, cum[k] - cum[k - 1]);
      const x = p[k * 3 - 3] + (p[k * 3] - p[k * 3 - 3]) * w;
      let y = p[k * 3 - 2] + (p[k * 3 + 1] - p[k * 3 - 2]) * w;
      const z = p[k * 3 - 1] + (p[k * 3 + 2] - p[k * 3 - 1]) * w;
      if (y < crown + 1.5) y = crown + 1.5;
      putInst(mesh, j, x, y, z, size * edge(u));
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  function updateGas(pose) {
    const cyl = pose.cylinders;
    for (let i = 0; i < gas.length; i++) {
      const g = gas[i], sp = g.spark;
      if (!cyl || !cyl[i]) {
        g.gp.visible = false; sp.core.visible = false; sp.glow.visible = false;
        for (const m of sp.star) m.visible = false;
        continue;
      }
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
      g.mat.opacity = a * 0.4;

      // ---- cycle state of this cylinder ----
      const psi = s.psiDeg ?? mod(deg(pose.crank) - D.firingAngleDeg[i], 720);
      const exhausting = psi >= EVO && psi < 360;
      const blow = exhausting ? 1 - Math.exp(-(psi - EVO) / 15) : 0;                 // 0 at EVO -> 1
      const vfrac = clamp01((cylinderVolume(rad(psi)) - Vc) / Vd);
      const inducted = psi >= 540 || psi < EVO ? 1 : psi >= 360 ? vfrac : 0;
      const remaining = exhausting ? (psi < 180 ? 1 : vfrac) * (1 - 0.35 * blow) : psi >= 360 ? 0 : 1;
      const frac = exhausting ? remaining : inducted;
      const rank = exhausting ? cloud.rankEx : cloud.rankIn;
      const limit = frac * M;

      // ---- flame front ----
      const burning = s.phase === 'combustion' && s.burn > 0.02 && s.burn < 0.98;
      const burnt = s.burn > 0.02;
      const dist = g.dist;
      let dmax = 0, Rf = 0;
      const ch = g.charge, ce = ch.instanceMatrix.array, cc = ch.instanceColor.array;
      const R2 = GAS.chargeR;
      for (let k = 0; k < M; k++) {
        const x = cloud.x[k], z = cloud.z[k];
        const roof = apex - Math.abs(z) * tanG, span = roof - crown;
        const m = Math.min(R2, span * 0.45);
        const y = crown + m + cloud.h[k] * (span - 2 * m);
        if (rank[k] < limit) putInst(ch, k, x, y, z, R2); else putInst(ch, k, x, y, z, 0);
        if (burnt) { const dd = Math.hypot(x, y - tipY, z); dist[k] = dd; if (rank[k] < limit && dd > dmax) dmax = dd; }
      }
      if (burnt) Rf = Math.pow(clamp01(s.burn), 1 / 3) * dmax;
      g.Rf = Rf;

      // base colour of unburned / bulk charge
      switch (s.phase) {
        case 'intake': _c.copy(G.blue); break;
        case 'exhaust': _c.copy(G.dark).lerp(G.exh, blow); break;
        case 'compression': _c.copy(G.blue).lerp(G.violet, clamp01((s.pBar - 1) / 15)); break;
        default:
          if (burnt) _c.copy(G.orange).lerp(G.dark, 1 - clamp01((s.pBar - 1) / 40));
          else _c.copy(G.blue).lerp(G.violet, clamp01((s.pBar - 1) / 15));
      }
      const pre = s.phase === 'combustion';
      _c2.copy(G.blue).lerp(G.violet, clamp01((s.pBar - 1) / 15)); if (pre) _c2.copy(G.violet);
      const bb = s.burn * s.burn, fadeLen = Math.max(1e-6, 0.35 * dmax);
      for (let k = 0; k < M; k++) {
        const o = k * 3;
        if (pre) {
          if (dist[k] < Rf) {
            const t = Math.max(clamp01((Rf - dist[k]) / fadeLen), bb);
            cc[o] = G.yw.r + (G.orange.r - G.yw.r) * t; cc[o + 1] = G.yw.g + (G.orange.g - G.yw.g) * t; cc[o + 2] = G.yw.b + (G.orange.b - G.yw.b) * t;
          } else { cc[o] = _c2.r; cc[o + 1] = _c2.g; cc[o + 2] = _c2.b; }
        } else { cc[o] = _c.r; cc[o + 1] = _c.g; cc[o + 2] = _c.b; }
      }
      ch.instanceMatrix.needsUpdate = true; ch.instanceColor.needsUpdate = true;

      // ---- port streams ----
      const hot = blow;
      const liftIn = valveLift('in', i, pose.crank), liftEx = valveLift('ex', i, pose.crank);
      const fadeIn = psi >= 540 && psi < 720 ? Math.max(0, 1 - (psi - 540) / 25) : 1;
      for (let q = 0; q < 4; q++) {
        const st = g.streams[q];
        if (st.kind === 'in') updateStream(st, g, crown, liftIn, fadeIn, 3 * inducted, 0);
        else updateStream(st, g, crown, liftEx, 1, 3 * (1 - remaining), hot);
      }

      // ---- ignition ----
      sp.core.visible = !!s.spark;
      for (const m of sp.star) m.visible = !!s.spark;
      const glowOn = burning && Rf > 0;
      sp.glow.visible = glowOn;
      const r = glowOn ? Math.max(0.5, Math.min(Rf, tipY - crown - 0.5, D.R * 0.98)) : 0.001;
      sp.glow.scale.setScalar(r);
      sp.glow.material.opacity = glowOn ? 0.45 * (1 - 0.5 * s.burn) : 0;
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
