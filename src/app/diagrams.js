// 2D canvases and live tables: timing strip, p–V loop, piston kinematics, clutch curve, gauges, ratio/shaft tables.
import { SPEC } from '../spec.js';
import { derive, deg, rad, mod } from '../kin/derive.js';
import { cylinderVolume, gasState, pistonPinY, pistonVelocityPerRad, strokeOf } from '../kin/engine.js';
import { releaseKin } from '../kin/clutch.js';
import { gearLinear } from '../kin/gears.js';
import { xRingTip, xBlock, xDogTip, xEngaged } from '../kin/synchro.js';
import { ui, num as fmt } from './content/index.js';

const TX = ui.diag;

const D = derive();
const E = SPEC.engine;
export const COL = {
  amber: '#ff9e2c', blue: '#5aa9e6', red: '#ff5a4a', dim: '#8b93a1', faint: '#5b6270', line: '#2a2f38', text: '#d9dde3',
  intake: '#4f9fe0', compression: '#c9a83c', power: '#ff7a2f', exhaust: '#7d8591', spark: '#ffe45e',
};
const STROKE_COL = { intake: COL.intake, compression: COL.compression, power: COL.power, exhaust: COL.exhaust };
const STROKE_CS = TX.strokes;
const FONT = '10px ui-monospace, "SF Mono", Menlo, monospace';
const SANS = '10px -apple-system, "Helvetica Neue", Arial, sans-serif';

export function sizeCanvas(c, cssH) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = c.clientWidth || 340;
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(cssH * dpr)) {
    c.width = Math.round(w * dpr); c.height = Math.round(cssH * dpr); c.style.height = cssH + 'px';
  }
  const ctx = c.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, cssH);
  return { ctx, w, h: cssH };
}
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

function wrapper(caption, ...children) {
  const d = el('div', 'diagram');
  if (caption) d.appendChild(el('div', 'cap', caption));
  children.forEach(c => d.appendChild(c));
  return d;
}

/* ---------------------------------------------------------------- timing strip */
function timingStrip({ cyls, rowH, caption }) {
  const c = el('canvas');
  const root = wrapper(caption, c);
  const H = 22 + cyls.length * rowH + 16;
  return {
    el: root,
    update({ pose, state }) {
      const { ctx, w } = sizeCanvas(c, H);
      const padL = 34, padR = 8, X = d => padL + (d / 720) * (w - padL - padR);
      const thr = state.engine?.throttleEff ?? 0.3;
      const adv = E.sparkAdvanceDeg.idle + (E.sparkAdvanceDeg.load - E.sparkAdvanceDeg.idle) * thr;
      ctx.font = FONT; ctx.textBaseline = 'middle';
      const seg = (d0, d1, y, h, fill) => {   // draws [d0,d1) crank degrees with wrap at 720
        d0 = mod(d0, 720); d1 = d0 + (d1 - d0);
        const a = d0, b = d0 + (d1 - d0);
        ctx.fillStyle = fill;
        if (b <= 720) ctx.fillRect(X(a), y, X(b) - X(a), h);
        else { ctx.fillRect(X(a), y, X(720) - X(a), h); ctx.fillRect(X(0), y, X(b - 720) - X(0), h); }
      };
      cyls.forEach((cy, i) => {
        const y0 = 6 + i * rowH, f = D.firingAngleDeg[cy];
        ctx.fillStyle = COL.dim; ctx.textAlign = 'left'; ctx.fillText('V' + (cy + 1), 4, y0 + rowH * 0.3);
        const bandH = rowH * 0.5;
        // strokes: cycle angle psi in [0,180) power, [180,360) exhaust, [360,540) intake, [540,720) compression
        for (const [name, p0] of [['power', 0], ['exhaust', 180], ['intake', 360], ['compression', 540]]) {
          const d0 = mod(p0 + f, 720);
          seg(d0, d0 + 180, y0, bandH, STROKE_COL[name] + (name === 'power' ? 'dd' : '99'));
          const x0 = X(d0), x1 = X(d0 + 180 > 720 ? 720 : d0 + 180);
          if (rowH >= 30 && x1 - x0 > 52) { ctx.fillStyle = '#10131a'; ctx.textAlign = 'center'; ctx.font = SANS; ctx.fillText(STROKE_CS[name], (x0 + x1) / 2, y0 + bandH / 2); ctx.font = FONT; }
        }
        // valve bars
        const vy = y0 + bandH + 3, vh = Math.max(3, (rowH - bandH - 6) / 2 - 1);
        const iv = D.valve.in, ev = D.valve.ex;
        seg(iv.openDeg + f, iv.closeDeg + f, vy, vh, COL.intake);
        seg(ev.openDeg + f, ev.closeDeg + f, vy + vh + 2, vh, COL.amber);
        // spark
        const sp = mod(720 - adv + f, 720);
        ctx.fillStyle = COL.spark; ctx.fillRect(X(sp) - 1, y0 - 3, 2.2, bandH + 6);
      });
      // axis
      const yA = 6 + cyls.length * rowH + 4;
      ctx.strokeStyle = COL.line; ctx.beginPath(); ctx.moveTo(X(0), yA); ctx.lineTo(X(720), yA); ctx.stroke();
      ctx.fillStyle = COL.faint; ctx.textAlign = 'center';
      for (const d of [0, 180, 360, 540, 720]) { ctx.fillRect(X(d) - 0.5, yA, 1, 3); ctx.fillText(d + '°', X(d), yA + 11); }
      // cursor
      const cur = mod(deg(pose.crank), 720);
      ctx.strokeStyle = COL.text; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(X(cur), 1); ctx.lineTo(X(cur), yA); ctx.stroke(); ctx.lineWidth = 1;
    },
  };
}

