import { atlasSwitchLabel, t } from '../../i18n/translations.js';

function element(tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

/** Trace a learning unit to its original atlas regions. */
export function createConstituents({ catalog, onRegion }) {
  const panel = document.getElementById('region-constituents');
  const title = document.getElementById('constituents-title');
  const note = document.getElementById('constituents-note');
  const list = document.getElementById('constituents-list');
  let key = null;
  return {
    update(state) {
      const region = state.selectedRegion;
      panel.hidden = !region?.constituent_regions;
      if (panel.hidden) { key = null; return; }
      const nextKey = `${region.id}:${state.lang}`;
      if (key === nextKey) return;
      key = nextKey;
      const i18n = t(state.lang, 'inspector');
      const sides = t(state.lang, 'sides');
      title.replaceChildren(i18n.constituentsHeading,
        element('span', String(region.constituent_regions.length), 'disclosure-count'));
      note.textContent = i18n.constituentsNote;
      const entries = region.constituent_regions.map(id => {
        const entry = catalog.get(id);
        if (!entry) throw new Error(`Missing learning constituent: ${id}`);
        return { id, ...entry };
      });
      // A midline union holds a left and a right part of one name; only their sides tell them apart.
      const sided = new Set(entries.map(entry => entry.region.hemisphere)).size > 1;
      list.replaceChildren(...entries.map(({ id, region: part, label }) => {
        const item = document.createElement('li');
        const named = part.kind === 'structure'
          ? element('button', label.name)
          : element('span', label.name);
        if (part.kind === 'structure') {
          named.type = 'button';
          named.addEventListener('click', () => onRegion(id));
          if (sided) named.setAttribute('aria-label', `${label.name}, ${sides.words[part.hemisphere]}`);
        }
        // Opening a constituent switches Internal anatomy to the set that holds it.
        const set = part.kind === 'structure' ? atlasSwitchLabel(part.atlas, state.lang) : i18n.constituentCutOnly;
        item.append(named, element('span', set, 'constituent-set'));
        if (sided) item.append(element('span', sides.glyphs[part.hemisphere], 'row-side'));
        return item;
      }));
    },
    dispose() { list.replaceChildren(); },
  };
}
