import { glossary, ui } from '../content/cs.js';

export function findEntry(part) {
  if (!part) return null;
  return glossary.find(e => e.match.some(m => part.id.startsWith(m)))
    ?? glossary.find(e => e.match.some(m => (part.body ?? '').startsWith(m) && m !== 'crank')) ?? null;
}

export function buildPartCard(app, host) {
  const card = document.createElement('div');
  card.id = 'partcard';
  host.appendChild(card);
  card.addEventListener('click', e => { if (e.target.classList.contains('x')) app.selectPart(null); });
  app.on('select', part => {
    if (!part) { card.style.display = 'none'; return; }
    const e = findEntry(part);
    card.innerHTML = `<button class="x" aria-label="${ui.partCardClose}">×</button><h4>${part.label}</h4>` +
      `<div class="pid">${part.id}${part.body && part.body !== part.id ? ' · těleso ' + part.body : ''}</div>` +
      `<p>${e ? e.text : 'Pro tuto součást zatím není popis.'}</p>`;
    card.style.display = 'block';
  });
}
