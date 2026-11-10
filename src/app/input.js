// Keyboard: W/↑ throttle, Space clutch, S/↓ brake (held, smoothly ramped); 1–5, R, N/0 gear lever.
export function createInput(app) {
  const held = { throttle: false, clutchPedal: false, brake: false };
  const owned = { throttle: false, clutchPedal: false, brake: false };
  const RATE = { throttle: [2.2, 4], clutchPedal: [7, 5], brake: [4, 6] };   // [up, down] per second
  const MAP = { w: 'throttle', arrowup: 'throttle', ' ': 'clutchPedal', s: 'brake', arrowdown: 'brake' };
  const GEAR = { 1: '1', 2: '2', 3: '3', 4: '4', 5: '5', r: 'R', n: 'N', 0: 'N' };
  const typing = t => t && (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && t.type !== 'range' && t.type !== 'checkbox'));

  window.addEventListener('keydown', ev => {
    if (ev.ctrlKey || ev.metaKey || ev.altKey || typing(ev.target)) return;
    const k = ev.key.toLowerCase();
    if (MAP[k]) {
      ev.preventDefault();
      const n = MAP[k]; held[n] = true; owned[n] = true; return;
    }
    if (k in GEAR && !ev.repeat) { ev.preventDefault(); app.requestGear(GEAR[k]); }
  });
  window.addEventListener('keyup', ev => { const n = MAP[ev.key.toLowerCase()]; if (n) held[n] = false; });
  window.addEventListener('blur', () => { for (const n in held) held[n] = false; });

  return {
    release(name) { owned[name] = false; },      // slider took over
    update(dt) {
      let changed = false;
      for (const n of Object.keys(held)) {
        if (!owned[n]) continue;
        const v = app.user[n], [up, down] = RATE[n];
        const nv = held[n] ? Math.min(1, v + up * dt) : Math.max(0, v - down * dt);
        if (nv !== v) { app.user[n] = nv; changed = true; }
        if (!held[n] && nv === 0) owned[n] = false;
      }
      return changed;
    },
  };
}
