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
      const french = state.lang === 'fr';
      title.textContent = french ? 'Régions constitutives' : 'Constituent regions';
      note.textContent = french
        ? 'Union de régions sources. Surface lissée pour la lecture ; volume mesuré sur les voxels sources. Les petites régions sans surface restent accessibles en coupe.'
        : 'Union of source regions. Surface smoothed for readability; volume measured from source voxels. Small regions without a surface remain available on cuts.';
      list.replaceChildren();
      for (const id of region.constituent_regions) {
        const entry = catalog.get(id);
        if (!entry) throw new Error(`Missing learning constituent: ${id}`);
        const item = document.createElement('li');
        if (entry.region.kind === 'structure') {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = entry.label.name;
          button.addEventListener('click', () => onRegion(id));
          item.append(button);
        } else {
          item.textContent = `${entry.label.name} · ${french ? 'coupe' : 'cut only'}`;
        }
        list.append(item);
      }
    },
    dispose() { list.replaceChildren(); },
  };
}
