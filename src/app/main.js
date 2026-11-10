import './style.css';
import * as THREE from 'three';
import { chapters, ui } from './content/index.js';
import { CHAPTER_KEY } from './i18n.js';
import { createScene } from './scene.js';
import { indexModel } from './modelIndex.js';
import { createHousing } from './housing.js';
import { createHighlight } from './highlight.js';
import { createLabels } from './labels.js';
import { createCaps } from './caps.js';
import { createGapMarks } from './gapmarks.js';
import { createPicking } from './picking.js';
import { createInput } from './input.js';
import { createLoop } from './loop.js';
import { buildDock } from './ui/dock.js';
import { buildPanel } from './ui/panel.js';
import { buildToolbar } from './ui/toolbar.js';
import { createToaster } from './ui/toasts.js';
import { buildPartCard } from './ui/partcard.js';

const simModules = import.meta.glob('../sim/*.js');
const yieldFrame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));

async function boot() {
  const msg = document.getElementById('loading-msg');
  await yieldFrame();

  const [{ buildAssembly }, simMod, drvMod] = await Promise.all([
    import('../model/assembly.js'),
    simModules['../sim/sim.js']?.(),
    simModules['../sim/driver.js']?.(),
  ]);
  if (!simMod || !drvMod) throw new Error(ui.simMissing);
  msg.textContent = ui.loadingMsgDots;
  await yieldFrame();
  const assembly = buildAssembly();

  const stage = document.getElementById('stage');
  const scene = createScene(stage);
  scene.scene.add(assembly.root);
  const index = indexModel(assembly);

  const listeners = {};
  const app = {
    assembly, index, scene, THREE,
    sim: null, driver: null, pose: null,
    user: { throttle: 0, clutchPedal: 0, brake: 0, lever: 'N', ignition: true },
    assist: true, paused: false, slow: 1 / 20, slowMode: 'rot', view: null, poseDirty: true,
    chapterIds: chapters.map(c => c.id), chapter: null, stats: { frameMs: 0, renderMs: 0, triangles: index.triangles },
    on(ev, fn) { (listeners[ev] ??= []).push(fn); },
    emit(ev, arg) { (listeners[ev] ?? []).forEach(fn => fn(arg)); },
    get state() { return app.sim.state; },
    // two independent slow-motion factors: rotation only (angles drawn slower, everything else real time) or the whole clock
    get rotScale() { return app.slowMode === 'rot' ? app.slow : 1; },
    get timeScale() { return app.slowMode === 'time' ? app.slow : 1; },
    toast: () => {},
  };
  const newSim = () => { app.sim = simMod.createSim(); app.driver = drvMod.createDriver(app.sim); app.sim.angleScale = app.rotScale; };
  newSim();

  app.housing = createHousing(index, () => { app.highlight?.setSection(app.housing.mode === 'cut' ? app.housing.plane : null); app.updateCaps?.(); scene.markDirty(); app.emit('housing'); });
  app.highlight = createHighlight(index, () => scene.markDirty());
  app.caps = createCaps({ index, scene, plane: app.housing.plane, onChange: () => scene.markDirty() });
  // in a section with caps the clutch cover is drawn dark so that the gaps between the clutch parts read as gaps
  app.gapMarks = createGapMarks({ scene, host: stage });
  app.updateCaps = () => {
    const on = !!app.chapter?.caps && app.housing.mode === 'cut' && !app.section;
    app.caps.setActive(on);
    app.housing.setShellTint(on ? '#14171c' : app.shellTint ?? null);
    scene.markDirty();
  };
  app.labels = createLabels({ index, scene, host: stage });
  app.input = createInput(app);
  app.toast = createToaster(stage);

  // ---- control API (also used by the chapters and the test hook)
  app.reset = () => {
    newSim();
    Object.assign(app.user, { throttle: 0, clutchPedal: 0, brake: 0, lever: 'N', ignition: true }); app.stallFlag = false; app.ignitionT = -1;
    app.poseDirty = true; app.emit('inputs'); app.emit('stateReset');
  };
  app.setInputs = o => { Object.assign(app.user, o); app.emit('inputs'); };
  app.setAssist = b => {
    app.assist = !!b;
    app.user.lever = app.sim.state.gear;      // keep the manual lever where the driver left it
    app.emit('inputs');
  };
  app.setSlow = x => { app.slow = x; app.sim.angleScale = app.rotScale; app.emit('timescale'); };
  app.setTimeScale = app.setSlow;               // kept for the test hook
  app.setSlowMode = m => { app.slowMode = m === 'time' ? 'time' : 'rot'; app.sim.angleScale = app.rotScale; app.emit('timescale'); };
  app.setPaused = b => { app.paused = !!b; app.poseDirty = true; app.emit('timescale'); };
  app.setHousing = m => app.housing.set(m);
  app.requestGear = g => {
    g = String(g).toUpperCase();
    app.user.lever = g;                         // the driver adopts it when idle, so toggling the assistant never moves the lever
    if (app.assist) app.driver.request(g);
    app.emit('inputs');
  };
  app.fastForward = (seconds, inputs = {}) => {
    const h = 1 / 240, n = Math.round(seconds / h);
    app.sim.angleScale = app.rotScale;
    for (let i = 0; i < n; i++) {
      const u = { ...app.user, ...inputs };
      app.sim.step(h, app.assist ? app.driver.update(h, u) : u);
    }
    app.sim.drainEvents();
    app.poseDirty = true; app.emit('inputs');
  };
  app.until = (pred, maxSec, inputs = {}) => { for (let t = 0; t < maxSec && !pred(); t += 0.05) app.fastForward(0.05, inputs); };
  app.rotateCrank = d => { app.sim.rotateCrank(d); app.poseDirty = true; };

  // gas toggle: gas / spark parts
  const gasParts = [...index.parts.entries()].filter(([id]) => /^(gas|spark)\d/.test(id)).map(([, g]) => g);
  app.setGas = b => { gasParts.forEach(g => { g.userData.hiddenByUser = !b; g.visible = b && !g.userData.focusHidden; }); app.gasOn = b; scene.markDirty(); app.emit('overlays'); };
  // top-end updates set gas visible every frame → re-apply after assembly.update
  const origUpdate = assembly.update.bind(assembly);
  assembly.update = pose => { origUpdate(pose); gasParts.forEach(g => { if (app.gasOn === false || g.userData.focusHidden) g.visible = false; }); };
  app.gasOn = true;

  const groups = {
    engine: [assembly.modules.bottomEnd?.group, assembly.modules.topEnd?.group],
    clutch: [assembly.modules.clutch?.group],
    gearbox: [assembly.modules.gearbox?.group, assembly.modules.shift?.group],
  };
  app.groupVisible = {};
  app.setGroup = (k, b) => { app.groupVisible[k] = b; groups[k].forEach(g => g && (g.visible = b)); scene.markDirty(); app.emit('overlays'); };
  ['engine', 'clutch', 'gearbox'].forEach(k => { app.groupVisible[k] = true; });
  app.setFlowOn = b => { app.highlight.setFlowOn(b); app.emit('overlays'); };
  app.setLabelsOn = b => { app.labelsWanted = b; app.labels.setOn(b); scene.markDirty(); app.emit('overlays'); };

  app.picking = createPicking({
    index, scene, host: stage, housing: app.housing,
    onSelect: part => app.selectPart(part),
  });
  app.selectPart = part => { app.emit('select', part); app.highlight.select(part ? p => p.id === part.id : null); };
  app.selectMatch = match => {
    app.emit('select', null);
    app.highlight.select(match ? p => match.some(m => p.id.startsWith(m) || (p.body ?? '').startsWith(m)) : null);
  };

  app.cameraViews = {
    overview: { position: [380, 330, 1290], target: [385, 105, 0] },
    engine: { position: [150, 280, 760], target: [140, 130, 0] },
    clutch: { position: [430, 160, 560], target: [420, 0, 0] },
    gearbox: { position: [680, 160, 820], target: [670, -30, 0] },
  };
  app.flyTo = (v, d) => scene.flyTo(typeof v === 'string' ? app.cameraViews[v] : v, d);

  // ---- per-chapter section: one global clipping plane, every material double-sided while it is active
  app.section = null;
  app.setSection = def => {
    app.section = def ?? null;
    const plane = def ? new THREE.Plane(new THREE.Vector3(...def.normal), def.constant) : null;
    scene.setGlobalClip(plane);
    app.highlight.setDouble(!!plane); app.updateCaps();
    app.housing.setForceDouble(!!plane);
    scene.markDirty();
  };
  app.setTint = map => { app.caps.setTint(map); app.highlight.setTint(map); app.shellTint = map?.find(([p]) => p === 'clutchCover')?.[1] ?? null; app.updateCaps(); };

  // `fit` (mm): distance chosen so that this much of the scene height fills the stage (keeps close views legible at any window size)
  const fitCamera = (cam, fit) => {
    if (!cam || !fit) return cam;
    const H = stage.clientHeight || 724, pxmm = (H - 60) / fit, fov = (cam.fov ?? 36) * Math.PI / 180;
    const dist = (H / pxmm) / (2 * Math.tan(fov / 2));
    const d = cam.position.map((x, i) => x - cam.target[i]), len = Math.hypot(...d);
    return { ...cam, position: cam.target.map((t, i) => t + d[i] / len * dist) };
  };

  // a chapter view = camera (+ optional housing mode and section)
  app.setView = (id, { instant = false } = {}) => {
    const ch = app.chapter, v = ch?.views?.find(x => x.id === id) ?? ch?.views?.[0] ?? null;
    app.view = v?.id ?? null;
    app.setHousing(v?.housing ?? ch?.housing ?? 'ghost');
    app.setSection(v?.section ?? null);
    app.flyTo(fitCamera(v?.camera ?? ch?.camera, v?.fit), instant ? 0 : 1.3);
    app.poseDirty = true;
    app.emit('view', v);
  };

  app.setChapter = (id, { instant = false } = {}) => {
    const ch = chapters.find(c => c.id === id) ?? chapters[0];
    app.chapter = ch;
    app.setPaused(false);
    ch.setup?.(app);
    app.highlight.setFocus(ch.focus);
    // gas / spark of cylinders outside the chapter focus are hidden (a section would show them through the focused cylinder)
    gasParts.forEach(g => { g.userData.focusHidden = !!ch.focus?.length && !ch.focus.some(p => g.userData.part.id.startsWith(p)); });
    app.highlight.select(null); app.emit('select', null);
    app.labels.set(ch.labels ?? []);
    app.labels.setOn((ch.labels ?? []).length > 0 && app.labelsWanted !== false); app.emit('overlays');
    app.setGas(['ctyri-doby', 'poradi'].includes(ch.id));
    app.setFlowOn(!!ch.flow);
    app.setTint(ch.tint);
    app.setSlowMode(ch.slowMode ?? 'rot');
    app.setSlow(ch.slow ?? 1 / 20);
    app.setView(ch.views?.[0]?.id ?? null, { instant });
    app.emit('chapter', ch);
  };
  app.replayChapter = () => app.chapter && app.setChapter(app.chapter.id, { instant: false });

  // ---- UI
  buildToolbar(app, stage);
  buildPartCard(app, stage);
  buildPanel(app, document.getElementById('panel'), stage);
  buildDock(app, document.getElementById('dock'));
  createLoop(app).start();

  let startId = chapters[0].id;      // after a language switch, return to the chapter the user was reading
  try { const saved = sessionStorage.getItem(CHAPTER_KEY); sessionStorage.removeItem(CHAPTER_KEY); if (chapters.some(c => c.id === saved)) startId = saved; } catch { /* storage blocked */ }
  app.setChapter(startId, { instant: true });
  app.renderOnce();

  window.__app = Object.assign(window.__app ?? {}, {
    sim: app.sim, driver: app.driver, assembly, camera: scene.camera, renderer: scene.renderer, stats: app.stats, app,
    getPose: () => app.pose, setChapter: app.setChapter, setPaused: app.setPaused, setTimeScale: app.setTimeScale, setSlow: app.setSlow, setSlowMode: app.setSlowMode,
    setInputs: app.setInputs, requestGear: app.requestGear, fastForward: app.fastForward, setHousing: app.setHousing,
    renderOnce: app.renderOnce, reset: app.reset,
  });
  // keep sim/driver references live across reset()
  Object.defineProperty(window.__app, 'sim', { get: () => app.sim, configurable: true });
  Object.defineProperty(window.__app, 'driver', { get: () => app.driver, configurable: true });
  return app;
}

// static text of index.html (Czech by default) follows the selected language
document.title = ui.docTitle;
document.querySelector('meta[name="description"]')?.setAttribute('content', ui.docDescription);
document.querySelector('#loading .loading-title').textContent = ui.loading;
document.getElementById('loading-msg').textContent = ui.loadingMsg;

window.__app = {};
window.__app.ready = boot().then(app => {
  const l = document.getElementById('loading');
  l.classList.add('done'); setTimeout(() => l.remove(), 700);
  return true;
}).catch(err => {
  console.error(err);
  document.getElementById('loading-msg').textContent = ui.errorPrefix + err.message;
  throw err;
});
