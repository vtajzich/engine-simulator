// Deterministic driveline simulation: engine, clutch (Karnopp stick-slip), blocker-ring synchronizers, unsynchronised
// reverse idler, vehicle. Pure JS, no DOM. See docs/plan/A2-simulation.md.
import { SPEC } from '../spec.js';
import { derive, wrapTo } from '../kin/derive.js';
import { releaseKin } from '../kin/clutch.js';
import { guardOf } from './guard.js';
import { gearLinear, gearForSleeve, gearNumber, ringForGear } from '../kin/gears.js';
import { maxMisalign, xRingTip, xBlock, xDogTip, xEngaged, advanceRing, advanceDog } from '../kin/synchro.js';

const TAU = 2 * Math.PI;
const RPM = 30 / Math.PI;                      // rad/s -> rpm
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sgn = v => (v > 0 ? 1 : v < 0 ? -1 : 0);
const smooth = t => { const c = clamp(t, 0, 1); return c * c * (3 - 2 * c); };
const RINGS = ['ring1', 'ring2', 'ring3', 'ring4', 'ring5'];
const RAIL_COL = { s12: -1, s34: 0, s5: 1 };
const COL_RAIL = { '-1': 's12', '0': 's34', '1': 's5' };
const ENGINE_FRICTION_COULOMB = 14, ENGINE_FRICTION_VISC = 0.011, STARTER_NM = 60;
const PEDAL_FULL_TRAVEL_S = 0.12;
const SYNC_TOL = 0.3;                          // rad/s
const REV_ALIGN_TOL = 5e-4;                    // rad of mainshaft angle (x 50 mm = 0.025 mm)
const REV_ALIGN_RATE = 8;                      // rad/s of mesh residual removed while the idler approaches

// Coulomb-friction integration of one inertia: sticks exactly at zero.
function slide(J, w, T, F, h) {
  if (w === 0) return Math.abs(T) <= F ? 0 : ((T - sgn(T) * F) / J) * h;
  const w1 = w + ((T - sgn(w) * F) / J) * h;
  return sgn(w1) !== sgn(w) ? 0 : w1;
}

