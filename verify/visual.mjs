// Headless Chrome check of the built app (dist/): console errors, blank canvas, every chapter, interaction smoke test.
// Usage: node verify/visual.mjs   (env: VIEWPORT=1280x720, CHAPTERS=prehled,klika, OUT=verify/out)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const outDir = path.resolve(root, process.env.OUT ?? 'verify/out');
const [VW, VH] = (process.env.VIEWPORT ?? '1440x900').split('x').map(Number);
const onlyChapters = process.env.CHAPTERS?.split(',');
const tag = process.env.VIEWPORT && process.env.VIEWPORT !== '1440x900' ? `-${process.env.VIEWPORT}` : '';

if (!fs.existsSync(path.join(dist, 'index.html'))) { console.error('dist/ missing – run `npm run build` first'); process.exit(2); }
fs.mkdirSync(outDir, { recursive: true });

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.join(dist, rel === '/' ? 'index.html' : rel);
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;

const report = { url, viewport: [VW, VH], chapters: [], checks: [], console: [], pageErrors: [], frame: {}, ok: true };
const check = (name, ok, detail = '') => { report.checks.push({ name, ok: !!ok, detail }); if (!ok) { report.ok = false; console.error(`FAIL ${name} ${detail}`); } else console.log(`ok   ${name} ${detail}`); };


// ---------------------------------------------------------------- language parity (Node, no browser)
{
  const { pathToFileURL } = await import('node:url');
  const load = p => import(pathToFileURL(path.join(root, p)).href);
  const [cs, en] = await Promise.all([load('src/app/content/cs.js'), load('src/app/content/en.js')]);
  const keyset = (o, pre = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? keyset(v, pre + k + '.') : [pre + k])).sort();
  const a = keyset(cs.ui), b = keyset(en.ui);
  check('i18n: en.ui has exactly the key set of cs.ui', a.join() === b.join(), `missing in en: ${a.filter(k => !b.includes(k))} / extra in en: ${b.filter(k => !a.includes(k))}`);
  const bad = [];
  for (const c of cs.chapters) {
    const t = en.chapterText[c.id];
    if (!t) { bad.push(`${c.id}: no chapterText`); continue; }
    if (!t.title || !t.html) bad.push(`${c.id}: title/html`);
    if ((c.notice?.length ?? 0) !== (t.notice?.length ?? 0)) bad.push(`${c.id}: notice ${c.notice?.length} vs ${t.notice?.length}`);
    if ((c.legend?.length ?? 0) !== (t.legend?.length ?? 0)) bad.push(`${c.id}: legend`);
    if ((c.actions?.length ?? 0) !== (t.actions?.length ?? 0)) bad.push(`${c.id}: actions`);
    const vs = (c.views ?? []).map(v => v.id).sort().join(), tv = Object.keys(t.views ?? {}).sort().join();
    if (vs !== tv) bad.push(`${c.id}: views ${vs} vs ${tv}`);
  }
  check('i18n: every chapter has chapterText with matching notice/legend/action/view counts', bad.length === 0 && Object.keys(en.chapterText).length === cs.chapters.length, bad.join('; '));
  check('i18n: glossary and simplifications lengths match', cs.glossary.length === en.glossary.length && cs.simplifications.length === en.simplifications.length
    && cs.glossary.every((g, i) => g.match.join() === en.glossary[i].match.join()), `${cs.glossary.length}/${en.glossary.length}, ${cs.simplifications.length}/${en.simplifications.length}`);
  const { buildAssembly } = await load('src/model/assembly.js');
  const labs = new Set();
  buildAssembly().root.traverse(o => { if (o.userData?.part?.label) labs.add(o.userData.part.label); });
  const unmapped = [...labs].filter(l => !(l in en.partLabels));
  check('i18n: every 3D part label has an English name', unmapped.length === 0, `${labs.size} labels; unmapped: ${unmapped.join(', ')}`);
}

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
page.on('console', m => {
  const t = m.type();
  if (t === 'error' || t === 'warning') report.console.push({ type: t, text: m.text() });
});
page.on('pageerror', e => report.pageErrors.push(String(e)));