/* ---------------------------------------------------------------- p–V diagram */
function pvDiagram() {
  const c = el('canvas');
  const info = el('div', 'num', '');
  info.style.cssText = 'margin-top:4px;font-size:11px;color:#8b93a1';
  const root = wrapper(TX.pvCaption, c, info);
  let key = null, pts = [], pMax = 70;
  const build = thr => {
    pts = []; pMax = 10;
    for (let psi = 0; psi <= 720; psi += 2) {
      const g = gasState(psi, thr), V = cylinderVolume(rad(psi)) / 1000;
      pts.push({ V, p: g.pBar, s: strokeOf(psi) }); pMax = Math.max(pMax, g.pBar);
    }
    pMax = Math.ceil(pMax / 10) * 10 + 5;
  };
  return {
    el: root,
    update({ pose, state }) {
      const thr = Math.round((state.engine?.throttleEff ?? 0.3) * 20) / 20;
      if (thr !== key) { key = thr; build(thr); }
      const { ctx, w, h } = sizeCanvas(c, 200);
      const L = 34, R = 8, T = 24, B = 32, vMax = 560;
      const X = v => L + (v / vMax) * (w - L - R), Y = p => h - B - (p / pMax) * (h - B - T);
      ctx.font = FONT; ctx.fillStyle = COL.faint; ctx.strokeStyle = '#1e232b';
      for (let p = 0; p <= pMax; p += 10) { ctx.beginPath(); ctx.moveTo(L, Y(p)); ctx.lineTo(w - R, Y(p)); ctx.stroke(); ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(p, L - 4, Y(p)); }
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (let v = 0; v <= 500; v += 100) ctx.fillText(v, X(v), h - B + 4);
      ctx.textBaseline = 'alphabetic'; ctx.fillText(TX.pvAxisV, (L + w) / 2, h - 3); ctx.textBaseline = 'top';
      ctx.lineWidth = 2;
      for (let i = 1; i < pts.length; i++) {
        ctx.strokeStyle = STROKE_COL[pts[i].s]; ctx.beginPath(); ctx.moveTo(X(pts[i - 1].V), Y(pts[i - 1].p)); ctx.lineTo(X(pts[i].V), Y(pts[i].p)); ctx.stroke();
      }
      ctx.lineWidth = 1;
      const cy = pose.cylinders?.[0];
      if (cy) {
        const V = cylinderVolume(rad(cy.psiDeg)) / 1000;
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(X(V), Y(cy.pBar), 4.5, 0, 7); ctx.fill();
        ctx.strokeStyle = COL.amber; ctx.stroke();
        info.innerHTML = TX.pvInfo(STROKE_CS[cy.stroke] ?? '', fmt(cy.psiDeg), fmt(cy.pBar, 1), fmt(V));
      }
      // legend
      let lx = L + 2; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      for (const k of ['intake', 'compression', 'power', 'exhaust']) { ctx.fillStyle = STROKE_COL[k]; ctx.fillRect(lx, 5, 8, 8); ctx.fillStyle = COL.dim; ctx.fillText(STROKE_CS[k], lx + 11, 9); lx += ctx.measureText(STROKE_CS[k]).width + 24; }
    },
  };
}

