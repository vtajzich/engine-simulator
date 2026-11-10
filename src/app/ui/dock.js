import { SPEC } from '../../spec.js';
import { derive, deg, mod } from '../../kin/derive.js';
import { ui, num as fmt } from '../content/index.js';
import { drawGauge, createSyncTracker } from '../diagrams.js';

const D = derive();
const U = ui.dock;
const SPEEDS = [[1, '1×'], [1 / 4, '¼'], [1 / 20, '1/20'], [1 / 100, '1/100'], [1 / 500, '1/500']];
const NS = 'http://www.w3.org/2000/svg';

const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const svg = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent?.appendChild(e); return e; };
const ICON_PAUSE = '<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="2" y="1" width="3" height="10"/><rect x="7" y="1" width="3" height="10"/></svg>';
const ICON_PLAY = '<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M2 1l9 5-9 5z"/></svg>';

export function buildDock(app, root) {
  root.replaceChildren();
  const dk = h('div', 'dk');
  root.appendChild(dk);

  /* ================================================ transport row */
  const tr = h('div', 'transport');
  const pauseBtn = h('button', 'icon-btn', ICON_PAUSE); pauseBtn.type = 'button'; pauseBtn.title = U.pause;
  pauseBtn.addEventListener('click', () => app.setPaused(!app.paused));
  tr.append(pauseBtn, h('span', 't-lbl', U.speed));
  const seg = h('div', 'seg');
  const segBtns = SPEEDS.map(([v, t]) => { const b = h('button', '', t); b.type = 'button'; b.dataset.v = v; b.addEventListener('click', () => app.setSlow(v)); seg.appendChild(b); return b; });
  tr.appendChild(seg);
  const mode = h('div', 'seg mode'); mode.title = U.modeTip;
  const modeBtns = [['rot', U.modeRot], ['time', U.modeTime]].map(([k, t]) => { const b = h('button', '', t); b.type = 'button'; b.dataset.m = k; b.addEventListener('click', () => app.setSlowMode(k)); mode.appendChild(b); return b; });
  tr.appendChild(mode);
  const real = h('span', 't-real', ''); tr.appendChild(real);
  const scrub = h('div', 'scrub');
  scrub.appendChild(h('span', 't-lbl', U.crankAngle));
  const scr = h('input'); scr.type = 'range'; scr.min = 0; scr.max = 720; scr.step = 1; scr.value = 0; scr.setAttribute('aria-label', U.crankAngle);
  const scrOut = h('span', 'num', '0°'); scrOut.style.cssText = 'width:34px;text-align:right;color:#8b93a1;font-size:11px';
  scrub.append(scr, scrOut); tr.appendChild(scrub);
  dk.appendChild(tr);
  let scrubbing = false;
  scr.addEventListener('pointerdown', () => { scrubbing = true; });
  window.addEventListener('pointerup', () => { scrubbing = false; });
  scr.addEventListener('input', () => {
    if (!app.paused) app.setPaused(true);
    const cur = mod(deg(app.sim.state.thetaCrank), 720);
    let d = Number(scr.value) - cur;
    d = ((d + 360) % 720 + 720) % 720 - 360;     // shortest signed difference on the 720° cycle
    app.rotateCrank(d * Math.PI / 180);
    scr.style.setProperty('--p', (scr.value / 7.2) + '%');
  });

  /* ================================================ main row */
  const main = h('div', 'dk-main'); dk.appendChild(main);

  // ---- gauges
  const gsec = h('div', 'dk-sec gauges');
  const tach = h('canvas'), spd = h('canvas');
  gsec.append(tach, spd); main.appendChild(gsec);

  // ---- readouts
  const rsec = h('div', 'dk-sec readouts'); main.appendChild(rsec);
  const rows = {};
  const row = (k, label) => { const r = h('div', 'rd'); r.append(h('span', '', label)); const v = h('span', 'v num', '—'); r.appendChild(v); rsec.appendChild(r); rows[k] = v; };
  row('eng', U.engineLbl);
  row('gear', `${U.gear} / ${U.ratio}`);
  row('crank', `${U.rpmCrank} (${ui.rpm})`);
  row('input', U.rpmInput);
  row('counter', U.rpmCounter);
  row('main', U.rpmMain);
  const chips = h('div', 'chipline');
  const chipClutch = h('span', 'chip', U.clutchState), chipTq = h('span', 'chip num', ''), chipSync = h('span', 'chip', U.syncPhase);
  chips.append(chipClutch, chipTq, chipSync); rsec.appendChild(chips);
  const timeBadge = h('div'); timeBadge.id = 'timebadge'; document.getElementById('stage').appendChild(timeBadge);
  const drvBadge = h('div'); drvBadge.id = 'drvbadge'; document.getElementById('stage').appendChild(drvBadge);
  rsec.title = U.negHint;

  // ---- sliders
  const csec = h('div', 'dk-sec ctrls'); main.appendChild(csec);
  const sliders = {};
  const mkSlider = (name, label, key, cls) => {
    const wrap = h('div', 'sl ' + cls);
    const l = h('label', '', label); l.title = key;
    const inp = h('input'); inp.type = 'range'; inp.min = 0; inp.max = 1; inp.step = 0.01; inp.value = 0; inp.setAttribute('aria-label', label);
    const out = h('output', 'num', '0 %');
    wrap.append(l, inp, out); csec.appendChild(wrap);
    const paint = () => inp.style.setProperty('--p', (inp.value * 100) + '%');
    inp.addEventListener('input', () => { app.input.release(name); app.user[name] = Number(inp.value); paint(); out.textContent = Math.round(inp.value * 100) + ' %'; });
    inp.addEventListener('change', () => inp.blur());
    sliders[name] = { wrap, inp, out, paint };
  };
  mkSlider('throttle', U.throttle, 'W / ↑', 'c1');
  mkSlider('clutchPedal', U.clutch, ui.clutchKey, 'c2');
  mkSlider('brake', U.brake, 'S / ↓', 'c3');
  const r2 = h('div', 'row2');
  const startBtn = h('button', 'btn start', U.stop); startBtn.type = 'button';
  let shownRunning = true;
  startBtn.addEventListener('click', () => {
    // Ignition follows what the button SHOWS (set by the last UI tick), not the live engine flag: a click on the start button
    // always switches the ignition on, even while the engine still coasts or a stall banner is up. ignitionT marks the
    // click so that the stall handler (loop.js) ignores stall events older than the click.
    const s = app.sim.state, on = !shownRunning;
    app.user.ignition = on; app.stallFlag = false; app.ignitionT = s.t;
    if (on && !app.assist && s.gear !== 'N' && s.gear != null && app.user.clutchPedal < 0.5) app.toast(ui.toasts.startInGear, 'warn', 5200);
    app.emit('inputs');
  });
  const assistLbl = h('label', 'switch'); assistLbl.title = U.assistTip;
  const assist = h('input'); assist.type = 'checkbox'; assist.checked = app.assist;
  assist.addEventListener('change', () => { app.setAssist(assist.checked); assist.blur(); });
  assistLbl.append(assist, document.createTextNode(U.assist));
  r2.append(startBtn, assistLbl); csec.appendChild(r2);

  // ---- H-pattern lever
  const lsec = h('div', 'dk-sec gearsec'); main.appendChild(lsec);
  const sv = svg('svg', { viewBox: '0 0 150 112' }); lsec.appendChild(sv);
  const COLX = { '-1': 25, 0: 75, 1: 125 }, ROWY = { 1: 26, '-1': 86, 0: 56 };
  const gate = SPEC.gearbox.shift.gate;
  svg('path', { class: 'gate-line', d: 'M25 56H125M25 26V86M75 26V86M125 26V86' }, sv);
  const gpos = {};
  for (const g of ['1', '2', '3', '4', '5', 'R', 'N']) {
    const [c, r] = gate[g];
    const grp = svg('g', { class: 'gpos', transform: `translate(${COLX[c]} ${ROWY[r]})`, tabindex: -1 }, sv);
    svg('circle', { r: 11 }, grp);
    svg('text', {}, grp).textContent = g;
    grp.addEventListener('click', () => app.requestGear(g));
    gpos[g] = grp;
  }
  const knob = svg('circle', { class: 'knob', r: 6, cx: 75, cy: 56 }, sv);

  /* ================================================ behaviour */
  const setSlider = (name, v) => { const s = sliders[name]; s.inp.value = v; s.paint(); s.out.textContent = Math.round(v * 100) + ' %'; };
  function syncInputs() {
    for (const n of ['throttle', 'clutchPedal', 'brake']) {
      if (document.activeElement === sliders[n].inp) continue;
      const v = (n === 'clutchPedal' && app.assist && app.driver.stage && app.driver.stage !== 'idle') ? app.sim.state.clutchPedal : app.user[n];
      if (Math.abs(Number(sliders[n].inp.value) - v) > 0.004) setSlider(n, v);
      sliders[n].wrap.classList.toggle('auto', n === 'clutchPedal' && app.assist && !!app.driver.stage && app.driver.stage !== 'idle');
    }
    assist.checked = app.assist;
  }
  app.on('inputs', syncInputs);
  app.on('stateReset', syncInputs);
  app.on('stall', () => {});
  app.on('timescale', () => {
    segBtns.forEach(b => b.setAttribute('aria-pressed', String(!app.paused && Math.abs(Number(b.dataset.v) - app.slow) < 1e-9)));
    modeBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.m === app.slowMode)));
    const n = Math.round(1 / app.slow), show = app.slowMode === 'time' && app.slow < 0.999;
    timeBadge.style.display = show ? 'block' : 'none';
    timeBadge.textContent = ui.timeBadge(n);
    pauseBtn.innerHTML = app.paused ? ICON_PLAY : ICON_PAUSE; pauseBtn.title = app.paused ? U.play : U.pause;
  });

  const ratios = D.gearbox.ratios;
  const trackSync = createSyncTracker();
  const stallBanner = h('div'); stallBanner.id = 'stall'; stallBanner.textContent = ui.stallBanner;
  document.getElementById('stage').appendChild(stallBanner);
  const tachCtx = { max: 8000, majorStep: 1000, minorStep: 500, redFrom: SPEC.engine.redlineRpm, topNote: '× 1000', unit: ui.rpm, scale: 1000 };
  const spdCtx = { max: 240, majorStep: 40, minorStep: 20, unit: 'km/h', scale: 1 };

  app.on('tick', ({ state: s }) => {
    const rpmE = s.rpm.engine;
    drawGauge(tach, { ...tachCtx, value: rpmE, text: fmt(rpmE) });
    drawGauge(spd, { ...spdCtx, value: Math.abs(s.speedKmh), text: fmt(Math.abs(s.speedKmh)) });

    const g = s.gear;
    const rat = ratios[g];
    rows.gear.innerHTML = `<b style="color:#ff9e2c">${g === 'N' ? U.neutral : g}</b> · ${rat != null ? fmt(rat, 3) : '—'}`;
    const setR = (el, v, d = 0) => { el.textContent = fmt(v, d); el.classList.toggle('neg', v < -0.5); };
    setR(rows.crank, s.rpm.engine); setR(rows.input, s.rpm.input); setR(rows.counter, s.rpm.counter); setR(rows.main, s.rpm.main, Math.abs(s.rpm.main) < 10 ? 1 : 0);

    const c = s.clutch;
    const state = c.locked ? 'on' : c.capacityNm > 1 ? 'slip' : 'open';
    chipClutch.className = 'chip ' + state;
    chipClutch.textContent = U.clutchState + ': ' + (state === 'on' ? U.engaged : state === 'slip' ? U.slipping : U.released);
    chipTq.textContent = `${fmt(c.torqueNm)} N·m`;
    const sy = trackSync(s), act = sy.act;
    chipSync.className = 'chip' + (act ? (sy.phase === 'blocking' ? ' bad' : ' on') : '');
    chipSync.textContent = U.syncShort + ': ' + sy.text;

    const stg = app.driver.stage;
    const busy = app.assist && !!stg && stg !== 'idle' && !!ui.driverStages[stg];   // unknown stage names hide the badge
    drvBadge.style.display = busy ? 'block' : 'none';
    if (busy) drvBadge.textContent = U.driver + ': ' + ui.driverStages[stg];

    const shown = rpmE * app.slow;
    real.innerHTML = `${U.realRpm}: <b>${fmt(rpmE)}</b> ${ui.rpm}` + (app.slow < 0.999 ? ` · ${U.shownRpm}: ${fmt(shown, shown < 10 ? 1 : 0)}` : '');

    // crank scrubber
    if (!scrubbing) { const a = mod(deg(s.thetaCrank), 720); scr.value = a; scr.style.setProperty('--p', (a / 7.2) + '%'); scrOut.textContent = Math.round(a) + '°'; }

    // ignition / start button
    const running = s.engine.running;
    const eng = running ? 'run' : app.user.ignition ? 'starting' : rpmE > 5 ? 'coast' : 'off';
    shownRunning = running;
    startBtn.textContent = running ? U.stop : U.start;
    rows.eng.textContent = U.engine[eng]; rows.eng.dataset.s = eng;
    startBtn.classList.toggle('alert', !running && !app.user.ignition);
    stallBanner.style.display = !running && !app.user.ignition ? 'block' : 'none';
    stallBanner.textContent = app.stallFlag ? ui.stallBanner : ui.engineOff;

    // lever
    const l = s.lever;
    knob.setAttribute('cx', 75 + l.col * 50); knob.setAttribute('cy', 56 - l.row * 30);
    const tgt = app.assist ? l.target : app.user.lever;
    for (const k in gpos) { gpos[k].classList.toggle('cur', k === g); gpos[k].classList.toggle('target', k === tgt && k !== g); }
    syncInputs();
  });

  app.emit('timescale');
}
