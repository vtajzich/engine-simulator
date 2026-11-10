import { poseFromState } from '../kin/pose.js';
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

  function updatePose() {
    app.pose = poseFromState(app.sim.state);
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
