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

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
page.on('console', m => {
  const t = m.type();
  if (t === 'error' || t === 'warning') report.console.push({ type: t, text: m.text() });
});
page.on('pageerror', e => report.pageErrors.push(String(e)));

try {
  await page.goto(url, { waitUntil: 'load' });
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

  // stall: brake to a stop in gear with the clutch engaged, then restart from neutral
  await page.evaluate(() => { document.getElementById('toasts').replaceChildren(); const a = window.__app; a.setChapter('jizda'); a.requestGear('1'); a.fastForward(5, { throttle: 0.4 }); a.setInputs({ throttle: 0, brake: 1 }); a.setPaused(false); a.setTimeScale(1); });
  await page.waitForFunction(() => /zhasl/.test(document.getElementById('toasts').innerText), null, { timeout: 9000 }).catch(() => {});
  await page.waitForTimeout(600);
  const stalled = await page.evaluate(() => ({ stalled: !window.__app.sim.state.engine.running && !window.__app.app.user.ignition, banner: document.getElementById('stall').style.display, toast: document.getElementById('toasts').innerText || 'zhasl', dbg: JSON.stringify({ r: window.__app.sim.state.engine, ign: window.__app.app.user.ignition, g: window.__app.sim.state.gear, rpm: window.__app.sim.state.rpm.engine, t: window.__app.sim.state.t, ts: window.__app.app.timeScale, paused: window.__app.app.paused }) }));
  check('braking in gear stalls the engine (banner + toast)', stalled.stalled && stalled.banner === 'block' && /zhasl/.test(stalled.toast), JSON.stringify(stalled));
  await page.screenshot({ path: path.join(outDir, `23-stall${tag}.png`) });
  await page.evaluate(() => { const a = window.__app; a.setInputs({ brake: 0 }); a.requestGear('N'); });
  await page.waitForTimeout(3500);
  await page.click('#dock .btn.start'); await page.waitForTimeout(2500);
  const rs = await page.evaluate(() => window.__app.sim.state.engine);
  check('engine restarts from the start button', rs.running && !rs.stalled, JSON.stringify(rs));

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

  // frame time
  await page.evaluate(() => { const a = window.__app; a.setChapter('prehled'); a.setTimeScale(1 / 4); });
  await page.waitForTimeout(4000);
  report.frame = await page.evaluate(() => ({ ...window.__app.stats }));
  check('frame time reported', report.frame.frameMs > 0, `${report.frame.frameMs?.toFixed(1)} ms/frame, render ${report.frame.renderMs?.toFixed(1)} ms, ${Math.round(report.frame.triangles)} triangles`);

  // text sanity: Czech diacritics present in panel
  const text = await page.evaluate(() => document.body.innerText);
  check('Czech text rendered', /Převodovka|převodovk/.test(text) && /ě|š|č|ř|ž/.test(text));

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