/* ---------------------------------------------------------------- piston kinematics */
function pistonDiagram() {
  const c = el('canvas');
  const info = el('div', 'num', ''); info.style.cssText = 'margin-top:4px;font-size:11px;color:#8b93a1';
  const root = wrapper(TX.pistonCaption, c, info);
  const r = D.r, S = 2 * r;
  const N = 180, s = [], v = [];
  let vMax = 0, aMax = 0;
  for (let i = 0; i <= N; i++) {
    const a = rad(i * 2);
    s.push((r + D.L - pistonPinY(a)) / S);
    v.push(-pistonVelocityPerRad(a) / r);
    if (v[i] > vMax) { vMax = v[i]; aMax = i * 2; }
  }
  return {
    el: root,
    update({ pose }) {
      const { ctx, w, h } = sizeCanvas(c, 180);
      const L = 28, R = 8, T = 20, B = 22;
      const X = d => L + (d / 360) * (w - L - R), Y = f => h - B - f * (h - B - T);
      ctx.font = FONT; ctx.fillStyle = COL.faint; ctx.strokeStyle = '#1e232b';
      for (const f of [0, 0.5, 1]) { ctx.beginPath(); ctx.moveTo(L, Y(f)); ctx.lineTo(w - R, Y(f)); ctx.stroke(); ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(f === 1 ? '86' : f === 0.5 ? '43' : '0', L - 4, Y(f)); }
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (const d of [0, 90, 180, 270, 360]) ctx.fillText(d + '°', X(d), h - B + 4);
      // sine reference
      ctx.setLineDash([4, 3]); ctx.strokeStyle = COL.dim; ctx.beginPath();
      for (let i = 0; i <= N; i++) { const f = (1 - Math.cos(rad(i * 2))) / 2; i ? ctx.lineTo(X(i * 2), Y(f)) : ctx.moveTo(X(0), Y(f)); }
      ctx.stroke(); ctx.setLineDash([]);
      ctx.lineWidth = 2; ctx.strokeStyle = COL.amber; ctx.beginPath();
      for (let i = 0; i <= N; i++) i ? ctx.lineTo(X(i * 2), Y(s[i])) : ctx.moveTo(X(0), Y(s[0]));
      ctx.stroke();
      ctx.strokeStyle = COL.blue; ctx.beginPath();
      for (let i = 0; i <= N; i++) { const f = 0.5 + 0.5 * v[i] / vMax; i ? ctx.lineTo(X(i * 2), Y(f)) : ctx.moveTo(X(0), Y(f)); }
      ctx.stroke(); ctx.lineWidth = 1;
      // max speed marker
      ctx.strokeStyle = COL.blue; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(X(aMax), Y(1)); ctx.lineTo(X(aMax), Y(0)); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = COL.blue; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(TX.vMax(aMax), X(aMax) + 4, Y(0.05));
      const a = mod(deg(pose.crank), 360), i = a / 2;
      const f = s[Math.round(i)] ?? 0;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(X(a), Y(f), 4, 0, 7); ctx.fill();
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      let lx = L + 2;
      for (const [t, col] of [[TX.pistonTravel, COL.amber], [TX.pistonSine, COL.dim], [TX.pistonSpeed, COL.blue]]) { ctx.fillStyle = col; ctx.fillText(t, lx, 6); lx += ctx.measureText(t).width + 14; }
      info.innerHTML = TX.pistonInfo(fmt(a), fmt(f * S, 1));
    },
  };
}

