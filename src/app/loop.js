import { poseFromState } from '../kin/pose.js';
import { sparkAdvanceDeg } from '../kin/ignition.js';
import { mod } from '../kin/derive.js';
import { ui } from './content/index.js';

/** Frame loop: input → driver → sim → pose → assembly → render. */
export function createLoop(app) {
  const { scene } = app;
  let last = performance.now(), uiAcc = 0, frames = 0, msAcc = 0, lastGrind = -9;

  function handleEvents() {
    const evs = app.sim.drainEvents();
    // ignore stalls that happened before the user's last click on the start button (app.ignitionT)
    if (evs.some(e => e.type === 'stall' && e.t >= (app.ignitionT ?? -1))) {
      // the starter may already have restarted the engine within this frame; keep it off until the user starts it
      app.user.ignition = false; app.stallFlag = true;
      app.toast(ui.toasts.stall, 'bad'); app.emit('inputs');
    }
    for (const ev of evs) {
      switch (ev.type) {
        case 'start': if (!app.stallFlag) app.toast(ui.toasts.start, 'ok'); break;
        case 'grind': {
          const now = performance.now() / 1000;
          if (now - lastGrind < 1.2) break;
          lastGrind = now;
          app.toast(ev.detail === 'reverse' ? ui.toasts.grindReverse : ui.toasts.grindClutch, 'warn');
          break;
        }
        case 'gearEngaged': app.toast(ui.toasts.engaged(String(ev.detail)), 'ok'); break;
        default: break;
      }
    }
  }

  // Spark flash hold: the pose flash (12 crank degrees) is shorter than a frame at real speed, so a spark that happened
  // since the previous frame keeps the flash visible for FLASH_HOLD_MS of wall-clock time. Only the pose is changed.
  const FLASH_HOLD_MS = 70;
  let prevPsi = null, tSpark = [];
  app.resetFlash = () => { prevPsi = null; tSpark = []; };
  function holdFlash(pose, state) {
    const now = performance.now(), psiS = 720 - sparkAdvanceDeg(state.engine.running ? state.engine.throttleEff : 0);
    pose.cylinders.forEach((c, i) => {
      c.flashAngle = c.flash ?? 0;                 // angle-only value: drives the rotor arc, which is never held
      if (prevPsi) {
        const d = mod(c.psiDeg - prevPsi[i], 720);
        if (state.engine.running && d > 0 && d < 360 && mod(psiS - prevPsi[i], 720) < d) tSpark[i] = now;
      }
      if ((c.flash ?? 0) > 0) tSpark[i] = now;
      if (tSpark[i] != null) c.flash = Math.max(c.flash ?? 0, Math.max(0, 1 - (now - tSpark[i]) / FLASH_HOLD_MS));
    });
    prevPsi = pose.cylinders.map(c => c.psiDeg);
  }

  function updatePose() {
    app.pose = poseFromState(app.sim.state);
    if (!app.paused) holdFlash(app.pose, app.sim.state); else prevPsi = null;
    app.assembly.update(app.pose);
    app.highlight.setFlow(app.pose.flow);
    app.labels.update();
    app.gapMarks.update(app.view === 'detail', app.sim.state.clutchPedal);
    scene.markDirty();
  }
  app.updatePose = updatePose;

  function refreshUi() { app.emit('tick', { state: app.sim.state, pose: app.pose }); }

  function frame(now) {
    requestAnimationFrame(frame);
    const raw = (now - last) / 1000, rdt = Math.min(0.05, raw);
    last = now;
    if (document.hidden) return;
    if (app.input.update(rdt)) app.emit('inputs');
    if (!app.paused) {
      const sdt = rdt * app.timeScale;           // real time unless the user chose "full time"
      app.sim.angleScale = app.rotScale;         // otherwise only the drawn rotation is slowed
      const u = { ...app.user };
      const ins = app.assist ? app.driver.update(sdt, u) : u;
      app.sim.step(sdt, ins);
      handleEvents();
      updatePose();
      msAcc += rdt * 1000; frames++;
      if (frames >= 30) { app.stats.frameMs = msAcc / frames; frames = 0; msAcc = 0; }
    } else if (app.poseDirty) {
      handleEvents(); updatePose();
    }
    app.poseDirty = false;
    if (app.labels.on) { app.labels.update(); scene.markDirty(); }
    scene.updateTween(Math.min(0.25, raw));
    scene.controls.update();
    app.clutchLink.update(app.paused ? 0 : rdt);
    uiAcc += rdt;
    if (uiAcc > 0.066) { uiAcc = 0; refreshUi(); }
    if (scene.consumeDirty()) { const t0 = performance.now(); scene.renderer.render(scene.scene, scene.camera); app.stats.renderMs = performance.now() - t0; }
  }

  app.renderOnce = () => {
    updatePose(); refreshUi(); scene.controls.update();
    scene.renderer.render(scene.scene, scene.camera);
  };
  return { start() { last = performance.now(); requestAnimationFrame(frame); } };
}
