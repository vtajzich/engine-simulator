import { ui } from '../content/cs.js';

const T = ui.toolbar;
const group = (label, ...kids) => {
  const g = document.createElement('div'); g.className = 'tb-group';
  if (label) { const l = document.createElement('span'); l.className = 'tb-label'; l.textContent = label; g.appendChild(l); }
  kids.forEach(k => g.appendChild(k)); return g;
};
const btn = (text, onClick, cls = '') => {
  const b = document.createElement('button'); b.className = 'tb-btn ' + cls; b.textContent = text; b.type = 'button';
  b.addEventListener('click', onClick); return b;
};

export function buildToolbar(app, host) {
  const bar = document.createElement('div'); bar.id = 'toolbar'; host.appendChild(bar);

  const hs = ['ghost', 'cut', 'solid', 'hidden'].map(m => { const b = btn(T[m], () => app.setHousing(m)); b.dataset.mode = m; return b; });
  bar.appendChild(group(T.housing, ...hs));

  const gs = [['engine', T.engine], ['clutch', T.clutch], ['gearbox', T.gearbox]].map(([k, t]) => { const b = btn(t, () => app.setGroup(k, !app.groupVisible[k])); b.dataset.g = k; return b; });
  bar.appendChild(group(T.show, ...gs));

  const gas = btn(T.gas, () => app.setGas(!app.gasOn), 'blue');
  const flow = btn(T.flow, () => app.setFlowOn(!app.highlight.flowOn));
  const lab = btn(T.labels, () => app.setLabelsOn(!app.labels.on));
  bar.appendChild(group(T.overlays, gas, flow, lab));

  const views = [['overview', T.viewOverview], ['engine', T.viewEngine], ['clutch', T.viewClutch], ['gearbox', T.viewGearbox]].map(([k, t]) => btn(t, () => app.flyTo(k, 1)));
  bar.appendChild(group(T.view, ...views));

  const toggle = document.createElement('button');
  toggle.id = 'panel-toggle'; toggle.type = 'button'; toggle.title = 'Panel';
  toggle.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 3l5 5-5 5"/></svg>';
  toggle.style.transform = 'none';
  toggle.addEventListener('click', () => { document.getElementById('app').classList.toggle('collapsed'); });
  host.appendChild(toggle);

  const sync = () => {
    hs.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === app.housing.mode)));
    gs.forEach(b => b.setAttribute('aria-pressed', String(app.groupVisible[b.dataset.g] !== false)));
    gas.setAttribute('aria-pressed', String(app.gasOn !== false));
    flow.setAttribute('aria-pressed', String(app.highlight.flowOn));
    lab.setAttribute('aria-pressed', String(app.labels.on));
  };
  app.on('housing', sync); app.on('overlays', sync); app.on('chapter', sync);
  sync();
}
