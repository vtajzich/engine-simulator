import * as THREE from 'three';
import { partLabel } from './content/index.js';

const NS = 'http://www.w3.org/2000/svg';
const box = new THREE.Box3(), mbox = new THREE.Box3(), inv = new THREE.Matrix4(), rel = new THREE.Matrix4();
// Bodies that spin about their own local X axis: the anchor is projected onto that axis so it cannot drift with the angle.
const SPINNERS = /^(crank|camIn|camEx|inputShaft|counterShaft|mainShaft|gear[1235]|idlerR|sleeve.*|ring.*|clutchDisc|pressurePlate)$/;

/** Bounding box of a part in its OWN (rotating) frame: the anchor derived from it does not depend on the current angle. */
function localBox(part, out) {
  part.updateWorldMatrix(true, true);
  inv.copy(part.matrixWorld).invert();
  out.makeEmpty();
  part.traverse(m => {
    if (!m.isMesh || m.isInstancedMesh || !m.visible || m.userData.noCollide || !m.geometry) return;
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    mbox.copy(m.geometry.boundingBox).applyMatrix4(rel.multiplyMatrices(inv, m.matrixWorld));
    out.union(mbox);
  });
  return out;
}

/** DOM labels with leader lines. Spec per label: 'partId' or { id, a: 'c'|'t'|'b', dx, dy } (a = anchor on the part's box, dx/dy = pixel offset). */
export function createLabels({ index, scene, host }) {
  const layer = document.createElement('div');
  layer.id = 'labels';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;overflow:visible');
  layer.appendChild(svg);
  host.appendChild(layer);
  let items = [], on = false;
  const v = new THREE.Vector3();

  function set(specs) {
    layer.querySelectorAll('.lbl').forEach(e => e.remove());
    svg.replaceChildren();
    items = [];
    const list = (specs ?? []).map(s => (typeof s === 'string' ? { id: s } : s));
    list.forEach((s, i) => {
      const part = index.parts.get(s.id);
      if (!part) return;
      const el = document.createElement('div');
      el.className = 'lbl';
      el.textContent = partLabel(part);
      layer.appendChild(el);
      const line = document.createElementNS(NS, 'line'); line.setAttribute('stroke', '#ff9e2c'); line.setAttribute('stroke-opacity', '.8');
      const dot = document.createElementNS(NS, 'circle'); dot.setAttribute('r', '2.5'); dot.setAttribute('fill', '#ff9e2c');
      svg.append(line, dot);
      const n = list.length;
      items.push({
        part, el, line, dot, a: s.a ?? 'c', anchor: new THREE.Vector3(), ok: false, local: new THREE.Vector3(), halfY: 0, spin: SPINNERS.test(part.userData.part.body ?? '') || SPINNERS.test(s.id),
        dx: s.dx ?? 34, dy: s.dy ?? (i - (n - 1) / 2) * 24,
      });
    });
  }
  function update() {
    layer.style.display = on ? 'block' : 'none';
    if (!on) return;
    const w = host.clientWidth, h = host.clientHeight;
    const hr = host.getBoundingClientRect();
    let topMin = 6;
    const tb = host.querySelector('#toolbar');
    if (tb) for (const c of tb.children) topMin = Math.max(topMin, c.getBoundingClientRect().bottom - hr.top + 10);
    for (const it of items) {
      if (!it.ok) {                    // once per label (retried only while the part has no geometry yet)
        localBox(it.part, box);
        it.ok = !box.isEmpty();
        if (it.ok) { box.getCenter(it.local); it.halfY = (box.max.y - box.min.y) / 2; if (it.spin) it.local.set(it.local.x, 0, 0); }
      }
      if (it.ok) {
        it.anchor.copy(it.local).applyMatrix4(it.part.matrixWorld);
        if (it.a === 't') it.anchor.y += it.halfY; else if (it.a === 'b') it.anchor.y -= it.halfY;   // along WORLD Y, not rotated with the part
      }
      let show = it.ok && it.part.visible;
      if (show) { v.copy(it.anchor).project(scene.camera); show = v.z < 1 && v.z > -1; }
      const disp = show ? '' : 'none';
      it.el.style.display = disp; it.line.style.display = disp; it.dot.style.display = disp;
      if (!show) continue;
      const ax = (v.x * 0.5 + 0.5) * w, ay = (-v.y * 0.5 + 0.5) * h, bw = it.el.offsetWidth;
      const lx = it.dx >= 0 ? Math.min(Math.max(ax + it.dx, 4), w - bw - 4) : Math.max(Math.min(ax + it.dx, w - 4), bw + 4);
      const ly = Math.min(Math.max(ay + it.dy, topMin), h - 14);
      it.el.style.left = lx + 'px'; it.el.style.top = ly + 'px';
      it.el.style.transform = it.dx >= 0 ? 'translate(0,-50%)' : 'translate(-100%,-50%)';
      it.line.setAttribute('x1', ax); it.line.setAttribute('y1', ay); it.line.setAttribute('x2', lx); it.line.setAttribute('y2', ly);
      it.dot.setAttribute('cx', ax); it.dot.setAttribute('cy', ay);
    }
  }
  return { set, update, ids: () => items.map(it => it.part.userData.part.id), setOn(b) { on = b; update(); }, get on() { return on; } };
}
