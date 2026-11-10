# Task I1 — CZ/EN language switch (`src/app/**`, `index.html`, `verify/visual.mjs`)

The user asked for a language switch: Czech (default) and English. The English text already exists in
`src/app/content/en.js` (written to mirror `src/app/content/cs.js` key for key — read its header and exports:
`ui`, `chapterText`, `glossary`, `simplifications`, `partLabels`, `extra`). Your job is the wiring.
You own `index.html`, `src/app/**`, `verify/visual.mjs`. Do not touch sim/model/kin/tests. Do not commit/stage.
Another agent is finishing a change in `src/sim/*` (a `clutchGuard` input handled inside `driver.update`); if the app
builds simulator inputs anywhere outside `driver.update`, leave that code as it is and mention it in your report.

## Design
- `src/app/i18n.js`: `lang` = `'cs' | 'en'`, read once at module load from (in priority order) the URL query
  `?lang=en|cs`, then `localStorage['engine-gearshift.lang']`, else `'cs'`. `setLang(l)` stores it and reloads the
  page (a reload is acceptable and simplest: modules bind their text at import time). Also set
  `document.documentElement.lang`.
- `src/app/content/index.js`: the single import point for text. It imports `cs.js` and `en.js` and exports, for the
  active language: `ui`, `chapters`, `glossary`, `simplifications`, `partLabel(part)`, `num()`.
  - `chapters` for English = the Czech chapter objects (which carry the behaviour: camera, setup, actions' `run`,
    views, legend colours…) with their text fields overlaid from `en.chapterText[id]`: `title`, `html`, `notice`,
    legend label texts, action labels, view labels. Never duplicate behaviour in en.js.
  - `partLabel(part)`: Czech → `part.userData.part.label`; English → `en.partLabels[thatCzechLabel] ?? thatCzechLabel`.
    Use it everywhere a part name is shown (3D labels, hover tooltip, part card, glossary matches, power-flow list).
  - Replace every `import … from './content/cs.js'` in the app with the index module.
- Route every hard-coded Czech string listed in `en.extra` (diagrams.js captions/legends/axis labels/table headers,
  panel.js, partcard.js, dock.js `mezerník` / `ot/min`, gapmarks.js "mezera", main.js loading/error text,
  index.html title/description/loading text) through the language tables: add the needed keys to BOTH `cs.js` and
  `en.js` `ui` (you may edit both content files for this; keep them key-for-key identical) and use them.
- Number formatting: Czech uses a decimal comma, English a decimal point. Provide one `num(value, digits)` /
  locale-aware formatter in the content index and use it wherever the app formats numbers for display (`fmt()` in
  diagrams.js, dock readouts, gap marks, ratio table, live values). Units: `ot/min` ↔ `rpm`.
- The switch itself: a compact two-state control "CZ | EN" in the top-right of the side panel header (next to the
  title), keyboard accessible, the active language highlighted; clicking the other one calls `setLang`.
  After the reload the app returns to the same chapter (store the current chapter id in `sessionStorage` before
  reloading and restore it).
- Keys pressed for driving (W, S, Space, 1–5, R, N) are unchanged in both languages.

## Verification (`verify/visual.mjs`)
- Parity check in Node (at the top of the script or a small helper it imports): `en.ui` has exactly the same nested
  key set as `cs.ui`; every chapter id has `chapterText`; `notice`/legend/action/view counts match; glossary and
  simplifications lengths match.
- Browser, `?lang=en`: load, wait ready, visit every chapter; collect ALL visible text of the page
  (`document.body.innerText`, plus 3D label texts, plus the hover tooltip and the part card for three picked parts,
  plus toasts triggered by a gear engagement and a stall) and fail if any character from
  `áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ` appears or if any of these Czech words appears as a whole word: `Motor běží`,
  `Spojka`, `Převodovka`, `Kapitola`, `ot/min`, `mezera`, `Stupeň`. Save screenshots `60-en-prehled.png`,
  `61-en-ctyri-doby.png`, `62-en-spojka.png`, `63-en-synchron.png`.
- Browser, default (no parameter, cleared storage): language is Czech, the existing "Czech text rendered" check passes.
- Real click on the "EN" control → page reloads in English on the same chapter; click "CZ" → back to Czech.
- All existing checks keep passing in Czech at 1440×900 and `VIEWPORT=1280x720` — EXCEPT the two clutch-pumping
  checks (a/b, "reversals") if the simulator fix has not landed yet: run the suite, and if only those fail, report it
  (look for `clutchGuard` in `src/sim/sim.js` to see whether it has landed, and re-run once more before finishing).

Final message (≤ 250 words): what you changed, how the switch works, verification results, any English text you
had to add or correct in en.js/cs.js (list keys), and remaining gaps.