export function createSim(spec = SPEC) {
  const D = derive(spec);
  const E = spec.engine, GB = spec.gearbox, V = spec.vehicle, C = spec.clutch, SY = GB.synchro, SH = GB.shift, RV = GB.reverse;
  const ratios = D.gearbox.ratios;
  const { P, pitchAngle } = D.synchro;
  const Rt = V.tyreRadiusM / V.finalDrive;
  const Je = V.engineInertia, Jin = GB.inputSideInertia, Jv = V.massKg * Rt * Rt;
  const kAero = 0.5 * 1.2 * V.cdA * Rt ** 3;
  const Croll = V.massKg * 9.81 * V.rollingResistance * Rt;
  const dragNm = GB.inputDragNm;
  const lin = gearLinear('counter');

  // gear records: id '1'..'5','R'
  const GEARS = {};
  for (const [sleeve, m] of Object.entries(gearForSleeve)) {
    for (const [sg, name] of Object.entries(m)) {
      const id = gearNumber[name], { A, B } = gearLinear(name);
      GEARS[id] = { id, name, sleeve, sign: +sg, ratio: ratios[id], A, B, ring: ringForGear[name] };
    }
  }
  { const { A, B } = gearLinear('revMain'); GEARS.R = { id: 'R', name: 'revMain', sleeve: 's5', sign: -1, ratio: ratios.R, A, B, ring: null }; }
  const GEAR_BY_RAIL = {};
  for (const g of Object.values(GEARS)) (GEAR_BY_RAIL[g.sleeve] ??= {})[g.sign] = g;
  const revPitch = TAU / RV.main;
  const xEngRev = Math.abs(RV.idlerTravel);

  const w0 = E.idleRpm / RPM;
  const state = {
    t: 0,
    angleScale: 1,
    thetaCrank: 0, omegaCrank: w0,
    thetaInput: 0, omegaInput: w0,
    thetaMain: 0, omegaMain: 0,
    clutchPedal: 0,
    clutch: { capacityNm: C.maxTorqueNm, locked: true, torqueNm: 0, guard: 0 },
    rails: { s12: 0, s34: 0, s5: 0 },
    lever: { col: 0, row: 0, target: 'N' },
    synchro: {
      active: null,
      ringIndex: Object.fromEntries(RINGS.map(k => [k, 0])),
      ringPush: Object.fromEntries(RINGS.map(k => [k, 0])),
    },
    gear: 'N',
    lock: null,
    engine: { running: true, stalled: false, torqueNm: 0, throttleEff: 0.1 },
    rpm: { engine: E.idleRpm, input: E.idleRpm, counter: 0, main: 0 },
    speedKmh: 0,
    flow: [],
  };

  let events = [];
  let angleScale = 1;
  const emit = (type, detail) => events.push({ t: state.t, type, detail });
  let idleI = 0.1, cranking = false, slipDir = 1;
  let tie = null;                              // { g, K, sign }: input side kinematically tied to the mainshaft
  let att = { grindClutch: false, syncStart: false, grindRev: false };
  const relaxed = Object.fromEntries(RINGS.map(k => [k, false]));
  let pedalCache = { p: -1, cap: 0 };

  const capacityFor = p => {
    if (pedalCache.p !== p) pedalCache = { p, cap: releaseKin(p).capacity * C.maxTorqueNm };
    return pedalCache.cap;
  };

  // ───────────── synchronizer / idler logic for the moving rail ─────────────
  const ringIdxMag = X => 0.25 * P * smooth((X - 0.3) / (xRingTip - 0.3));    // = ringIndexFraction * P at full

  function startTie(g, sign) {
    const s = state;
    tie = { g, K: g.A * s.thetaInput + g.B - s.thetaMain, sign };
    s.omegaInput = g.ratio * s.omegaMain;
    if (s.clutch.locked) s.omegaCrank = s.omegaInput;
  }
  function releaseTie() { tie = null; }
  function releaseActive() {
    const s = state;
    if (tie) releaseTie();
    if (s.gear !== 'N') { s.gear = 'N'; s.lock = null; }
    s.synchro.active = null;
    for (const k of RINGS) s.synchro.ringIndex[k] = 0;
    att = { grindClutch: false, syncStart: false, grindRev: false };
  }
  function engageCheck(g, a, X, xEng, clearBelow) {
    const s = state;
    if (X >= xEng - 1e-9) {
      if (a.phase !== 'engaged') {
        a.phase = 'engaged'; s.gear = g.id; s.lock = { gear: g.id, K: tie.K };
        emit('gearEngaged', g.id);
      }
    } else {
      if (a.phase === 'engaged') a.phase = 'indexing';
      if (X < clearBelow && s.gear !== 'N') { s.gear = 'N'; s.lock = null; }
    }
  }

  // returns the travel actually reached (≤ requested X)
  function forwardStep(g, a, X) {
    const s = state;
    const ringName = g.ring;
    a.cone = false;
    if (!tie) {
      if (X < 0.3) {
        a.phase = 'free';
        att.grindClutch = att.syncStart = false;
      } else {
        const dw = g.A * s.omegaInput - s.omegaMain;
        if (Math.abs(dw) <= SYNC_TOL) {
          startTie(g, a.sgn ?? 0);
          emit('syncDone', g.id);
          a.phase = 'indexing';
        } else {
          a.phase = 'blocking'; a.sgn = sgn(dw);
          X = Math.min(X, xBlock);
          if (X >= xBlock - 0.05) {
            if (!att.syncStart) { att.syncStart = true; emit('syncStart', g.id); }
            if (!att.grindClutch && (s.clutch.locked || s.clutch.capacityNm > 20)) { att.grindClutch = true; emit('grind', 'clutch'); }
          }
          a.cone = X >= xBlock - 0.05;
        }
      }
    }
    if (tie) {
      a.cone = false;
      if (X < 0.3) { releaseTie(); a.phase = 'free'; att.grindClutch = att.syncStart = false; X = Math.max(X, 0); }
      else {
        X = Math.min(X, xEngaged);
        if (X >= xDogTip) {
          const d = wrapTo(tie.K - pitchAngle / 2, pitchAngle);
          const lim = maxMisalign(advanceDog(X)) / spec.gearbox.synchro.pitchRadius;
          if (Math.abs(d) > lim) tie.K += sgn(d) * lim - d;
        }
        engageCheck(g, a, X, xEngaged, xDogTip);
        if (s.lock) s.lock.K = tie.K;
      }
    }
    // ring index
    for (const k of RINGS) s.synchro.ringIndex[k] = 0;
    if (a.phase === 'blocking' || a.phase === 'indexing') {
      const sg = tie ? tie.sign : a.sgn ?? 0;
      s.synchro.ringIndex[ringName] = sg * Math.min(ringIdxMag(X), maxMisalign(advanceRing(X)));
    }
    return X;
  }

  function reverseStep(g, a, X, engaging) {
    const s = state;
    if (!tie) {
      const e = wrapTo(s.thetaMain - (g.A * s.thetaInput + g.B), revPitch);
      const ok = Math.abs(s.omegaInput) < 3 && Math.abs(s.omegaMain) < 0.5;
      a.phase = 'free';
      if (X < 0.3) att.grindRev = false;
      if (!ok) {
        const cap = RV.entryGap - 0.1;
        if (engaging && X >= cap) {   // only while the driver pushes toward reverse, not when pulling out of it
          X = cap; a.phase = 'blocking';
          if (!att.grindRev) { att.grindRev = true; emit('grind', 'reverse'); }
        }
      } else {
        let e2 = e;
        if (X >= 0.5) {
          s.omegaInput = 0; if (s.clutch.locked) s.omegaCrank = 0;
          const de = clamp(e, -REV_ALIGN_RATE * dtSub, REV_ALIGN_RATE * dtSub);
          s.thetaInput += de / g.A; e2 = e - de;
        }
        if (X > RV.entryGap) {
          if (Math.abs(e2) < REV_ALIGN_TOL) {
            startTie(g, 0); a.phase = 'indexing';
          } else { X = RV.entryGap; a.phase = 'blocking'; }
        }
      }
    }
    if (tie) {
      if (X <= RV.entryGap) { releaseTie(); a.phase = 'free'; if (s.gear !== 'N') { s.gear = 'N'; s.lock = null; } att.grindRev = false; }
      else {
        X = Math.min(X, xEngRev);
        engageCheck(g, a, X, xEngRev, RV.entryGap);
        if (s.lock) s.lock.K = tie.K;
      }
    }
    return X;
  }

  let dtSub = 0;
  function moveRails(h, target) {
    const s = state, L = s.lever;
    L.target = target;
    const gate = SH.gate[target] ?? SH.gate.N;
    const cs = gate[0], xdBase = gate[1] * SH.railTravel;
    let act = null;
    for (const k of ['s12', 's34', 's5']) if (s.rails[k] !== 0) act = k;
    let key, xd;
    if (act) { key = act; xd = RAIL_COL[act] === cs ? xdBase : 0; L.col = RAIL_COL[act]; }
    else {
      const mc = h / SH.selectTime, dc = cs - L.col;
      L.col = Math.abs(dc) <= mc ? cs : L.col + sgn(dc) * mc;
      if (L.col !== cs) { L.row = 0; return; }
      key = COL_RAIL[cs]; xd = xdBase;
    }
    const x = s.rails[key], step = SH.shiftSpeed * h;
    let xn = Math.abs(xd - x) <= step ? xd : x + sgn(xd - x) * step;
    if (x !== 0 && xn !== 0 && sgn(xn) !== sgn(x)) xn = 0;
    if (xn === 0) {
      if (x !== 0 || s.synchro.active) releaseActive();
      s.rails[key] = 0; L.row = 0;
      return;
    }
    const sign = sgn(xn);
    let a = s.synchro.active;
    if (!a || a.sleeve !== key || a.sign !== sign) {
      if (a) releaseActive();
      const g = GEAR_BY_RAIL[key][sign];
      a = s.synchro.active = { sleeve: key, sign, gear: g.name, phase: 'free' };
      att = { grindClutch: false, syncStart: false, grindRev: false };
    }
    const g = GEAR_BY_RAIL[key][sign];
    let X = Math.abs(xn);
    X = g.id === 'R' ? reverseStep(g, a, X, Math.abs(xd) > Math.abs(x)) : forwardStep(g, a, X);
    s.rails[key] = sign * X;
    L.row = s.rails[key] / SH.railTravel;
  }

  function updateRingPush(h) {
    const s = state, a = s.synchro.active;
    for (const k of RINGS) {
      const act = !!a && ringForGear[a.gear] === k;
      const cur = s.synchro.ringPush[k];
      if (act && a.phase !== 'engaged') {
        const X = Math.abs(s.rails[a.sleeve]);
        const target = clamp(X / 0.3, 0, 1);
        if (relaxed[k]) { const v = Math.min(target, cur + 10 * h); s.synchro.ringPush[k] = v; if (v >= target) relaxed[k] = false; }
        else s.synchro.ringPush[k] = Math.max(target, 0);
      } else {
        if (act) relaxed[k] = true;
        else if (cur > 0) relaxed[k] = true;
        s.synchro.ringPush[k] = Math.max(0, cur - 10 * h);
        if (s.synchro.ringPush[k] === 0) relaxed[k] = false;
      }
    }
  }

  // ───────────── one sub-step ─────────────
  function sub(h, inp) {
    const s = state;
    dtSub = h;
    // pedal
    const mx = h / PEDAL_FULL_TRAVEL_S;
    // optional slip guard (inputs.clutchGuard): pedal target = max(user/driver pedal, guard(rpm)), re-evaluated every sub-step
    const guard = inp.clutchGuard && s.gear !== 'N' && s.engine.running ? guardOf(s.omegaCrank * RPM) : 0;
    s.clutch.guard = guard;
    s.clutchPedal += clamp(Math.max(inp.clutchPedal, guard) - s.clutchPedal, -mx, mx);
    const cap = capacityFor(s.clutchPedal);
    s.clutch.capacityNm = cap;

    // engine run state
    const eng = s.engine;
    let wE = s.omegaCrank, rpmE = wE * RPM, starter = 0;
    if (!inp.ignition) {
      cranking = false;
      if (eng.running) { eng.running = false; emit('stop'); }
    } else if (!eng.running) {
      if (rpmE > 400) { eng.running = true; eng.stalled = false; cranking = false; emit('start'); }
      else if (rpmE < 300 || cranking) { cranking = true; starter = STARTER_NM; }
    }
    if (eng.running && rpmE < 300) { eng.running = false; eng.stalled = true; emit('stall'); }
    let idle = 0;
    if (eng.running) {
      const err = E.idleRpm - rpmE;
      idleI = clamp(idleI + 0.004 * err * h, 0, 0.25);
      idle = clamp(0.0008 * err + idleI, 0, 0.25);
    }
    const thr = eng.running ? Math.max(clamp(inp.throttle, 0, 1), idle) : 0;
    eng.throttleEff = thr;
    let Tind = 0;
    if (eng.running && rpmE < E.redlineRpm) {
      const shape = Math.max(0.3, 1 - 0.35 * ((rpmE - 4800) / 4800) ** 2);
      Tind = thr * E.maxTorqueNm * shape;
    }
    eng.torqueNm = Tind;
    const TeD = Tind + starter - ENGINE_FRICTION_VISC * wE;
    const Fe = ENGINE_FRICTION_COULOMB;

    // lever, rails, synchro
    moveRails(h, inp.lever);
    updateRingPush(h);

    // dynamics
    const G = tie ? tie.g : null, iG = G ? G.ratio : 1;
    const a = s.synchro.active;
    const brake = clamp(inp.brake, 0, 1);
    const Fv = Croll + brake * 2600 / V.finalDrive;
    let syncTin = 0;
    if (!G && a && a.cone && a.phase === 'blocking') {
      const gg = GEAR_BY_RAIL[a.sleeve][a.sign];
      syncTin = GB.synchroTorqueNm * sgn(gg.ratio * s.omegaMain - s.omegaInput);
    }
    const Jx = G ? Jin + Jv / (iG * iG) : Jin;
    const Fx = dragNm + (G ? Fv / Math.abs(iG) : 0);
    const Tx = w => (G ? -kAero * (w / iG) * Math.abs(w / iG) / iG : syncTin);
    let wX = s.omegaInput, wM = s.omegaMain, Tc = 0;
    const cl = s.clutch;

    const lockedEval = (w) => {
      const J = Je + Jx, T = TeD + Tx(w), F = Fe + Fx;
      const w1 = slide(J, w, T, F, h);
      let Treq;
      if (w === 0 && w1 === 0) Treq = sgn(TeD) * Math.max(0, Math.abs(TeD) - Fe);
      else {
        const sg = w !== 0 ? sgn(w) : sgn(T);
        Treq = TeD - Fe * sg - Je * ((w1 - w) / h);
      }
      return { w1, Treq };
    };

    let done = false;
    if (cl.locked) {
      const { w1, Treq } = lockedEval(wE);
      if (cap > 1e-9 && Math.abs(Treq) <= cap) { wE = wX = w1; Tc = Treq; done = true; }
      else { cl.locked = false; slipDir = sgn(Treq) || 1; wX = wE; }
    }
    if (!done) {
      const sl = wE - wX;
      const sg = Math.abs(sl) > 1e-9 ? sgn(sl) : slipDir;
      Tc = cap * sg;
      const wE1 = slide(Je, wE, TeD - Tc, Fe, h);
      const wX1 = slide(Jx, wX, Tc + Tx(wX), Fx, h);
      const s1 = wE1 - wX1;
      wE = wE1; wX = wX1;
      if (cap > 1e-9 && (sl * s1 <= 0 || Math.abs(s1) < 0.05)) {
        const wc = (Je * wE1 + Jx * wX1) / (Je + Jx);
        const { Treq } = lockedEval(wc);
        if (Math.abs(Treq) <= cap) { cl.locked = true; wE = wX = wc; Tc = Treq; }
      }
    }
    cl.torqueNm = Tc;

    if (G) wM = wX / iG;
    else {
      const gg = a && a.cone && a.phase === 'blocking' ? GEAR_BY_RAIL[a.sleeve][a.sign] : null;
      const Tv = -kAero * wM * Math.abs(wM) - (gg ? syncTin * gg.ratio : 0);
      wM = slide(Jv, wM, Tv, Fv, h);
    }

    s.omegaCrank = wE; s.omegaInput = wX; s.omegaMain = wM;
    // angleScale slows only the displayed rotation; every velocity/torque above stays in real time
    const ha = h * angleScale;
    s.thetaCrank += wE * ha;
    s.thetaMain += wM * ha;
    if (tie) s.thetaInput = (s.thetaMain + tie.K - tie.g.B) / tie.g.A;
    else s.thetaInput += wX * ha;
    s.t += h;
  }

  function finish() {
    const s = state;
    s.rpm.engine = s.omegaCrank * RPM;
    s.rpm.input = s.omegaInput * RPM;
    s.rpm.counter = lin.A * s.omegaInput * RPM;
    s.rpm.main = s.omegaMain * RPM;
    s.speedKmh = s.omegaMain * Rt * 3.6;
    const flow = [];
    if (s.engine.running) flow.push('crank');
    const transmits = Math.abs(s.clutch.torqueNm) > 1;
    const moving = s.gear !== 'N' && (Math.abs(s.omegaMain) > 1e-3 || Math.abs(s.omegaInput) > 1e-3);
    if (transmits || moving) {
      if (transmits) flow.push('clutchDisc', 'inputShaft');
      if (s.gear !== 'N') {
        const g = GEARS[s.gear];
        if (s.gear === '4') flow.push('sleeve34');
        else if (s.gear === 'R') flow.push('counterShaft', 'idlerR');
        else flow.push('counterShaft', 'gear' + s.gear, 'sleeve' + g.sleeve.slice(1));
        flow.push('mainShaft');
      }
    }
    s.flow = flow;
  }

  function step(dt, inputs = {}) {
    const inp = {
      throttle: inputs.throttle ?? 0, clutchPedal: inputs.clutchPedal ?? 0, brake: inputs.brake ?? 0,
      lever: inputs.lever ?? 'N', ignition: inputs.ignition ?? true, clutchGuard: inputs.clutchGuard === true,
    };
    if (!(dt > 0)) return;
    const n = Math.ceil(dt / 0.0005 - 1e-9), h = dt / n;
    for (let i = 0; i < n; i++) sub(h, inp);
    finish();
  }

  function rotateCrank(dTheta) {
    const s = state;
    s.thetaCrank += dTheta;
    const coupled = s.clutch.locked || (s.clutch.capacityNm > 0 && s.omegaCrank === 0 && s.omegaInput === 0);
    if (!coupled) return;
    if (tie) {
      s.thetaMain += dTheta / tie.g.ratio;
      s.thetaInput = (s.thetaMain + tie.K - tie.g.B) / tie.g.A;
    } else s.thetaInput += dTheta;
  }

  return {
    step, rotateCrank, state, drainEvents() { const e = events; events = []; return e; },
    get angleScale() { return angleScale; },
    set angleScale(v) { angleScale = clamp(Number.isFinite(v) ? v : 1, 0.0005, 1); state.angleScale = angleScale; },
  };
}

export default createSim;