/* ---------------------------------------------------------------- clutch curve */
function clutchCurve() {
  const c = el('canvas');
  const info = el('div', 'num', ''); info.style.cssText = 'margin-top:4px;font-size:11px;color:#8b93a1;line-height:1.5';
  const root = wrapper(TX.curveCaption, c, info);
  const N = 80, cap = [], lift = [], brg = [];
  for (let i = 0; i <= N; i++) { const k = releaseKin(i / N); cap.push(k.capacity); lift.push(k.plateLift / SPEC.clutch.plateLift); brg.push(k.bearingTravel / releaseKin(1).bearingTravel); }
  return {
    el: root,
    update({ pose }) {
      const { ctx, w, h } = sizeCanvas(c, 176);
      const L = 34, R = 8, T = 24, B = 22;
      const X = p => L + p * (w - L - R), Y = f => h - B - f * (h - B - T);
      ctx.font = FONT; ctx.fillStyle = COL.faint; ctx.strokeStyle = '#1e232b';
      for (const f of [0, 0.5, 1]) { ctx.beginPath(); ctx.moveTo(L, Y(f)); ctx.lineTo(w - R, Y(f)); ctx.stroke(); ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(f * 100 + '%', L - 4, Y(f)); }
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (const p of [0, 0.25, 0.5, 0.75, 1]) ctx.fillText(Math.round(p * 100) + '%', X(p), h - B + 4);
      ctx.fillText(TX.pedalTravel, (L + w) / 2, h - 11);
      const line = (arr, col, dash) => { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash(dash || []); ctx.beginPath(); arr.forEach((v, i) => i ? ctx.lineTo(X(i / N), Y(v)) : ctx.moveTo(X(0), Y(v))); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1; };
      line(brg, COL.dim, [4, 3]); line(lift, COL.blue); line(cap, COL.amber);
      const p = Math.min(1, Math.max(0, pose.clutchPedal ?? 0)), k = releaseKin(p);
      ctx.strokeStyle = '#ffffff55'; ctx.beginPath(); ctx.moveTo(X(p), Y(0)); ctx.lineTo(X(p), Y(1)); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(X(p), Y(k.capacity), 4, 0, 7); ctx.fill();
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      let lx = L - 28;
      for (const [t, col] of [[TX.capacity, COL.amber], [TX.plateLift, COL.blue], [TX.bearingTravelDashed, COL.dim]]) { ctx.fillStyle = col; ctx.fillText(t, lx, 7); lx += ctx.measureText(t).width + 14; }
      info.innerHTML = TX.curveInfo(fmt(k.bearingTravel, 1), fmt(k.plateLift, 2), fmt(k.capacity * 100), fmt(k.capacity * SPEC.clutch.maxTorqueNm));
    },
  };
}

