import { atlasSwitchLabel, t } from '../i18n/translations.js';

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
      const count = document.createElement('span');
      count.className = 'disclosure-count';
      count.textContent = String(region.constituent_regions.length);
      title.replaceChildren(i18n.constituentsHeading, ' ', count);
      note.textContent = i18n.constituentsNote;
      list.replaceChildren();
      for (const id of region.constituent_regions) {
        const entry = catalog.get(id);
        if (!entry) throw new Error(`Missing learning constituent: ${id}`);
        const item = document.createElement('li');
        const tail = document.createElement('span');
        tail.className = 'constituent-set';
        if (entry.region.kind === 'structure') {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = entry.label.name;
          button.addEventListener('click', () => onRegion(id));
          // Opening a constituent switches Internal anatomy to the set that holds it.
          tail.textContent = atlasSwitchLabel(entry.region.atlas, state.lang);
          item.append(button, tail);
        } else {
          const name = document.createElement('span');
          name.textContent = entry.label.name;
          tail.textContent = i18n.constituentCutOnly;
          item.append(name, tail);
        }
        list.append(item);
      }
    },
    dispose() { list.replaceChildren(); },
  };
}
