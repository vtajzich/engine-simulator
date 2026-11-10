// Single import point for text. Behaviour (camera, setup, actions' run, views, legend colours …) lives in cs.js;
// English overlays only the text fields from en.chapterText.
import * as cs from './cs.js';
import * as en from './en.js';
import { lang } from '../i18n.js';

const isEn = lang === 'en';

function localize(c) {
  const t = en.chapterText[c.id];
  if (!t) return c;
  const out = { ...c, title: t.title, html: t.html, notice: t.notice };
  if (c.legend) out.legend = c.legend.map(([col], i) => [col, t.legend[i]]);
  if (c.actions) out.actions = c.actions.map((a, i) => ({ ...a, label: t.actions[i] }));
  if (c.views) out.views = c.views.map(v => ({ ...v, label: t.views[v.id] ?? v.label }));
  return out;
}

export { lang };
export const ui = isEn ? en.ui : cs.ui;
export const chapters = isEn ? cs.chapters.map(localize) : cs.chapters;
export const glossary = isEn ? en.glossary : cs.glossary;
export const simplifications = isEn ? en.simplifications : cs.simplifications;

/** Name of a part for display. Accepts the part group (userData.part inside) or the part record itself. */
export function partLabel(part) {
  const cz = part?.userData?.part?.label ?? part?.label ?? '';
  return isEn ? en.partLabels[cz] ?? cz : cz;
}

/** Locale number formatting: decimal comma (cs) or point (en); a true minus sign; tiny values print as 0. */
export function num(v, d = 0) {
  let s = (Math.abs(v) < 0.5 * 10 ** -d ? 0 : v).toFixed(d);
  if (!isEn) s = s.replace('.', ',');
  return s.replace('-', '−');
}
