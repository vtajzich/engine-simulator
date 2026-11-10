import { chapters, glossary, simplifications, ui } from '../content/cs.js';
import { createDiagram, createCylinderTable } from '../diagrams.js';

const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

export function buildPanel(app, root) {
  root.replaceChildren();
  const head = h('div', 'p-head');
  head.appendChild(h('div', 'p-title', `<h1>${ui.appTitle}</h1><span>4T · 1998 cm³ · 5+R</span>`));
  const tabs = h('div', 'p-tabs');
  const tabDefs = [['chapters', ui.tabs.chapters], ['glossary', ui.tabs.glossary], ['simpl', ui.tabs.simplifications]];
  const tabBtns = tabDefs.map(([k, t]) => { const b = h('button', 'p-tab', t); b.type = 'button'; b.dataset.k = k; b.setAttribute('role', 'tab'); tabs.appendChild(b); return b; });
  head.appendChild(tabs);
  const body = h('div', 'p-body');
  root.append(head, body);

  let tab = 'chapters', diagram = null, extra = null;

  /* ---------- chapters */
  function renderChapter() {
    const ch = app.chapter ?? chapters[0], i = chapters.indexOf(ch);
    body.replaceChildren();
    const nav = h('div', 'chap-nav');
    chapters.forEach((c, k) => {
      const b = h('button', 'chap-pill', String(k + 1).padStart(2, '0')); b.type = 'button'; b.title = c.title;
      if (k === i) b.setAttribute('aria-current', 'true');
      b.addEventListener('click', () => app.setChapter(c.id));
      nav.appendChild(b);
    });
    const art = h('article', 'chapter');
    art.appendChild(h('div', 'kicker', `Kapitola ${String(i + 1).padStart(2, '0')} / ${chapters.length}`));
    art.appendChild(h('h2', '', ch.title));
    art.appendChild(h('div', 'prose', ch.html));
    const acts = h('div', 'actions');
    if (ch.setup) { const b = h('button', 'btn primary', ui.replay); b.type = 'button'; b.addEventListener('click', () => app.replayChapter()); acts.appendChild(b); }
    (ch.actions ?? []).forEach(a => { const b = h('button', 'btn', a.label); b.type = 'button'; b.addEventListener('click', () => a.run(app)); acts.appendChild(b); });
    if (acts.children.length) art.appendChild(acts);
    diagram = ch.diagram ? createDiagram(ch.diagram) : null;
    extra = ch.id === 'poradi' ? createCylinderTable() : null;
    if (diagram) art.appendChild(diagram.el);
    if (extra) art.appendChild(extra.el);
    const nt = h('div', 'notice', `<h3>${ui.notice}</h3>`);
    const ul = h('ul'); ch.notice.forEach(n => ul.appendChild(h('li', '', n))); nt.appendChild(ul);
    art.appendChild(nt);
    body.append(nav, art);
    const pager = h('div', 'pager');
    const prev = h('button', 'btn', '← ' + ui.prev), next = h('button', 'btn', ui.next + ' →');
    prev.type = next.type = 'button';
    prev.disabled = i === 0; next.disabled = i === chapters.length - 1;
    prev.style.opacity = prev.disabled ? .35 : 1; next.style.opacity = next.disabled ? .35 : 1;
    prev.addEventListener('click', () => app.setChapter(chapters[i - 1].id));
    next.addEventListener('click', () => app.setChapter(chapters[i + 1].id));
    pager.append(prev, next);
    body.appendChild(pager);
    body.scrollTop = 0;
  }

  /* ---------- glossary */
  function renderGlossary() {
    diagram = extra = null;
    body.replaceChildren();
    const wrap = h('div', 'gloss');
    const q = h('input'); q.type = 'search'; q.placeholder = ui.glossSearch; wrap.appendChild(q);
    const list = h('div');
    const entries = glossary.map(e => {
      const d = h('div', 'gentry', `<h5>${e.title}</h5><p>${e.text}</p>`);
      d.addEventListener('click', () => {
        const open = !d.classList.contains('open');
        list.querySelectorAll('.gentry.open').forEach(x => x.classList.remove('open'));
        d.classList.toggle('open', open);
        app.selectMatch(open ? e.match : null);
      });
      list.appendChild(d); return { e, d };
    });
    q.addEventListener('input', () => { const t = q.value.trim().toLowerCase(); entries.forEach(({ e, d }) => { d.style.display = !t || (e.title + ' ' + e.text).toLowerCase().includes(t) ? '' : 'none'; }); });
    wrap.appendChild(list); body.appendChild(wrap);
  }

  /* ---------- simplifications */
  function renderSimpl() {
    diagram = extra = null;
    body.replaceChildren();
    const w = h('div', 'simpl', '<h2>Zjednodušení modelu</h2>');
    w.appendChild(h('p', '', 'Model je mechanicky věrný v kinematice (úhly, zdvihy, převody, pořadí), ale několik věcí je záměrně zjednodušeno nebo odhadnuto:'));
    const ul = h('ul'); simplifications.forEach(s => ul.appendChild(h('li', '', s))); w.appendChild(ul);
    body.appendChild(w);
  }

  function show(k) {
    tab = k;
    tabBtns.forEach(b => b.setAttribute('aria-selected', String(b.dataset.k === k)));
    if (k !== 'glossary') app.selectMatch(null);
    ({ chapters: renderChapter, glossary: renderGlossary, simpl: renderSimpl })[k]();
  }
  tabBtns.forEach(b => b.addEventListener('click', () => show(b.dataset.k)));
  app.on('chapter', () => show('chapters'));
  let last = 0;
  app.on('tick', ctx => {
    if (tab !== 'chapters') return;
    const now = performance.now();
    if (now - last < 90) return;
    last = now;
    if (diagram) diagram.update(ctx);
    if (extra) extra.update(ctx);
  });
  show('chapters');
}