/** Clutch chapter: live values (pedal, bearing travel, plate lift, gaps, capacity, slip, state) above the release curve. */
function clutchLive() {
  const curve = clutchCurve();
  const grid = el('div', 'live');
  const keys = ['pedal', 'brg', 'lift', 'gap', 'cap', 'slip', 'state'].map(k => [k, TX.live[k]]);
  const cells = {};
  for (const [k, t] of keys) { const r = el('div', 'lv'); r.append(el('span', '', t)); const v = el('b', 'num', '—'); r.appendChild(v); grid.appendChild(r); cells[k] = v; }
  const root = curve.el; root.querySelector('.cap').after(grid);
  const cs = SPEC.clutch;
  return {
    el: root,
    update(ctx) {
      curve.update(ctx);
      const s = ctx.state, p = Math.min(1, Math.max(0, s.clutchPedal ?? 0)), k = releaseKin(p), c = s.clutch;
      cells.pedal.textContent = fmt(p * 100) + ' %';
      cells.brg.textContent = fmt(k.bearingTravel, 1) + ' mm';
      cells.lift.textContent = fmt(k.plateLift, 2) + ' mm';
      cells.gap.textContent = fmt(cs.faceGap + k.discShift, 2) + ' mm';
      cells.cap.textContent = fmt(c.capacityNm / cs.maxTorqueNm * 100) + ' % (' + fmt(c.capacityNm) + ' N·m)';
      const slip = s.rpm.engine - s.rpm.input;
      cells.slip.textContent = fmt(slip) + ' ' + ui.rpm;
      const st = c.locked ? 'on' : c.capacityNm > 1 ? 'slip' : 'open';
      cells.state.textContent = st === 'on' ? ui.dock.engaged : st === 'slip' ? ui.dock.slipping : ui.dock.released;
      cells.state.dataset.s = st;
    },
  };
}

/* ---------------------------------------------------------------- tables */
const GEAR_ROWS = ['1', '2', '3', '4', '5', 'R'];
const gearLabel = g => (g === 'R' ? 'R' : g);
function ratioTable() {
  const pr = SPEC.gearbox.pairs, rv = SPEC.gearbox.reverse, ratios = D.gearbox.ratios;
  const body = GEAR_ROWS.map(g => {
    let teeth;
    if (g === '4') teeth = TX.directDrive;
    else if (g === 'R') teeth = `${pr.input.counter}/${pr.input.main} · ${rv.main}/${rv.counter}`;
    else { const p = pr['g' + g]; teeth = `${pr.input.counter}/${pr.input.main} · ${p.main}/${p.counter}`; }
    return `<tr data-g="${g}"><td>${gearLabel(g)}</td><td>${teeth}</td><td class="${ratios[g] < 0 ? 'neg' : ''}">${fmt(ratios[g], 3)}</td></tr>`;
  }).join('');
  const t = el('table', 'dtable', `<thead><tr><th>${TX.thGear}</th><th>${TX.thTeeth}</th><th>${TX.thRatio}</th></tr></thead><tbody>${body}</tbody>`);
  const info = el('div', '', ''); info.style.cssText = 'margin-top:6px;font-size:11px;color:#8b93a1';
  info.innerHTML = TX.ratioInfo;
  const root = wrapper(TX.ratioCaption, t, info);
  let cur = null;
  return { el: root, update({ state }) { if (state.gear !== cur) { cur = state.gear; t.querySelectorAll('tbody tr').forEach(r => r.classList.toggle('hl', r.dataset.g === String(cur))); } } };
}

function shaftTable() {
  const rows = [
    ['in', TX.shaft.in], ['counter', TX.shaft.counter], ['g1', TX.shaft.g1], ['g2', TX.shaft.g2],
    ['g3', TX.shaft.g3], ['g5', TX.shaft.g5], ['main', TX.shaft.main],
  ];
  const t = el('table', 'dtable', `<thead><tr><th>${TX.thBody}</th><th>${ui.rpm}</th><th>${TX.thRatioEngine}</th></tr></thead><tbody>${rows.map(r => `<tr data-k="${r[0]}"><td>${r[1]}</td><td class="n"></td><td class="q"></td></tr>`).join('')}</tbody>`);
  const root = wrapper(TX.shaftCaption, t);
  const cells = {};
  rows.forEach(r => { const tr = t.querySelector(`[data-k="${r[0]}"]`); cells[r[0]] = { n: tr.querySelector('.n'), q: tr.querySelector('.q') }; });
  const A = { g1: gearLinear('g1').A, g2: gearLinear('g2').A, g3: gearLinear('g3').A, g5: gearLinear('g5').A, counter: gearLinear('counter').A };
  return {
    el: root,
    update({ state }) {
      const rin = state.rpm.input, rm = state.rpm.main, re = state.rpm.engine;
      const val = { in: rin, counter: A.counter * rin, g1: A.g1 * rin, g2: A.g2 * rin, g3: A.g3 * rin, g5: A.g5 * rin, main: rm };
      // a gear that is locked turns with the output shaft; otherwise gear speeds follow the input
      for (const k of Object.keys(val)) {
        const v = val[k], c = cells[k];
        c.n.textContent = fmt(v); c.n.className = 'n' + (v < -0.5 ? ' neg' : '');
        c.q.textContent = Math.abs(re) > 20 ? fmt(v / re, 3) : '—';
      }
    },
  };
}

