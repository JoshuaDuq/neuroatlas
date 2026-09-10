const REASON_TEXT = {
  hemisphere: 'hemisphere hidden',
  'cortex-hidden': 'cortex off',
  isolated: 'isolated',
};

/**
 * Find a region: search, or browse the anatomy.
 *
 * A region that matches but is not currently on screen is shown dimmed with
 * the reason, never omitted. Silent absence is what makes a tool feel broken,
 * and with 547 regions it happens constantly.
 */
export function createNavigator({ catalog, atlases, onSelect, onToggleGroup, onQuery, onReveal, onAtlas }) {
  const search = document.getElementById('search');
  const results = document.getElementById('results');
  const tree = document.getElementById('tree');
  const notice = document.getElementById('rail-notice');
  let structureKey = null;

  const onInput = event => onQuery(event.target.value);
  search.addEventListener('input', onInput);

  function rowElement(row, { indent = false } = {}) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = indent ? 'row row-indent' : 'row';
    button.dataset.regionId = row.region.id;
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', 'false');

    const name = document.createElement('span');
    name.className = 'row-name';
    name.textContent = row.label.name;
    button.append(name);

    if (row.visible) {
      const side = document.createElement('span');
      side.className = 'row-side';
      side.textContent = row.region.hemisphere === 'midline'
        ? 'mid'
        : row.region.hemisphere.slice(0, 1).toUpperCase();
      button.append(side);
    } else {
      button.dataset.hidden = 'true';
      const reason = document.createElement('span');
      reason.className = 'row-reason';
      reason.textContent = REASON_TEXT[row.reason] ?? 'hidden';
      button.append(reason);
      button.title = `Hidden: ${REASON_TEXT[row.reason] ?? row.reason}`;
    }

    button.addEventListener('click', () => {
      if (row.visible) onSelect(row.region.id);
      else onReveal(row.reason, row.region.id);
    });
    return button;
  }

  function renderResults(state) {
    const found = catalog.search(state.query, state);
    const here = found.filter(row => row.reason !== 'other-atlas');
    const elsewhere = found.filter(row => row.reason === 'other-atlas');
    results.replaceChildren();

    for (const row of here) results.append(rowElement(row));

    if (!here.length) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = `No match for “${state.query}”.`;
      results.append(empty);
    }

    // Matches in the other parcellation are reported rather than dropped.
    if (elsewhere.length) {
      const other = atlases.find(atlas => atlas.id !== state.atlas);
      const line = document.createElement('p');
      line.className = 'empty';
      line.textContent = `${elsewhere.length} more in ${other.label}. `;
      const switchTo = document.createElement('button');
      switchTo.type = 'button';
      switchTo.textContent = `Switch atlas`;
      switchTo.addEventListener('click', () => onAtlas(other.id));
      line.append(switchTo);
      results.append(line);
    }
  }

  function renderTree(state) {
    tree.replaceChildren();
    let section = null;
    for (const group of catalog.groups(state)) {
      // Cortical lobes and subcortical systems are separate vocabularies, and
      // can share a name, so the tree says which is which.
      if (group.kind !== section) {
        section = group.kind;
        const heading = document.createElement('p');
        heading.className = 'section-label';
        heading.textContent = section === 'cortex' ? 'Cortex' : 'Subcortical';
        tree.append(heading);
      }
      const expanded = state.expanded.has(group.key);

      const header = document.createElement('button');
      header.type = 'button';
      header.className = 'row group-row';
      header.setAttribute('role', 'treeitem');
      header.setAttribute('aria-expanded', String(expanded));

      const marker = document.createElement('span');
      marker.className = 'disclosure';
      marker.textContent = expanded ? '▾' : '▸';
      const name = document.createElement('span');
      name.className = 'row-name';
      name.textContent = group.name;
      const count = document.createElement('span');
      count.className = 'group-count';
      count.textContent = String(group.rows.length);
      header.append(marker, name, count);
      header.addEventListener('click', () => onToggleGroup(group.key));
      tree.append(header);

      // Children are built only when open: 360 HCP areas need not exist as DOM.
      if (!expanded) continue;
      for (const row of group.rows) tree.append(rowElement(row, { indent: true }));
    }
  }

  function markSelection(state) {
    const id = state.selectedRegion?.id ?? null;
    for (const row of [...results.children, ...tree.children]) {
      if (!row.dataset?.regionId) continue;
      row.setAttribute('aria-selected', String(row.dataset.regionId === id));
    }
  }

  return {
    update(state) {
      const searching = state.query.trim().length > 0;
      results.hidden = !searching;
      tree.hidden = searching;
      search.setAttribute('aria-expanded', String(searching));
      if (document.activeElement !== search) search.value = state.query;

      // Rebuild only when the structure could have changed, not on every tick.
      const key = [
        state.atlas, state.hemisphere, state.cortexVisible, state.cortexOpacity > 0,
        state.isolatedRegion, state.query, [...state.expanded].sort().join(),
      ].join('|');
      if (key !== structureKey) {
        structureKey = key;
        if (searching) renderResults(state);
        else renderTree(state);
      }
      markSelection(state);

      notice.hidden = !state.notice;
      notice.textContent = state.notice ?? '';
    },

    focusSearch() { search.focus(); search.select(); },

    /** Arrow keys move focus; Enter selects. Selecting on focus would flood a screen reader. */
    moveFocus(delta) {
      const rows = [...(results.hidden ? tree : results).querySelectorAll('.row')];
      if (!rows.length) return;
      const index = rows.indexOf(document.activeElement);
      rows[Math.max(0, Math.min(rows.length - 1, index + delta))].focus();
    },

    dispose() {
      search.removeEventListener('input', onInput);
      results.replaceChildren();
      tree.replaceChildren();
    },
  };
}
