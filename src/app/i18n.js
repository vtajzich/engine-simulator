// Language selection: ?lang=en|cs (this page load only) > localStorage > Czech. Read once at module load.
const KEY = 'engine-gearshift.lang';
export const CHAPTER_KEY = 'engine-gearshift.chapter';
const valid = l => (l === 'en' || l === 'cs' ? l : null);

function detect() {
  try { const q = valid(new URLSearchParams(location.search).get('lang')); if (q) return q; } catch { /* no location */ }
  try { const s = valid(localStorage.getItem(KEY)); if (s) return s; } catch { /* storage blocked */ }
  return 'cs';
}

export const lang = detect();
if (typeof document !== 'undefined') document.documentElement.lang = lang;

/** Stores the choice and reloads (modules bind their text at import time). The query override is dropped so it cannot win. */
export function setLang(l) {
  if (!valid(l) || l === lang) return;
  try { localStorage.setItem(KEY, l); } catch { /* storage blocked */ }
  const u = new URL(location.href);
  u.searchParams.delete('lang');
  location.replace(u);
}