function reverseInfo() {
  const root = wrapper(TX.reverseCaption);
  const bar = el('canvas'); root.appendChild(bar);
  const info = el('div', 'num', ''); info.style.cssText = 'margin-top:4px;font-size:11px;color:#8b93a1;line-height:1.5'; root.appendChild(info);
  const rv = SPEC.gearbox.reverse;
  return {
    el: root,
    update({ state }) {
      const { ctx, w, h } = sizeCanvas(bar, 46);
      const x = state.rails?.s5 ?? 0, L = 8, R = 8;
      const X = v => L + ((v + 10) / 20) * (w - L - R);   // −10 … +10 mm
      ctx.fillStyle = '#1b2028'; ctx.fillRect(X(-10), 16, X(10) - X(-10), 6);
      ctx.fillStyle = COL.faint; ctx.font = FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.textAlign = 'left'; ctx.fillText(TX.reverseLeft, X(-10), 30);
      ctx.textAlign = 'center'; ctx.fillText('N', X(0), 30);
      ctx.textAlign = 'right'; ctx.fillText(TX.reverseRight, X(10), 30);
      ctx.fillStyle = COL.amber; ctx.fillRect(X(rv.entryGap > 0 ? -rv.entryGap : 0) - 1, 11, 2, 16);   // entry gap marker
      ctx.fillStyle = '#fff'; ctx.fillRect(X(x) - 3, 8, 6, 22);
      const stopped = Math.abs(state.rpm.input) < 29 && Math.abs(state.rpm.main) < 4.8;
      info.innerHTML = TX.reverseInfo(fmt(x, 1), fmt(state.rpm.input), fmt(state.rpm.main, 1)) + '<br>' +
        (stopped ? `<span style="color:#6ccf8e">${TX.reverseStopped}</span>` : `<span style="color:#ff9e2c">${TX.reverseTurning}</span>`);
    },
  };
}

/* ---------------------------------------------------------------- power chain */
function chain() {
  const nodes = [
    [TX.chain.crank, 'crank', s => s.rpm.engine],
    [TX.chain.disc, 'clutchDisc', s => s.rpm.input],
    [TX.chain.input, 'inputShaft', s => s.rpm.input],
    [TX.chain.counter, 'counterShaft', s => -s.rpm.input * 34 / 46],
    [TX.chain.freeGear, ['gear1', 'gear2', 'gear3', 'gear5', 'sleeve12', 'sleeve34', 'sleeve5', 'idlerR'], null],
    [TX.chain.output, 'mainShaft', s => s.rpm.main],
  ];
  const wrap = el('div', 'chain');
  const els = nodes.map((n, i) => {
    const e = el('div', 'node', `${n[0]}<small class="num"></small>`);
    wrap.appendChild(e); if (i < nodes.length - 1) wrap.appendChild(el('div', 'arr', '▼'));
    return e;
  });
  const root = wrapper(TX.chainCaption, wrap);
  return {
    el: root,
    update({ state }) {
      const flow = new Set(state.flow ?? []);
      nodes.forEach((n, i) => {
        const bodies = [].concat(n[1]);
        els[i].classList.toggle('on', bodies.some(b => flow.has(b)));
        els[i].querySelector('small').textContent = n[2] ? `${fmt(n[2](state))} ${ui.rpm}` : '';
      });
    },
  };
}

