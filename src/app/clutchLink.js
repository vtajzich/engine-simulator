import * as THREE from 'three';
import { SPEC } from '../spec.js';
import { clutchStack, releaseKin } from '../kin/clutch.js';
import { CLUTCH_PATH } from '../model/clutch.js';
import { ui, num } from './content/index.js';

const NS = 'http://www.w3.org/2000/svg';
const RPM = 30 / Math.PI;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/**
 * Overlay for the clutch chapter: the torque path (animated dashes) from the engine through the two friction interfaces
 * to the input shaft, and the state of those interfaces (locked / slipping / open with an exaggerated dark gap band).
 * Drawn in the section plane z = 0, upper half: world point (x, rho, 0).
 */
export function createClutchLink({ app, scene, host }) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'clink');
  svg.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;z-index:3;display:none');
  host.appendChild(svg);
  const el = (tag, attrs = {}) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    svg.appendChild(e);
    return e;
  };
  const tag = k => { const e = document.createElement('div'); e.className = 'linktag'; e.dataset.k = k; e.style.display = 'none'; host.appendChild(e); return e; };

  const c = SPEC.clutch, disc = c.disc, fw = c.flywheel.x, shafts = SPEC.gearbox.shafts, wallX = SPEC.gearbox.walls.front[0];
  const st = clutchStack();
  const Rm = (disc.outerDiameter + disc.innerDiameter) / 4, ri = disc.innerDiameter / 2, ro = disc.outerDiameter / 2;
  const fwMid = (fw[0] + fw[1]) / 2, P = CLUTCH_PATH;

  // torque paths: points are [x, rho] in mm; kind 'e' follows the engine rpm, 'd' the input-shaft rpm
  const paths = [];
  const addPath = (kind, build) => {
    const under = el('path', { class: 'under' });
    const dash = el('path', { class: 'dash ' + kind });
    paths.push({ kind, build, under, dash, offset: 0 });
  };
  addPath('e', () => [[fw[0] - 16, 0], [fw[0] - 5, 30], [fwMid, 60], [fwMid, Rm], [fw[1], Rm]]);
  addPath('e', k => [[fwMid, Rm], [fwMid, P.boltRho], [fw[1] + 3, P.coverRho], [P.coverRearX, P.coverRho], [P.coverRearX, P.strapRho],
    [st.plateRearX + k.plateLift, P.strapRho], [(st.plateFrontX + st.plateRearX) / 2 + k.plateLift, Rm], [st.plateFrontX + k.plateLift, Rm]]);
  addPath('d', k => [[st.discFrontX + k.discShift, Rm], [st.discFrontX + disc.thickness / 2 + k.discShift, Rm]]);
  addPath('d', k => [[st.discRearX + k.discShift, Rm], [st.discFrontX + disc.thickness / 2 + k.discShift, Rm]]);
  addPath('d', k => {
    const xd = st.discFrontX + disc.thickness / 2 + k.discShift;
    return [[xd, Rm], [xd, disc.damperRadius], [xd, disc.hubOD / 2], [xd + 8, shafts.inputDiameter / 2], [wallX + 10, shafts.inputDiameter / 2]];
  });

  // interfaces A (flywheel | disc) and B (disc | pressure plate)
  const mkInterface = () => ({
    band: el('polygon', { fill: '#05070a' }),
    l1: el('line', { stroke: '#dfe7ee', 'stroke-width': 1.5 }),
    l2: el('line', { stroke: '#dfe7ee', 'stroke-width': 1.5 }),
    grip: el('line', { 'stroke-linecap': 'round' }),
  });
  const ifaces = [mkInterface(), mkInterface()];
  const tags = { engine: tag('engine'), shaft: tag('shaft'), state: tag('state') };

  const v = new THREE.Vector3();
  let width = 1, height = 1;
  const px = (x, rho) => { v.set(x, rho, 0).project(scene.camera); return [(v.x * 0.5 + 0.5) * width, (-v.y * 0.5 + 0.5) * height]; };
  const setLine = (l, a, b) => { l.setAttribute('x1', a[0]); l.setAttribute('y1', a[1]); l.setAttribute('x2', b[0]); l.setAttribute('y2', b[1]); };

  const api = {
    state: 'locked', engineRpm: 0, inputRpm: 0,
    update(dt) {
      const s = app.sim.state;
      const cap = s.clutch.capacityNm / c.maxTorqueNm;
      api.state = cap <= 1e-6 ? 'open' : s.clutch.locked ? 'locked' : 'slip';
      api.engineRpm = s.omegaCrank * RPM; api.inputRpm = s.omegaInput * RPM;
      const show = app.chapter?.clutchLink === true && !!app.labels?.on;
      svg.style.display = show ? 'block' : 'none';
      for (const t of Object.values(tags)) t.style.display = show ? 'block' : 'none';
      if (!show) return;

      scene.camera.updateMatrixWorld();
      width = host.clientWidth; height = host.clientHeight;
      const k = releaseKin(s.clutchPedal);
      const inRun = Math.abs(api.inputRpm) >= 5;

      for (const p of paths) {
        const rpm = p.kind === 'e' ? api.engineRpm : api.inputRpm;
        const moving = p.kind === 'e' || inRun;
        const sp = moving ? Math.sign(rpm) * clamp(Math.abs(rpm) / 800 * 70, 0, 220) : 0;
        p.offset -= sp * dt;
        const d = 'M' + p.build(k).map(q => px(q[0], q[1]).join(',')).join(' L');
        p.under.setAttribute('d', d); p.dash.setAttribute('d', d);
        p.dash.style.strokeDashoffset = p.offset;
        p.dash.classList.toggle('stopped', !moving);
      }

      const faces = [[fw[1], st.discFrontX + k.discShift], [st.discRearX + k.discShift, st.plateFrontX + k.plateLift]];
      faces.forEach(([xa, xb], i) => {
        const f = ifaces[i], mid = (xa + xb) / 2, a0 = px(mid, ri), a1 = px(mid, ro);
        const open = api.state === 'open';
        for (const e of [f.band, f.l1, f.l2]) e.style.display = open ? 'block' : 'none';
        f.grip.style.display = open ? 'none' : 'block';
        if (open) {
          const pa = px(xa, Rm), pb = px(xb, Rm), gapPx = Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
          const dx = a1[0] - a0[0], dy = a1[1] - a0[1], len = Math.hypot(dx, dy) || 1;
          const h = Math.max(10, gapPx) / 2, nx = -dy / len * h, ny = dx / len * h;
          const A = [a0[0] + nx, a0[1] + ny], B = [a1[0] + nx, a1[1] + ny], C = [a1[0] - nx, a1[1] - ny], D = [a0[0] - nx, a0[1] - ny];
          f.band.setAttribute('points', [A, B, C, D].map(q => q.join(',')).join(' '));
          setLine(f.l1, A, B); setLine(f.l2, D, C);
        } else {
          const slip = api.state === 'slip';
          setLine(f.grip, a0, a1);
          f.grip.setAttribute('stroke', slip ? '#ff5a36' : '#fff27a');
          f.grip.setAttribute('stroke-width', slip ? 3 + 4 * cap : 7);
          f.grip.setAttribute('class', slip ? 'slip' : 'grip');
        }
      });

      const place = (t, x, rho, text, cls = '') => {
        const [X, Y] = px(x, rho);
        t.style.left = X + 'px'; t.style.top = Y + 'px'; t.textContent = text;
        t.className = 'linktag' + (cls ? ' ' + cls : '');
      };
      const rpmText = (label, rpm) => `${label} ${num(Math.round(rpm))} ${ui.rpm}`;
      place(tags.engine, fw[0] - 5, 150, rpmText(ui.clutchLink.engine, api.engineRpm));
      place(tags.shaft, wallX - 25, shafts.inputDiameter / 2 + 14, rpmText(ui.clutchLink.shaft, api.inputRpm));
      place(tags.state, st.discFrontX + disc.thickness / 2, disc.outerDiameter / 2 + 14, ui.clutchLink[api.state], api.state);
    },
  };
  return api;
}