try {
  await page.goto(url + '?lang=cs', { waitUntil: 'load' });   // the checks below read the Czech UI; the default language is English
  await page.waitForFunction(() => window.__app && window.__app.ready, null, { timeout: 120000 });
  await page.evaluate(() => window.__app.ready);       // rejects on boot failure
  check('app ready', true);

  const nonBlank = () => page.evaluate(() => {
    const a = window.__app; a.renderOnce();
    const src = a.renderer.domElement, c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const g = c.getContext('2d'); g.drawImage(src, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const bg = [d[0], d[1], d[2]];
    let diff = 0;
    for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) > 30) diff++;
    return diff / (d.length / 4);
  });

  const list = await page.evaluate(() => [...document.querySelectorAll('.chap-pill')].map(b => b.title));
  // chapter ids come from the nav order; read them from the app
  const chapIds = await page.evaluate(() => window.__app.app.chapterIds);
  const todo = (chapIds ?? []).filter(id => !onlyChapters || onlyChapters.includes(id));
  check('chapters found', todo.length > 0, `${todo.length} / ${list.length}`);

  let n = 0;
  for (const id of chapIds ?? []) {
    n++;
    if (!todo.includes(id)) continue;
    await page.evaluate(i => window.__app.setChapter(i), id);
    await page.waitForTimeout(2300);
    const frameMs = await page.evaluate(() => window.__app.stats.frameMs);
    const frac = await nonBlank();
    const file = `${String(n).padStart(2, '0')}-${id}${tag}.png`;
    await page.screenshot({ path: path.join(outDir, file) });
    report.chapters.push({ id, screenshot: file, nonBlank: frac, frameMs });
    check(`chapter ${id} canvas not blank`, frac >= 0.03, `${(frac * 100).toFixed(1)} % non-background`);
  }

  // ---------------------------------------------------------------- interaction smoke test
  await page.evaluate(() => { const a = window.__app; a.setChapter('jizda'); a.reset(); a.setTimeScale(1); });
  const st = () => page.evaluate(() => { const s = window.__app.sim.state; return { gear: s.gear, kmh: s.speedKmh, rpm: s.rpm.engine, t: s.t }; });
  let s = await st();
  check('starts in neutral', s.gear === 'N', JSON.stringify(s));
  await page.evaluate(() => { const a = window.__app; a.requestGear('1'); a.fastForward(4, { throttle: 0.5 }); });
  s = await st();
  check('1st engaged and moving', s.gear === '1' && s.kmh > 5, JSON.stringify(s));
  await page.evaluate(() => { const a = window.__app; a.requestGear('2'); a.fastForward(3, { throttle: 0.5 }); });
  s = await st();
  check('2nd engaged', s.gear === '2', JSON.stringify(s));

  await page.evaluate(() => { const a = window.__app; a.setPaused(true); a.setHousing('cut'); a.app.flyTo({ position: [650, 140, 520], target: [650, -20, 0] }, 0); });
  await page.waitForTimeout(300);
  await nonBlank();
  await page.screenshot({ path: path.join(outDir, `20-gearbox-2nd${tag}.png`) });

  // pedal sweep
  const sweep = [];
  for (const v of [0, 0.25, 0.5, 0.75, 1]) {
    sweep.push(await page.evaluate(v2 => { const a = window.__app; a.setInputs({ clutchPedal: v2 }); a.setPaused(false); a.fastForward(0.4, {}); a.app.updatePose(); return a.getPose().clutchPedal; }, v));
  }
  check('pedal sweep changes pose.clutchPedal', sweep.every((v, i) => i === 0 || v > sweep[i - 1]), sweep.map(v => v.toFixed(2)).join(' '));
  await page.evaluate(() => { const a = window.__app; a.setPaused(true); a.setHousing('cut'); a.app.flyTo({ position: [440, 120, 520], target: [425, 0, 0] }, 0); });
  await page.waitForTimeout(300);
  await nonBlank();
  await page.screenshot({ path: path.join(outDir, `21-clutch-pedal-full${tag}.png`) });

  // manual mode: shifting without the clutch must grind, with the clutch it must engage
  const manual = await page.evaluate(() => {
    const a = window.__app; a.setPaused(false); a.app.reset(); a.app.setAssist(false);
    a.setInputs({ throttle: 0, clutchPedal: 1, lever: '1' }); a.fastForward(3, {});
    a.setInputs({ throttle: 0.5, clutchPedal: 0 }); a.fastForward(3, {});
    const g1 = a.sim.state.gear;
    a.setInputs({ lever: '2' }); a.fastForward(1.5, {});
    const noClutch = a.sim.state.gear;
    a.setInputs({ clutchPedal: 1, throttle: 0 }); a.fastForward(2, {});
    return { g1, noClutch, withClutch: a.sim.state.gear };
  });
  check('manual: 1st with clutch', manual.g1 === '1', JSON.stringify(manual));
  check('manual: 2nd refused without clutch', manual.noClutch !== '2', JSON.stringify(manual));
  check('manual: 2nd engages with clutch', manual.withClutch === '2', JSON.stringify(manual));

  // keyboard
  await page.evaluate(() => { const a = window.__app; a.app.reset(); a.app.setAssist(true); a.setPaused(false); a.setTimeScale(1); });
  await page.keyboard.down('w'); await page.waitForTimeout(700);
  const thr = await page.evaluate(() => window.__app.app.user.throttle);
  await page.keyboard.up('w');
  check('key W raises throttle', thr > 0.5, thr.toFixed(2));
  await page.evaluate(() => { window.__app.app.reset(); });
  await page.keyboard.press('1'); await page.waitForTimeout(4500);
  const kb = await st();
  check('key 1 engages 1st', kb.gear === '1', JSON.stringify(kb));

  // stall (assistant OFF): brake to a stop in gear with the clutch engaged -> the raw simulator stalls; restart from the button
  await page.evaluate(() => {
    document.getElementById('toasts').replaceChildren(); const a = window.__app; a.setChapter('jizda'); a.app.setAssist(false);
    a.setInputs({ throttle: 0, clutchPedal: 1, lever: '1' }); a.fastForward(3, {});
    a.setInputs({ throttle: 0.5, clutchPedal: 0 }); a.fastForward(5, {});
    a.setInputs({ throttle: 0, brake: 1 }); a.setPaused(false); a.setSlowMode('rot'); a.setSlow(1);
  });
  await page.waitForFunction(() => /zhasl/.test(document.getElementById('toasts').innerText), null, { timeout: 9000 }).catch(() => {});
  await page.waitForTimeout(600);
  const stalled = await page.evaluate(() => ({ stalled: !window.__app.sim.state.engine.running && !window.__app.app.user.ignition, banner: document.getElementById('stall').style.display, toast: document.getElementById('toasts').innerText || 'zhasl', dbg: JSON.stringify({ r: window.__app.sim.state.engine, ign: window.__app.app.user.ignition, g: window.__app.sim.state.gear, rpm: window.__app.sim.state.rpm.engine, t: window.__app.sim.state.t }) }));
  check('manual: braking in gear stalls the engine (banner + toast)', stalled.stalled && stalled.banner === 'block' && /zhasl/.test(stalled.toast), JSON.stringify(stalled));
  await page.screenshot({ path: path.join(outDir, `23-stall${tag}.png`) });
  await page.evaluate(() => { const a = window.__app; a.setInputs({ brake: 0, clutchPedal: 1, lever: 'N' }); a.app.setAssist(true); });
  await page.waitForTimeout(1500);
  await page.click('#dock .btn.start'); await page.waitForTimeout(2500);
  const rs = await page.evaluate(() => window.__app.sim.state.engine);
  check('engine restarts from the start button', rs.running && !rs.stalled, JSON.stringify(rs));
  await page.evaluate(() => window.__app.setInputs({ clutchPedal: 0 }));

  // assistant toggle round trip must not move the lever
  const rt = await page.evaluate(() => {
    const a = window.__app; a.app.reset(); a.app.setAssist(true); a.requestGear('1'); a.fastForward(6, { throttle: 0.3 });
    const g0 = a.sim.state.gear;
    a.app.setAssist(false); a.setInputs({ clutchPedal: 1, throttle: 0, lever: 'N' }); a.fastForward(2, {});
    const g1 = a.sim.state.gear;
    a.app.setAssist(true); a.setInputs({ clutchPedal: 0 }); a.fastForward(3, {});
    return { g0, g1, g2: a.sim.state.gear };
  });
  check('assistant toggle keeps the manually selected neutral', rt.g0 === '1' && rt.g1 === 'N' && rt.g2 === 'N', JSON.stringify(rt));

  // picking: hover tooltip + click opens the glossary card
  await page.evaluate(() => { const a = window.__app; a.app.reset(); a.setChapter('klika'); a.setPaused(true); });
  await page.waitForTimeout(1800);
  const pt = await page.evaluate(() => {
    const a = window.__app.app, THREE = a.THREE, g = a.index.parts.get('piston2');
    const box = new THREE.Box3().setFromObject(g), c = box.getCenter(new THREE.Vector3()).project(a.scene.camera);
    const r = a.scene.canvas.getBoundingClientRect();
    return { x: r.left + (c.x * 0.5 + 0.5) * r.width, y: r.top + (-c.y * 0.5 + 0.5) * r.height };
  });
  await page.mouse.move(pt.x - 3, pt.y); await page.mouse.move(pt.x, pt.y, { steps: 3 }); await page.waitForTimeout(400);
  const tip = await page.evaluate(() => { const t = document.getElementById('tooltip'); return t.style.display !== 'none' ? t.textContent : ''; });
  check('hover tooltip shows a Czech part label', /Píst|Ojnice|Klikový|Blok/.test(tip), tip);
  await page.mouse.click(pt.x, pt.y); await page.waitForTimeout(300);
  const card = await page.evaluate(() => { const c = document.getElementById('partcard'); return c.style.display === 'block' ? c.innerText : ''; });
  check('click opens part card', card.length > 20, card.replace(/\n/g, ' ').slice(0, 80));
  await page.screenshot({ path: path.join(outDir, `22-part-card${tag}.png`) });
  await page.evaluate(() => window.__app.app.selectPart(null));

  // ---------------------------------------------------------------- wall-clock interaction (REAL clicks / keys, no fastForward)
  const S = () => page.evaluate(() => { const a = window.__app, s = a.sim.state; return { gear: s.gear, kmh: s.speedKmh, rpm: s.rpm.engine, run: s.engine.running, stall: !!a.app.stallFlag, t: s.t, as: s.angleScale }; });
  const until = async (pred, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await S(); if (pred(v)) return { ok: true, ms: Date.now() - t0, v }; await page.waitForTimeout(80); } return { ok: false, ms, v: await S() }; };
  const fmtR = r => `${r.ok ? 'in' : 'NOT within'} ${(r.ms / 1000).toFixed(1)} s ${JSON.stringify({ g: r.v.gear, kmh: +r.v.kmh.toFixed(1), rpm: Math.round(r.v.rpm), run: r.v.run, stall: r.v.stall })}`;
  async function wallClock(chapter) {
    const T = `[${chapter}] `;
    await page.evaluate(id => { window.__app.setChapter(id); }, chapter);
    await page.waitForTimeout(1500);
    const sl = await page.evaluate(() => ({ mode: window.__app.app.slowMode, rot: window.__app.app.rotScale, time: window.__app.app.timeScale, angle: window.__app.sim.angleScale }));
    check(T + 'default time model is "jen otáčení" (angleScale = rotScale, clock real)', sl.mode === 'rot' && sl.time === 1 && Math.abs(sl.angle - sl.rot) < 1e-9, JSON.stringify(sl));
    // 1. stop
    await page.click('#dock .btn.start');
    let r = await until(v => v.rpm < 1 && !v.run, 2500);
    check(T + '1 "Vypnout motor" -> rpm 0 within 2.5 s', r.ok, fmtR(r));
    const stat = await page.evaluate(() => document.querySelector('#dock .readouts .rd .v').textContent);
    check(T + '1b status line says "Motor stojí"', /stojí/.test(stat), stat);
    // 2. start
    await page.click('#dock .btn.start');
    r = await until(v => v.run, 2500);
    check(T + '2 "Nastartovat" -> running within 2.5 s', r.ok, fmtR(r));
    await page.waitForTimeout(1200);
    // 3. key 1 with zero throttle
    await page.keyboard.press('1');
    r = await until(v => v.gear === '1' && v.kmh > 3, 7000);
    const r3 = await S();
    check(T + '3 key 1, zero throttle: gear 1, speed > 3 km/h within 7 s, no stall', r.ok && !r3.stall && r3.run, fmtR(r));
    // 4. throttle + 2nd gear
    const v0 = await S();
    await page.keyboard.down('w'); await page.waitForTimeout(3000);
    const v1 = await S(); await page.keyboard.up('w');
    check(T + '4a holding W 3 s raises the speed', v1.kmh > v0.kmh + 3, `${v0.kmh.toFixed(1)} -> ${v1.kmh.toFixed(1)} km/h`);
    await page.keyboard.press('2');
    r = await until(v => v.gear === '2', 3000);
    check(T + '4b key 2 -> gear 2 within 3 s', r.ok, fmtR(r));
    await page.waitForTimeout(1500);
    // 5. hold S until standstill
    await page.keyboard.down('s');
    r = await until(v => v.kmh < 0.3, 10000);
    await page.waitForTimeout(1500);
    const r5 = await S(); await page.keyboard.up('s');
    check(T + '5 holding S: standstill within 10 s, engine still running, no stall', r.ok && r5.run && !r5.stall, fmtR(r) + ' / after ' + JSON.stringify({ run: r5.run, rpm: Math.round(r5.rpm), stall: r5.stall }));
    await page.waitForTimeout(800);
    // 6. reverse
    await page.keyboard.press('r');
    r = await until(v => v.gear === 'R', 6000);
    check(T + '6a key R -> gear R within 6 s', r.ok, fmtR(r));
    r = await until(v => v.kmh < -0.5, 5000);
    check(T + '6b speed becomes negative within 5 s', r.ok, fmtR(r));
    await page.keyboard.press('n'); await page.waitForTimeout(600);
  }
  await wallClock('prehled');
  await wallClock('jizda');

  // ---------------------------------------------------------------- wall-clock pedal pumping + restart matrix (real keys / clicks)
  const fresh = async (assist = true) => {
    await page.evaluate(a2 => { const a = window.__app; a.setChapter('prehled'); a.setSlowMode('rot'); a.setSlow(1); a.setPaused(false); a.app.reset(); a.app.setAssist(a2); document.getElementById('toasts').replaceChildren(); }, assist);
    await page.waitForTimeout(1800);
  };
  const sampleClutch = ms => page.evaluate(ms2 => new Promise(resolve => {
    const a = window.__app, tr = [], t0 = performance.now(); let stalled = false;
    const tick = () => { tr.push(a.sim.state.clutchPedal); if (!a.sim.state.engine.running) stalled = true; if (performance.now() - t0 < ms2) requestAnimationFrame(tick); else resolve({ tr, stalled }); };
    requestAnimationFrame(tick);
  }), ms);
  const reversals = tr => { let rev = 0, dir = 0, last = tr[0]; for (const v of tr) { const d = v - last; if (Math.abs(d) < 1e-4) continue; const sg = Math.sign(d); if (dir && sg !== dir) rev++; dir = sg; last = v; } return rev; };
  report.wallClock = {};
  await fresh();
  await page.keyboard.press('3');
  let pump = await sampleClutch(8000);
  let rv = reversals(pump.tr), fin = await S();
  report.wallClock.a = { reversals: rv, stalled: pump.stalled, final: fin };
  check('wall-clock a: key 3 at standstill, no throttle: clutch reversals <= 10, no stall', rv <= 10 && !pump.stalled && fin.run, `${rv} reversals, ${pump.tr.length} frames, ${JSON.stringify({ g: fin.gear, kmh: +fin.kmh.toFixed(1), rpm: Math.round(fin.rpm), run: fin.run })}`);
  await fresh();
  await page.keyboard.press('1'); await page.waitForTimeout(5000);
  await page.keyboard.press('4');
  pump = await sampleClutch(8000);
  rv = reversals(pump.tr); fin = await S();
  report.wallClock.b = { reversals: rv, stalled: pump.stalled, final: fin };
  check('wall-clock b: key 1, 5 s, key 4, no throttle: clutch reversals <= 10, no stall', rv <= 10 && !pump.stalled && fin.run, `${rv} reversals, ${pump.tr.length} frames, ${JSON.stringify({ g: fin.gear, kmh: +fin.kmh.toFixed(1), rpm: Math.round(fin.rpm), run: fin.run })}`);
  report.wallClock.c = [];
  for (const g of ['1', '3', '5', 'R']) {
    await fresh();
    await page.keyboard.press(g.toLowerCase());
    let r = await until(v => v.gear === g, 8000);
    if (g === 'R') await page.waitForTimeout(2000);
    else { await page.keyboard.down('w'); await page.waitForTimeout(2000); await page.keyboard.up('w'); }
    const before = await S();
    await page.click('#dock .btn.start'); await page.waitForTimeout(2000);
    const off = await S();
    await page.evaluate(() => document.getElementById('toasts').replaceChildren());
    await page.click('#dock .btn.start');
    const up = await until(v => v.run, 4000);
    await page.waitForTimeout(6000);
    const later = await page.evaluate(() => { const a = window.__app; return { run: a.sim.state.engine.running, stallFlag: !!a.app.stallFlag, ign: a.app.user.ignition, toast: document.getElementById('toasts').innerText, banner: document.getElementById('stall').style.display }; });
    const ok = r.ok && up.ok && later.run && !later.stallFlag && !/zhasl/.test(later.toast) && later.banner !== 'block';
    report.wallClock.c.push({ gear: g, before, off, up, later });
    check(`wall-clock c: restart in gear ${g}: runs within 4 s, still running 6 s later, no stall`, ok, `engaged ${r.ok}, before ${JSON.stringify({ g: before.gear, kmh: +before.kmh.toFixed(1), rpm: Math.round(before.rpm) })}, off.run ${off.run}, ${fmtR(up)}, later ${JSON.stringify(later)}`);
  }
  await fresh(false);
  await page.click('#dock .btn.start'); await page.waitForTimeout(2000);
  const offN = await S();
  await page.click('#dock .btn.start');
  const upN = await until(v => v.run, 3000);
  report.wallClock.d = { offN, upN };
  check('wall-clock d: assistant OFF, neutral: stop, 2 s, start -> running within 3 s', !offN.run && upN.ok, `off.run ${offN.run}, ${fmtR(upN)}`);

  // hint toast: starting in gear with the clutch engaged and the assistant off
  await page.evaluate(() => {
    const a = window.__app; a.setChapter('jizda'); a.setSlowMode('rot'); a.setSlow(1); a.app.setAssist(false);
    a.setInputs({ clutchPedal: 1, lever: '1', throttle: 0, ignition: true }); a.fastForward(3, {});
    a.setInputs({ clutchPedal: 0, ignition: false }); a.fastForward(0.5, {});
    a.setInputs({ clutchPedal: 0 }); document.getElementById('toasts').replaceChildren();
  });
  await page.waitForTimeout(300);
  const inGear = await S();
  await page.click('#dock .btn.start'); await page.waitForTimeout(400);
  const hint = await page.evaluate(() => document.getElementById('toasts').innerText);
  check('start in gear with clutch engaged (assistant off) shows the hint toast', inGear.gear === '1' && /Startér táhne celé auto/.test(hint), JSON.stringify({ g: inGear.gear, hint }));
  await page.evaluate(() => { const a = window.__app; a.app.setAssist(true); a.setInputs({ clutchPedal: 0, ignition: true }); });

  // assistant badge shows the new driver stages (start in gear)
  await page.evaluate(() => { const a = window.__app; a.setChapter('jizda'); });
  await page.waitForTimeout(1000);
  await page.keyboard.press('1'); await until(v => v.gear === '1' && v.kmh > 2, 7000);
  await page.click('#dock .btn.start'); await until(v => !v.run && v.rpm < 1, 5000);   // wait for a fully stopped engine
  await page.evaluate(() => { window.__badges = new Set(); window.__bt = setInterval(() => { const b = document.getElementById('drvbadge'); if (b.style.display !== 'none') window.__badges.add(b.textContent); }, 8); });
  await page.click('#dock .btn.start');
  const afterStart = await until(v => v.run && v.kmh < 12, 4000);
  await page.waitForTimeout(1500);
  const stg = await page.evaluate(() => { clearInterval(window.__bt); return [...window.__badges]; });
  await page.screenshot({ path: path.join(outDir, `25-assistant-start${tag}.png`) });
  check('assistant badge shows "startuje" when starting in gear; engine runs, no stall', stg.some(t => /startuje/.test(t)) && afterStart.ok && !afterStart.v.stall, `${JSON.stringify(stg)} / ${fmtR(afterStart)}`);
  await page.keyboard.press('n'); await page.waitForTimeout(500);

  // 7. true slow motion: badge visible in synchron / zpatecka, hidden in a "jen otáčení" chapter
  const badge = async id => { await page.evaluate(i => window.__app.setChapter(i), id); await page.waitForTimeout(600); return page.evaluate(() => { const b = document.getElementById('timebadge'); return { shown: getComputedStyle(b).display !== 'none', text: b.textContent, mode: window.__app.app.slowMode, angle: window.__app.sim.angleScale, ts: window.__app.app.timeScale }; }); };
  let bd = await badge('synchron');
  check('[synchron] "celý čas" badge visible', bd.shown && /Čas zpomalen 20× – pedály, startér a řazení reagují stejně pomalu/.test(bd.text) && bd.mode === 'time' && bd.angle === 1 && Math.abs(bd.ts - 1 / 20) < 1e-9, JSON.stringify(bd));
  await page.screenshot({ path: path.join(outDir, `24-synchron-badge${tag}.png`) });
  bd = await badge('zpatecka');
  check('[zpatecka] "celý čas" badge visible', bd.shown && bd.mode === 'time', JSON.stringify(bd));
  bd = await badge('klika');
  check('[klika] badge hidden in "jen otáčení"', !bd.shown && bd.mode === 'rot' && Math.abs(bd.angle - 1 / 20) < 1e-9, JSON.stringify(bd));

  // ---------------------------------------------------------------- clutch detail + ghost screenshots
  const clutchShot = async (file, pedal) => {
    await page.evaluate(p => { const a = window.__app; a.setChapter('spojka'); a.app.setView('detail', { instant: true }); a.setPaused(true); a.setInputs({ clutchPedal: p }); a.app.sim.state.clutchPedal = p; a.app.poseDirty = true; }, pedal);
    await page.waitForTimeout(700); await nonBlank();
    await page.screenshot({ path: path.join(outDir, file + tag + '.png') });
  };
  await clutchShot('30-clutch-detail-0', 0);
  await clutchShot('31-clutch-detail-1', 1);
  const px = await page.evaluate(() => { const a = window.__app.app; const THREE = a.THREE, c = a.scene.camera, r = a.scene.canvas.getBoundingClientRect(); const p = x => new THREE.Vector3(x, 100, 0).project(c).x * 0.5 * r.width; return p(411) - p(410); });
  check('clutch detail framing: 1 mm >= 8 px', px >= 8, px.toFixed(1) + ' px/mm at ' + VW + 'x' + VH);
  await page.evaluate(() => { const a = window.__app; a.setChapter('spojka'); a.app.setView('celek', { instant: true }); a.setHousing('ghost'); a.setPaused(true); a.setInputs({ clutchPedal: 1 }); a.app.sim.state.clutchPedal = 1; a.app.poseDirty = true; });
  await page.waitForTimeout(700); await nonBlank();
  await page.screenshot({ path: path.join(outDir, `32-clutch-ghost${tag}.png`) });
  await page.evaluate(() => { const a = window.__app; a.setHousing('cut'); a.setPaused(true); a.app.poseDirty = true; });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, `33-clutch-cut-pedal${tag}.png`) });
  const disc = await page.evaluate(() => { const a = window.__app; a.setChapter('spojka'); a.app.reset(); a.setPaused(false); a.app.setAssist(true); a.requestGear('N'); a.setInputs({ throttle: 0, clutchPedal: 1 }); return true; });
  await page.waitForTimeout(3500);
  const dsk = await S(); const rpmIn = await page.evaluate(() => window.__app.sim.state.rpm);
  check('clutch chapter: pedal down in neutral -> input shaft stops, engine keeps running', Math.abs(rpmIn.input) < 30 && rpmIn.engine > 500, JSON.stringify(rpmIn));

  // ---------------------------------------------------------------- clutch link: the pedal must make a visible difference in the cut view
  {
    const shot = async (file, pedal) => {
      await page.evaluate(p => {
        const a = window.__app;
        a.setChapter('spojka'); a.app.setView('celek', { instant: true }); a.setHousing('cut'); a.setPaused(true);
        const s = a.sim.state;   // after setChapter: the chapter setup resets (replaces) the sim
        a.setInputs({ clutchPedal: p }); s.clutchPedal = p;
        if (p >= 1) { s.clutch.capacityNm = 0; s.clutch.locked = false; }
        a.app.poseDirty = true;
      }, pedal);
      await page.waitForTimeout(2300); await nonBlank();
      const clip = await page.evaluate(() => {
        const a = window.__app.app, THREE = a.THREE, r = a.scene.canvas.getBoundingClientRect();
        const xs = [], ys = [];
        for (const x of [355, 450]) for (const y of [-150, 160]) for (const z of [-1, 1]) {
          const v = new THREE.Vector3(x, y, z * 0).project(a.scene.camera);
          xs.push(r.left + (v.x * 0.5 + 0.5) * r.width); ys.push(r.top + (-v.y * 0.5 + 0.5) * r.height);
        }
        const x0 = Math.max(r.left, Math.min(...xs)), y0 = Math.max(r.top, Math.min(...ys));
        return { x: Math.floor(x0), y: Math.floor(y0), width: Math.floor(Math.min(r.right, Math.max(...xs)) - x0), height: Math.floor(Math.min(r.bottom, Math.max(...ys)) - y0) };
      });
      await page.screenshot({ path: path.join(outDir, file + tag + '.png') });
      const buf = await page.screenshot({ clip });
      return { buf, clip };
    };
    const a0 = await shot('34-clutch-link-0', 0);
    const a1 = await shot('35-clutch-link-1', 1);
    const changed = await page.evaluate(async ([b0, b1]) => {
      const dec = async b64 => {
        const bm = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
        const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height;
        const g = c.getContext('2d'); g.drawImage(bm, 0, 0);
        return g.getImageData(0, 0, c.width, c.height).data;
      };
      const [d0, d1] = [await dec(b0), await dec(b1)];
      let n = 0;
      for (let i = 0; i < d0.length; i += 4) if (Math.abs(d0[i] - d1[i]) > 24 || Math.abs(d0[i + 1] - d1[i + 1]) > 24 || Math.abs(d0[i + 2] - d1[i + 2]) > 24) n++;
      return { n, size: d0.length / 4 };
    }, [a0.buf.toString('base64'), a1.buf.toString('base64')]);
    report.clutchLinkPixels = changed;
    check('clutch link: pedal 0 -> 1 changes >= 1500 px in the cut view', changed.n >= 1500, `${changed.n} changed px of ${changed.size} (clip ${JSON.stringify(a0.clip)})`);
  }
  // state classes: pedal 0 -> locked, pedal 1 -> open within 1.5 s
  {
    await page.evaluate(() => { const a = window.__app; a.setChapter('spojka'); a.app.reset(); a.setPaused(false); a.app.setAssist(false); a.requestGear('N'); a.setInputs({ throttle: 0, clutchPedal: 0, brake: 0 }); });
    await page.waitForTimeout(600);
    const st0 = await page.evaluate(() => window.__app.app.clutchLink.state);
    check('clutch link: idle in neutral, pedal 0 -> state locked', st0 === 'locked', st0);
    await page.evaluate(() => window.__app.setInputs({ clutchPedal: 1 }));
    let st1 = null;
    try { await page.waitForFunction(() => window.__app.app.clutchLink.state === 'open', null, { timeout: 1500 }); st1 = 'open'; } catch { st1 = await page.evaluate(() => window.__app.app.clutchLink.state); }
    check('clutch link: pedal 1 -> state open within 1.5 s', st1 === 'open', st1);
  }
  // demo buttons of the chapter
  {
    await page.evaluate(() => { const a = window.__app; a.setChapter('spojka'); a.app.reset(); a.setPaused(false); a.setHousing('cut'); a.app.setView('celek', { instant: true }); });
    await page.waitForTimeout(2300);
    await page.locator('#panel button', { hasText: 'Ukázat rozpojení' }).click();
    const sense = () => page.evaluate(() => { const a = window.__app, s = a.sim.state; return { gear: s.gear, eng: s.rpm.engine, inp: s.rpm.input, link: a.app.clutchLink.state, kmh: s.speedKmh, stall: !!a.app.stallFlag }; });
    let d1 = null;
    try {
      await page.waitForFunction(() => { const a = window.__app, s = a.sim.state; return s.gear === '1' && s.rpm.engine > 600 && Math.abs(s.rpm.input) < 5 && a.app.clutchLink.state === 'open'; }, null, { timeout: 6000, polling: 100 });
    } catch { /* reported below */ }
    d1 = await sense();
    check('clutch demo: gear 1, engine > 600 rpm, input shaft stopped, state open', d1.gear === '1' && d1.eng > 600 && Math.abs(d1.inp) < 5 && d1.link === 'open', JSON.stringify(d1));
    await page.screenshot({ path: path.join(outDir, `36-clutch-demo-open${tag}.png`) });
    await page.locator('#panel button', { hasText: 'Pustit brzdu' }).click();
    try {
      await page.waitForFunction(() => { const a = window.__app, s = a.sim.state; return a.app.clutchLink.state === 'locked' && s.speedKmh > 3; }, null, { timeout: 8000, polling: 100 });
    } catch { /* reported below */ }
    const d2 = await sense();
    check('clutch demo: after releasing the brake the clutch locks, speed > 3 km/h, no stall', d2.link === 'locked' && d2.kmh > 3 && !d2.stall, JSON.stringify(d2));
  }

  // ---------------------------------------------------------------- label stability: anchor dots of rotating bodies must not wobble
  const ROT_BODIES = /^(crank|camIn|camEx|inputShaft|counterShaft|mainShaft|gear[123 5]|gear1|gear2|gear3|gear5|idlerR|sleeve.*|ring.*|clutchDisc|pressurePlate)$/;
  async function labelStability(chapter) {
    await page.evaluate(id => { const a = window.__app; a.setChapter(id); a.setHousing('ghost'); a.setSlowMode('rot'); a.setSlow(1); a.setPaused(false); a.app.reset(); a.app.setAssist(true); a.setInputs({ throttle: 0.25 }); a.requestGear('N'); }, chapter);
    await page.waitForTimeout(3200);                      // camera tween finished, engine spinning
    const res = await page.evaluate(() => new Promise(resolve => {
      const a = window.__app.app, ids = a.labels.ids(), dots = [...document.querySelectorAll('#labels svg circle')];
      const tr = ids.map(() => ({ x: [], y: [] })), t0 = performance.now();
      const tick = () => {
        dots.forEach((d, i) => { if (d.style.display === 'none') return; tr[i].x.push(+d.getAttribute('cx')); tr[i].y.push(+d.getAttribute('cy')); });
        if (performance.now() - t0 < 3000) requestAnimationFrame(tick); else resolve(ids.map((id, i) => ({ id, body: a.index.parts.get(id).userData.part.body, n: tr[i].x.length, p2p: tr[i].x.length ? Math.hypot(Math.max(...tr[i].x) - Math.min(...tr[i].x), Math.max(...tr[i].y) - Math.min(...tr[i].y)) : null })));
      };
      requestAnimationFrame(tick);
    }));
    const vis = res.filter(r => r.n > 10), rot = vis.filter(r => ROT_BODIES.test(r.body ?? '') || ROT_BODIES.test(r.id));
    const worst = rot.slice().sort((p, q) => q.p2p - p.p2p)[0];
    report.labelStability = report.labelStability ?? {}; report.labelStability[chapter] = res;
    check(`[${chapter}] label anchors of rotating bodies move < 2 px (${rot.length} labels)`, rot.length > 0 && worst.p2p < 2, worst ? `worst ${worst.id} (${worst.body}) ${worst.p2p.toFixed(1)} px; all: ` + vis.map(r => `${r.id}=${r.p2p.toFixed(1)}`).join(' ') : 'no visible labels');
  }
  for (const ch of ['prehled', 'spojka', 'prevodovka']) await labelStability(ch);

  // ---------------------------------------------------------------- gas exchange: section view at 8 cycle angles
  await page.evaluate(() => { const a = window.__app; a.setChapter('ctyri-doby'); });
  await page.waitForTimeout(2500);
  const sec = await page.evaluate(() => ({ view: window.__app.app.view, clip: window.__app.renderer.clippingPlanes.length, gas: window.__app.app.gasOn }));
  check('ctyri-doby default view is the transverse section', sec.view === 'rez' && sec.clip === 1 && sec.gas === true, JSON.stringify(sec));
  const ANGLES = [450, 630, 715, 15, 100, 150, 270, 365];
  let ai = 0;
  for (const psi of ANGLES) {
    await page.evaluate(psi2 => { const a = window.__app; a.setPaused(true); const cur = (((a.sim.state.thetaCrank * 180 / Math.PI) % 720) + 720) % 720; a.app.rotateCrank((psi2 - cur) * Math.PI / 180); a.app.poseDirty = true; }, psi);
    await page.waitForTimeout(450); await nonBlank();
    await page.screenshot({ path: path.join(outDir, `4${ai}-cycle-${String(psi).padStart(3, '0')}${tag}.png`) });
    ai++;
  }
  await page.evaluate(() => { const a = window.__app; a.app.setView('podelny', { instant: true }); a.setPaused(true); });
  await page.waitForTimeout(500); await page.screenshot({ path: path.join(outDir, `48-ctyri-doby-podelny${tag}.png`) });
  const clipOff = await page.evaluate(() => window.__app.renderer.clippingPlanes.length);
  check('"Podélný pohled" removes the global section', clipOff === 0, String(clipOff));
  await page.evaluate(() => { const a = window.__app; a.setChapter('rozvod'); a.app.setView('rez', { instant: true }); a.setPaused(true); });
  await page.waitForTimeout(600); await page.screenshot({ path: path.join(outDir, `49-rozvod-rez${tag}.png`) });
  await page.evaluate(() => { window.__app.setPaused(false); });

  // ---------------------------------------------------------------- ignition: always-visible plugs, transparent cap, spark in sync
  {
    const { pathToFileURL } = await import('node:url');
    const ign = await import(pathToFileURL(path.join(root, 'src/kin/ignition.js')).href);
    const NEXT = { 1: 3, 3: 4, 4: 2, 2: 1 };
    const thrNow = () => page.evaluate(() => { const e = window.__app.sim.state.engine; return e.running ? e.throttleEff : 0; });
    // visible flash meshes per cylinder (1-based): [bool x4]
    const flashSeen = () => page.evaluate(() => [1, 2, 3, 4].map(n => { let v = false; window.__app.app.index.parts.get('ignFlash' + n).traverse(o => { if (o.isMesh && o.visible) v = true; }); return v; }));

    // 1. plugs visible from above with the housings hidden and cut
    await page.evaluate(() => { const a = window.__app; a.setChapter('prehled'); a.setPaused(true); a.app.flyTo({ position: [150, 760, 260], target: [150, 300, 0] }, 0); });
    await page.waitForTimeout(400);
    for (const mode of ['hidden', 'cut']) {
      const res = await page.evaluate(m => {
        const a = window.__app, app = a.app, T = app.THREE; a.setHousing(m); app.poseDirty = true; app.updatePose(); a.renderOnce();
        const cam = a.camera; cam.updateMatrixWorld(true);
        const meshes = []; a.assembly.root.traverseVisible(o => { if (o.isMesh && !o.isInstancedMesh && !(o.material.transparent && o.material.opacity < 0.5)) meshes.push(o); });
        const partOf = o => { for (let p = o; p; p = p.parent) if (p.userData?.part) return p.userData.part.id; return ''; };
        const rc = new T.Raycaster(), out = [];
        for (let n = 1; n <= 4; n++) {
          const box = new T.Box3().setFromObject(app.index.parts.get('ignBoot' + n)), c = box.getCenter(new T.Vector3());
          const dir = c.clone().sub(cam.position), dist = dir.length(); rc.set(cam.position, dir.normalize()); rc.far = dist + 5;
          const hit = rc.intersectObjects(meshes, false).find(h => !(h.object.material.clippingPlanes ?? []).some(pl => pl.distanceToPoint(h.point) < 0) && !(h.object.userData.housing && h.object.material.opacity < 0.5));
          out.push({ n, id: hit ? partOf(hit.object) : null });
        }
        return out;
      }, mode);
      res.forEach(r => check(`ignition: boot ${r.n} visible from above (housings ${mode})`, r.id && /^(ign|sparkPlug)/.test(r.id), `first hit ${r.id}`));
    }

    // 2. cap display by mode, in a chapter without and with a focus list
    for (const chap of ['prehled', 'poradi']) {
      for (const mode of ['solid', 'ghost', 'cut', 'hidden']) {
        const r = await page.evaluate(([c, m]) => {
          const a = window.__app; a.setChapter(c); a.setHousing(m); a.app.poseDirty = true; a.app.updatePose();
          const app = a.app, shells = []; app.assembly.root.traverse(o => { if (o.userData.capShell) shells.push(o); });
          const vis = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
          let rotorMeshes = 0, rotorVisible = 0; app.index.parts.get('ignRotor').traverse(o => { if (o.isMesh) { rotorMeshes++; if (vis(o)) rotorVisible++; } });
          return { n: shells.length, focus: !!app.chapter.focus, mat: shells.map(s => ({ t: s.material.transparent, o: s.material.opacity, dw: s.material.depthWrite, vis: vis(s), clip: s.material.clippingPlanes?.length ?? 0 })), rotorMeshes, rotorVisible };
        }, [chap, mode]);
        const ok = r.n === 1 && r.mat.every(x => x.vis && x.clip === 0 && (mode === 'solid' ? !x.t && x.o === 1 && x.dw : x.t && x.o < 0.5 && !x.dw)) && r.rotorMeshes > 0 && r.rotorVisible === r.rotorMeshes;
        check(`ignition: cap in "${mode}" in chapter ${chap}${r.focus ? ' (focus list)' : ''}`, ok, JSON.stringify(r));
      }
    }

    // 3. + 5. flash in sync with the crank angle (paused), with and without the gas layer
    await page.evaluate(() => { const a = window.__app; a.setChapter('poradi'); a.app.reset(); a.setPaused(true); });
    const thr = await thrNow();
    const setCrank = psi => page.evaluate(p => { const a = window.__app; const cur = (((a.sim.state.thetaCrank * 180 / Math.PI) % 720) + 720) % 720; a.app.rotateCrank((p - cur) * Math.PI / 180); a.app.poseDirty = true; a.app.updatePose(); }, psi);
    for (let c = 0; c < 4; c++) {
      await setCrank((ign.sparkCrankDeg(c, thr) + 1) % 720);
      const f = await flashSeen();
      check(`ignition: crank at spark of cylinder ${c + 1} + 1 deg -> only flash ${c + 1}`, f.every((v, i) => v === (i === c)), JSON.stringify(f) + ` thr ${thr.toFixed(2)}`);
    }
    await page.evaluate(() => window.__app.app.setGas(false));
    await setCrank((ign.sparkCrankDeg(2, thr) + 1) % 720);
    const fNoGas = await flashSeen(), gasVis = await page.evaluate(() => window.__app.app.gasOn);
    check('ignition: flash 3 visible with the gas layer off', gasVis === false && fNoGas.every((v, i) => v === (i === 2)), JSON.stringify(fNoGas));
    await setCrank((ign.sparkCrankDeg(2, thr) + 60) % 720);
    check('ignition: no flash 60 deg after the spark', (await flashSeen()).every(v => !v));
    await page.evaluate(() => window.__app.app.setGas(true));

    // 4. flash while the engine runs (wall clock)
    const sampleFlash = (ms, settle = 0) => page.evaluate(([ms2, settle2]) => new Promise(resolve => {
      const parts = [1, 2, 3, 4].map(n => window.__app.app.index.parts.get('ignFlash' + n)), prev = [false, false, false, false], events = [], seen = [0, 0, 0, 0], t0 = performance.now();
      let any = 0;
      const tick = () => {
        const el = performance.now() - t0;
        parts.forEach((p, i) => { let v = false; p.traverse(o => { if (o.isMesh && o.visible) v = true; }); if (el >= settle2) { if (v) { seen[i]++; any++; } if (v && !prev[i]) events.push(i + 1); } prev[i] = v; });
        if (el < ms2) requestAnimationFrame(tick); else resolve({ events, seen, any });
      };
      requestAnimationFrame(tick);
    }), [ms, settle]);
    await page.evaluate(() => { const a = window.__app; a.setChapter('poradi'); a.app.reset(); a.setPaused(false); a.app.setAssist(true); a.requestGear('N'); a.setInputs({ throttle: 0, ignition: true }); a.setSlowMode('rot'); a.setSlow(1 / 20); });
    await page.waitForTimeout(1500);
    const slow = await sampleFlash(4000);
    const okOrder = slow.events.length >= 4 && slow.events.every((c, i) => i === 0 || NEXT[slow.events[i - 1]] === c);
    check('ignition: running at 1/20, flashes appear in the order 1-3-4-2', okOrder, `events ${slow.events.join('')}, frames visible ${slow.seen}`);
    await page.evaluate(() => window.__app.setSlow(1));
    const fast = await sampleFlash(2000);
    check('ignition: running at 1x, every cylinder flash seen (hold)', fast.seen.every(n => n > 0), `frames visible ${fast.seen}`);
    await page.evaluate(() => window.__app.setInputs({ ignition: false }));
    const off1 = await sampleFlash(1500, 250);
    check('ignition: after "Vypnout motor" no flash appears while the engine coasts down', off1.any === 0, `frames visible ${off1.seen}`);
    await page.evaluate(() => window.__app.fastForward(12, {}));
    const rpm0 = await page.evaluate(() => window.__app.sim.state.rpm.engine);
    const off2 = await sampleFlash(1500);
    check('ignition: engine at 0 rpm, no flash within 1.5 s', Math.abs(rpm0) < 1 && off2.any === 0, `${rpm0.toFixed(1)} rpm, frames visible ${off2.seen}`);

    // 6. screenshots in the new view: spark of cylinder 1 caught on the plug, lead and rotor tip
    await page.evaluate(() => { const a = window.__app; a.setChapter('poradi'); a.app.reset(); a.app.setView('zapalovani', { instant: true }); a.setPaused(true); });
    await setCrank((ign.sparkCrankDeg(0, await thrNow()) + 1) % 720);
    for (const [mode, file] of [['hidden', '40-ignition-hidden'], ['cut', '41-ignition-cut'], ['solid', '42-ignition-solid']]) {
      await page.evaluate(m => { const a = window.__app; a.setHousing(m); a.app.poseDirty = true; a.app.updatePose(); }, mode);
      await page.waitForTimeout(500); await nonBlank();
      await page.screenshot({ path: path.join(outDir, file + tag + '.png') });
    }
    await page.evaluate(() => window.__app.setPaused(false));
  }

  // frame time
  await page.evaluate(() => { const a = window.__app; a.setChapter('prehled'); a.setTimeScale(1 / 4); });
  await page.waitForTimeout(4000);
  report.frame = await page.evaluate(() => ({ ...window.__app.stats }));
  check('frame time reported', report.frame.frameMs > 0, `${report.frame.frameMs?.toFixed(1)} ms/frame, render ${report.frame.renderMs?.toFixed(1)} ms, ${Math.round(report.frame.triangles)} triangles`);

  // text sanity: Czech diacritics present in panel
  const text = await page.evaluate(() => document.body.innerText);
  check('Czech text rendered', /Převodovka|převodovk/.test(text) && /ě|š|č|ř|ž/.test(text));

  // ---------------------------------------------------------------- language: default English, Czech via ?lang=cs, switch control
  const trackConsole = p => { p.on('console', m => { const t = m.type(); if (t === 'error' || t === 'warning') report.console.push({ type: t, text: m.text() }); }); p.on('pageerror', e => report.pageErrors.push(String(e))); };
  const openPage = async (query = '') => {
    const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });   // fresh storage
    const p = await ctx.newPage(); trackConsole(p);
    await p.addInitScript(() => {       // record every string drawn on any 2D canvas (gauges, diagrams)
      window.__canvasText = new Set();
      const o = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (t, ...r) { window.__canvasText.add(String(t)); return o.call(this, t, ...r); };
    });
    await p.goto(url + query, { waitUntil: 'load' });
    await p.waitForFunction(() => window.__app && window.__app.ready, null, { timeout: 120000 });
    await p.evaluate(() => window.__app.ready);
    return p;
  };
  const CZ_CHARS = /[áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/;
  const CZ_WORDS = ['Motor běží', 'Spojka', 'Převodovka', 'Kapitola', 'ot/min', 'mezera', 'Stupeň'].map(w => new RegExp(`(?<![\\p{L}])${w}(?![\\p{L}])`, 'iu'));
  const attrText = p => p.evaluate(() => [...document.querySelectorAll('[title],[aria-label],[placeholder]')].flatMap(e => [e.title, e.getAttribute('aria-label'), e.getAttribute('placeholder')]).filter(Boolean).join('\n'));
  const pageText = async p => (await p.evaluate(() => document.body.innerText + '\n' + [...window.__canvasText].join('\n') + '\n' + document.title + '\n' + (document.querySelector('meta[name=description]')?.content ?? '') + '\n' + document.getElementById('loading-msg')?.textContent)) + '\n' + await attrText(p);

  // default: English
  {
    const p = await openPage();
    const d = await p.evaluate(() => ({ lang: document.documentElement.lang, title: document.title, txt: document.body.innerText, ch: window.__app.app.chapter.title, sw: [...document.querySelectorAll('.lang-switch button')].map(b => b.textContent + ':' + b.getAttribute('aria-pressed')).join(' ') }));
    check('language: default (no parameter, empty storage) is English', d.lang === 'en' && /Engine and gearbox/.test(d.title) && /Chapter 01/i.test(d.txt) && /Overview of the Drivetrain/.test(d.ch) && /Engine running/i.test(d.txt), JSON.stringify({ lang: d.lang, title: d.title, ch: d.ch, sw: d.sw }));
    check('language: switch control shows EN active', d.sw === 'CZ:false EN:true', d.sw);
    await p.context().close();
  }

  // English
  {
    const p = await openPage('?lang=en');
    const texts = [];
    const sample = async () => texts.push(await pageText(p));
    const I = await p.evaluate(() => ({ lang: document.documentElement.lang, title: document.title }));
    check('language: ?lang=en sets <html lang> and the document title', I.lang === 'en' && I.title === 'Engine and gearbox – interactive 3D model', JSON.stringify(I));
    await p.evaluate(() => { window.__toastLog = []; new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => window.__toastLog.push(n.textContent)))).observe(document.getElementById('toasts'), { childList: true }); });
    await sample();
    const shots = { prehled: '60-en-prehled', 'ctyri-doby': '61-en-ctyri-doby', spojka: '62-en-spojka', synchron: '63-en-synchron' };
    const ids = await p.evaluate(() => window.__app.app.chapterIds);
    for (const id of ids) {
      await p.evaluate(i => { window.__app.setChapter(i); window.__app.app.setLabelsOn(true); }, id);
      await p.waitForTimeout(2300);
      await sample();
      if (shots[id]) await p.screenshot({ path: path.join(outDir, shots[id] + tag + '.png') });
    }
    await p.evaluate(() => { const a = window.__app; a.setChapter('poradi'); a.app.setView('zapalovani', { instant: true }); a.app.setLabelsOn(true); });
    await p.waitForTimeout(1500);
    await sample();
    // clutch-link tags in English
    await p.evaluate(() => { const a = window.__app; a.setChapter('spojka'); a.app.setLabelsOn(true); });
    await p.waitForTimeout(1500);
    const tg = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll('.linktag')].map(e => [e.dataset.k, e.textContent])));
    check('language: EN clutch-link tags are English', /^engine −?\d+ rpm$/.test(tg.engine ?? '') && /^disc \+ input shaft −?\d+ rpm$/.test(tg.shaft ?? '')
      && ['COUPLED · friction grips', 'SLIPPING', 'DISCONNECTED · gap'].includes(tg.state) && !CZ_CHARS.test(Object.values(tg).join('')), JSON.stringify(tg));
    await sample();
    // chapter views / actions / legend: click every button of every chapter's action row once (text only)
    // glossary + simplifications tabs
    await p.click('.p-tab[data-k=glossary]'); await sample();
    await p.click('.gentry'); await sample();
    await p.click('.p-tab[data-k=simpl]'); await sample();
    await p.click('.p-tab[data-k=chapters]');
    // hover tooltip + part card for three picked parts
    const picked = [];
    for (const [ch, cands] of [['klika', ['piston2', 'piston3']], ['prehled', ['flywheel', 'crankshaft']], ['prevodovka', ['inputShaft', 'counterShaft', 'mainShaft']]]) {
      await p.evaluate(c => { const a = window.__app; a.setChapter(c); a.setPaused(true); }, ch);
      await p.waitForTimeout(1900);
      for (const id of cands) {
        const pt = await p.evaluate(pid => {
          const a = window.__app.app, THREE = a.THREE, g = a.index.parts.get(pid); if (!g) return null;
          const c = new THREE.Box3().setFromObject(g).getCenter(new THREE.Vector3()).project(a.scene.camera), r = a.scene.canvas.getBoundingClientRect();
          return { x: r.left + (c.x * 0.5 + 0.5) * r.width, y: r.top + (-c.y * 0.5 + 0.5) * r.height };
        }, id);
        if (!pt) continue;
        await p.mouse.move(pt.x - 3, pt.y); await p.mouse.move(pt.x, pt.y, { steps: 3 }); await p.waitForTimeout(400);
        const tip = await p.evaluate(() => { const t = document.getElementById('tooltip'); return t.style.display !== 'none' ? t.textContent : ''; });
        await p.mouse.click(pt.x, pt.y); await p.waitForTimeout(300);
        const card = await p.evaluate(() => { const c = document.getElementById('partcard'); return c.style.display === 'block' ? c.innerText : ''; });
        if (tip && card) { picked.push({ id, tip, card: card.replace(/\n/g, ' ').slice(0, 70) }); texts.push(tip, card); await p.evaluate(() => window.__app.app.selectPart(null)); break; }
      }
    }
    check('language: EN hover tooltip + part card for 3 picked parts', picked.length >= 3 && picked.every(x => !CZ_CHARS.test(x.tip + x.card)), JSON.stringify(picked));
    // toasts: gear engagement, grinding (assistant off, no clutch), stall
    await p.evaluate(() => { const a = window.__app; a.setChapter('jizda'); a.reset(); a.setSlowMode('rot'); a.setSlow(1); a.setPaused(false); });
    await p.waitForTimeout(1500);
    await p.keyboard.press('1'); await p.waitForTimeout(4500);
    await p.evaluate(() => {
      const a = window.__app; a.app.setAssist(false); a.setInputs({ throttle: 0.5, clutchPedal: 0, lever: '3' });
    });
    await p.waitForTimeout(2500); await sample();
    await p.evaluate(() => {
      const a = window.__app; a.app.setAssist(false);
      a.setInputs({ throttle: 0, clutchPedal: 1, lever: '1' }); a.fastForward(3, {});
      a.setInputs({ throttle: 0.5, clutchPedal: 0 }); a.fastForward(5, {});
      a.setInputs({ throttle: 0, brake: 1 }); a.setPaused(false);
    });
    await p.waitForFunction(() => /stall/i.test(window.__toastLog.join('|')), null, { timeout: 12000 }).catch(() => {});
    await p.waitForTimeout(500); await sample();
    await p.evaluate(() => { const a = window.__app; a.setInputs({ brake: 0, clutchPedal: 1, lever: 'N' }); a.app.setAssist(true); });
    await p.waitForTimeout(800);
    await p.keyboard.press('2'); await p.waitForTimeout(3000); await sample();
    const log = await p.evaluate(() => window.__toastLog);
    texts.push(...log);
    check('language: EN toasts seen (engaged + stall + grind)', log.some(t => /^Engaged: /.test(t)) && log.some(t => /stalled/i.test(t)) && log.some(t => /Synchronizer is blocking/.test(t)), JSON.stringify(log));
    // every part label: no Czech name left
    const labs = await p.evaluate(() => [...window.__app.app.index.parts.values()].map(g => g.userData.part.label));
    // 3D labels rendered in the scene are DOM: sampled above through innerText; the tooltip/card use the same partLabel()
    const all = texts.join('\n');
    const hits = [...new Set(all.split('\n').filter(l => CZ_CHARS.test(l)))].slice(0, 8);
    const words = CZ_WORDS.filter(re => re.test(all)).map(String);
    check('language: no Czech characters anywhere in the English UI', hits.length === 0, hits.join(' | '));
    check('language: none of the Czech marker words in the English UI', words.length === 0, words.join(' '));
    check('language: English UI sampled a lot of text', all.length > 20000 && /Chapter 01/i.test(all) && /Engine running|Engine stopped|Engine coasting/i.test(all), `${all.length} chars, ${labs.length} part labels`);
    await p.context().close();
  }

  // real clicks on the switch: CZ keeps the chapter, EN returns
  {
    const p = await openPage();
    await p.evaluate(() => window.__app.setChapter('spojka'));
    await p.waitForTimeout(800);
    await p.click('.lang-switch button[data-lang=cz], .lang-switch button[data-lang=cs]');
    await p.waitForFunction(() => document.documentElement.lang === 'cs' && window.__app && window.__app.app, null, { timeout: 120000 });
    await p.evaluate(() => window.__app.ready);
    let d = await p.evaluate(() => ({ lang: document.documentElement.lang, ch: window.__app.app.chapter.id, kicker: document.querySelector('.kicker').textContent, h2: document.querySelector('article.chapter h2').textContent, stored: localStorage.getItem('engine-gearshift.lang'), sw: [...document.querySelectorAll('.lang-switch button')].map(b => b.textContent + ':' + b.getAttribute('aria-pressed')).join(' ') }));
    check('language: click CZ reloads in Czech on the same chapter', d.lang === 'cs' && d.stored === 'cs' && d.ch === 'spojka' && /^Kapitola 06/.test(d.kicker) && d.h2 === 'Setrvačník a spojka' && d.sw === 'CZ:true EN:false', JSON.stringify(d));
    await p.click('.lang-switch button[data-lang=en]');
    await p.waitForFunction(() => document.documentElement.lang === 'en' && window.__app && window.__app.app, null, { timeout: 120000 });
    await p.evaluate(() => window.__app.ready);
    d = await p.evaluate(() => ({ lang: document.documentElement.lang, ch: window.__app.app.chapter.id, kicker: document.querySelector('.kicker').textContent, h2: document.querySelector('article.chapter h2').textContent, stored: localStorage.getItem('engine-gearshift.lang') }));
    check('language: click EN returns to English on the same chapter', d.lang === 'en' && d.stored === 'en' && d.ch === 'spojka' && /^Chapter 06/.test(d.kicker) && d.h2 === 'Flywheel and Clutch', JSON.stringify(d));
    await p.context().close();
  }

  const errs = report.console.filter(c => c.type === 'error').concat(report.pageErrors.map(t => ({ type: 'pageerror', text: t })));
  const warns = report.console.filter(c => c.type === 'warning' && !/GPU stall|swiftshader|GL Driver|BVH: "maxLeafSize"/i.test(c.text));
  check('no console errors / page errors', errs.length === 0, errs.map(e => e.text).join(' | ').slice(0, 400));
  check('no console warnings', warns.length === 0, warns.map(e => e.text).join(' | ').slice(0, 400));
} catch (e) {
  report.ok = false; report.fatal = String(e?.stack ?? e);
  console.error(e);
  await page.screenshot({ path: path.join(outDir, `fatal${tag}.png`) }).catch(() => {});
} finally {
  fs.writeFileSync(path.join(outDir, `report${tag}.json`), JSON.stringify(report, null, 2));
  await browser.close();
  server.close();
}
console.log(report.ok ? 'VISUAL CHECK PASSED' : 'VISUAL CHECK FAILED');
process.exit(report.ok ? 0 : 1);