/* ---------------------------------------------------------------- synchronizer */
const GEAR_NAME = TX.gearNames;
function syncDiagram() {
  const c = el('canvas');
  const info = el('div', 'num', ''); info.style.cssText = 'margin-top:4px;font-size:11px;color:#8b93a1;line-height:1.55';
  const root = wrapper(TX.syncCaption, c, info);
  const marks = [[xRingTip, TX.syncMarks.cone], [xBlock, TX.syncMarks.blocking], [xDogTip, TX.syncMarks.teeth], [xEngaged, TX.syncMarks.engaged]];
  let lastGear = null;
  const track = createSyncTracker();
  return {
    el: root,
    update({ state }) {
      const { ctx, w, h } = sizeCanvas(c, 96);
      const { act, x, text: phText } = track(state);
      const L = 10, R = 10, X = v => L + (v / xEngaged) * (w - L - R);
      ctx.fillStyle = '#1b2028'; ctx.fillRect(X(0), 30, X(xEngaged) - X(0), 8);
      ctx.fillStyle = COL.amber; ctx.fillRect(X(0), 30, X(x) - X(0), 8);
      ctx.font = FONT; ctx.textBaseline = 'top';
      marks.forEach(([v, t], i) => {
        ctx.fillStyle = v === xBlock ? COL.red : COL.dim; ctx.fillRect(X(v) - 0.5, 24, 1.5, 20);
        ctx.textAlign = i === marks.length - 1 ? 'right' : 'left';
        const xt = i === marks.length - 1 ? X(v) + 2 : X(v) - 2, y0 = i % 2 ? 66 : 48;
        ctx.fillText(t, xt, y0);
        ctx.fillText(`${fmt(v, 1)} mm`, xt, y0 + 10);
      });
      ctx.fillStyle = '#fff'; ctx.fillRect(X(x) - 3, 20, 6, 22);
      const ph = act?.phase;
      let gearName = act?.gear ?? lastGear; if (act?.gear) lastGear = act.gear;
      let dn = '—';
      if (act && gearName) { const A = gearLinear(gearName).A; dn = fmt(Math.abs(A * state.rpm.input - state.rpm.main)) + ' ' + ui.rpm; }
      info.innerHTML = `${TX.syncPhase}<b style="color:${ph === 'blocking' ? '#ff5a4a' : '#ff9e2c'}">${act ? phText : TX.syncIdle}</b>` +
        (gearName && act ? TX.syncChoice(GEAR_NAME[gearName] ?? gearName) : '') + TX.syncPos(fmt(x, 2)) + '<br>' +
        TX.syncDiff(dn, !!state.clutch?.locked);
    },
  };
}

/** Tracks whether the active sleeve is moving toward a gear or leaving it (the sim keeps `synchro.active` set while disengaging). */
export function createSyncTracker() {
  let lastX = 0, leaving = false;
  return function status(state) {
    const act = state.synchro?.active;
    let sleeve = act?.sleeve;
    if (!sleeve) for (const k of ['s12', 's34', 's5']) if (Math.abs(state.rails[k]) > 1e-4) sleeve = k;
    const x = sleeve ? Math.abs(state.rails[sleeve]) : 0;
    if (x < lastX - 0.004) leaving = true; else if (x > lastX + 0.004) leaving = false;
    lastX = x;
    if (!act) return { act, x, sleeve, text: '—', phase: null };
    const text = leaving ? ui.syncPhases.leaving : ui.syncPhases[act.phase] ?? act.phase;
    return { act, x, sleeve, text, phase: leaving ? 'leaving' : act.phase };
  };
}

export function createDiagram(kind) {
  switch (kind) {
    case 'timing1': return timingStrip({ cyls: [0], rowH: 52, caption: TX.timing1Caption });
    case 'timing4': return timingStrip({ cyls: [0, 1, 2, 3], rowH: 34, caption: TX.timing4Caption });
    case 'pv': return pvDiagram();
    case 'piston': return pistonDiagram();
    case 'clutchCurve': return clutchCurve();
    case 'clutchLive': return clutchLive();
    case 'ratios': return ratioTable();
    case 'shafts': return shaftTable();
    case 'reverse': return reverseInfo();
    case 'chain': return chain();
    case 'sync': return syncDiagram();
    default: return null;
  }
}

/* ---------------------------------------------------------------- cylinder table (poradi chapter) */
export function createCylinderTable() {
  const t = el('table', 'dtable', `<thead><tr><th>${TX.thCyl}</th><th>${TX.thStroke}</th><th>${TX.thCycleAngle}</th><th>${TX.thP}</th></tr></thead><tbody>${[0, 1, 2, 3].map(i => `<tr><td>${i + 1}</td><td></td><td></td><td></td></tr>`).join('')}</tbody>`);
  const root = wrapper(TX.cylCaption, t);
  const rows = [...t.querySelectorAll('tbody tr')];
  return {
    el: root,
    update({ pose }) {
      pose.cylinders?.forEach((c, i) => {
        const tds = rows[i].children;
        const s = c.phase === 'combustion' ? TX.strokes.combustion : STROKE_CS[c.stroke] ?? c.stroke;
        tds[1].textContent = s; tds[2].textContent = fmt(c.psiDeg) + '°'; tds[3].textContent = fmt(c.pBar, 1);
        rows[i].classList.toggle('hl', c.stroke === 'power');
      });
    },
  };
}

/* ---------------------------------------------------------------- gauges */
export function drawGauge(canvas, { value, max, majorStep, minorStep, redFrom, topNote, unit, scale = 1, text }) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = canvas.clientWidth || 118, ch = canvas.clientHeight || 118;
  if (canvas.width !== Math.round(cw * dpr)) { canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr); }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, cw, ch);
  const cx = cw / 2, cy = ch / 2, R = Math.min(cw, ch) / 2 - 2;
  const a0 = rad(135), a1 = rad(405), A = v => a0 + (Math.min(Math.max(v, 0), max) / max) * (a1 - a0);
  ctx.fillStyle = '#10131a'; ctx.strokeStyle = '#2a2f38'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill(); ctx.stroke();
  if (redFrom != null) { ctx.strokeStyle = COL.red; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, R - 3, A(redFrom), A(max)); ctx.stroke(); }
  ctx.lineWidth = 1; ctx.fillStyle = COL.dim; ctx.font = '9px ui-monospace, Menlo, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let v = 0; v <= max + 1e-6; v += minorStep) {
    const major = Math.abs(v / majorStep - Math.round(v / majorStep)) < 1e-6, a = A(v);
    const r1 = R - (major ? 10 : 7), r2 = R - 5;
    ctx.strokeStyle = redFrom != null && v >= redFrom ? COL.red : major ? '#9aa3af' : '#4b535f';
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); ctx.stroke();
    if (major) ctx.fillText(String(Math.round(v / scale)), cx + Math.cos(a) * (R - 18), cy + Math.sin(a) * (R - 18));
  }
  if (topNote) { ctx.fillStyle = COL.faint; ctx.font = '8px -apple-system, Arial, sans-serif'; ctx.fillText(topNote, cx, cy - R * 0.36); }
  const a = A(value);
  ctx.strokeStyle = COL.amber; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - Math.cos(a) * 5, cy - Math.sin(a) * 5); ctx.lineTo(cx + Math.cos(a) * (R - 22), cy + Math.sin(a) * (R - 22)); ctx.stroke();
  ctx.fillStyle = '#e9edf2'; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, 7); ctx.fill();
  ctx.fillStyle = COL.text; ctx.font = '600 13px ui-monospace, Menlo, monospace'; ctx.fillText(text, cx, cy + R * 0.5);
  ctx.fillStyle = COL.faint; ctx.font = '9px -apple-system, Arial, sans-serif'; ctx.fillText(unit, cx, cy + R * 0.5 + 12);
}
