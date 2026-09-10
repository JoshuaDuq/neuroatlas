const REASON_TEXT = {
  hemisphere: 'hemisphere hidden',
  'cortex-hidden': 'cortex off',
  isolated: 'isolated',
};

const SIDE = { left: 'L', right: 'R', midline: 'mid' };
const SIDE_WORD = { left: 'left', right: 'right', midline: 'midline' };

/**
 * Find a region: search, or browse the anatomy.
 *
 * Two established patterns rather than one improvised one. Search is a
 * combobox: focus stays in the field and aria-activedescendant points at the
 * active option, so typing is never interrupted. The browse tree is a tree:
 * focus moves between items, arrows open and close, and Enter selects.
 * Selecting on focus would announce once per keypress while arrowing through
 * 360 areas.
 *
 * A region that matches but is not on screen is shown dimmed with the reason
 * and an action that reveals it. Silent absence is what makes a tool feel
 * broken.
 */
export function createNavigator({
  catalog, atlases, onSelect, onToggleGroup, onQuery, onReveal, onAtlas,
}) {
  const search = document.getElementById('search');
  const results = document.getElementById('results');
  const tree = document.getElementById('tree');
  const notice = document.getElementById('rail-notice');
  let structureKey = null;
  let activeIndex = -1;

  const options = () => [...results.querySelectorAll('[role="option"]')];
  const treeItems = () => [...tree.querySelectorAll('[role="treeitem"]')];

  function activate(row) {
    if (row.dataset.visible === 'true') onSelect(row.dataset.regionId);
    else onReveal(row.dataset.reason, row.dataset.regionId);
  }

  function buildRow(row, { role, level }) {
    const item = document.createElement('div');
    item.id = `row-${role}-${row.region.id}`.replaceAll(':', '-');
    item.className = role === 'treeitem' ? 'row row-indent' : 'row';
    item.setAttribute('role', role);
    item.tabIndex = -1;
    item.dataset.regionId = row.region.id;
    item.dataset.visible = String(row.visible);
    if (level) item.setAttribute('aria-level', String(level));
    if (role === 'option') item.setAttribute('aria-selected', 'false');

    const name = document.createElement('span');
    name.className = 'row-name';
    name.textContent = row.label.name;
    item.append(name);

    const side = SIDE_WORD[row.region.hemisphere] ?? row.region.hemisphere;
    const tail = document.createElement('span');
    if (row.visible) {
      tail.className = 'row-side';
      tail.textContent = SIDE[row.region.hemisphere] ?? '';
      // The glyph is "L"; the name says "left". Laterality is never a glyph alone,
      // and it is what distinguishes two otherwise identical rows.
      item.setAttribute('aria-label', `${row.label.name}, ${side}`);
    } else {
      item.dataset.hidden = 'true';
      item.dataset.reason = row.reason;
      tail.className = 'row-reason';
      tail.textContent = REASON_TEXT[row.reason] ?? 'hidden';
      // Spoken as part of the row, so the state is never colour-only.
      item.setAttribute('aria-label',
        `${row.label.name}, ${side}, hidden: ${tail.textContent}. Activate to reveal.`);
    }
    item.append(tail);
    item.addEventListener('click', () => activate(item));
    return item;
  }

  function renderResults(state) {
    const found = catalog.search(state.query, state);
    const here = found.filter(row => row.reason !== 'other-atlas');
    const elsewhere = found.filter(row => row.reason === 'other-atlas');
    results.replaceChildren();
    activeIndex = -1;
    search.removeAttribute('aria-activedescendant');

    for (const row of here) results.append(buildRow(row, { role: 'option' }));

    if (!here.length) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = `No match for “${state.query}”.`;
      results.append(empty);
    }

    // Matches in the other parcellation are reported, not dropped.
    if (elsewhere.length) {
      const other = atlases.find(atlas => atlas.id !== state.atlas);
      const line = document.createElement('p');
      line.className = 'empty';
      line.textContent = `${elsewhere.length} more in ${other.label}. `;
      const switchTo = document.createElement('button');
      switchTo.type = 'button';
      switchTo.textContent = 'Switch atlas';
      switchTo.addEventListener('click', () => onAtlas(other.id));
      line.append(switchTo);
      results.append(line);
    }
  }

  function renderTree(state) {
    tree.replaceChildren();
    let section = null;
    for (const group of catalog.groups(state)) {
      // Lobes and systems are separate vocabularies and can share a name, so
      // the tree says which is which.
      if (group.kind !== section) {
        section = group.kind;
        const heading = document.createElement('p');
        heading.className = 'section-label';
        heading.textContent = section === 'cortex' ? 'Cortex' : 'Subcortical';
        tree.append(heading);
      }

      const expanded = state.expanded.has(group.key);
      const header = document.createElement('div');
      header.className = 'row group-row';
      header.setAttribute('role', 'treeitem');
      header.setAttribute('aria-expanded', String(expanded));
      header.setAttribute('aria-level', '1');
      header.tabIndex = -1;
      header.dataset.groupKey = group.key;

      const marker = document.createElement('span');
      marker.className = 'disclosure';
      marker.textContent = expanded ? '▾' : '▸';
      marker.setAttribute('aria-hidden', 'true');
      const name = document.createElement('span');
      name.className = 'row-name';
      name.textContent = group.name;
      const count = document.createElement('span');
      count.className = 'group-count';
      count.textContent = String(group.rows.length);
      header.append(marker, name, count);
      header.setAttribute('aria-label', `${group.name}, ${group.rows.length} regions`);
      header.addEventListener('click', () => onToggleGroup(group.key));
      tree.append(header);

      if (!expanded) continue;
      // Children exist only while open: 360 areas need not all be DOM.
      const children = document.createElement('div');
      children.setAttribute('role', 'group');
      for (const row of group.rows) {
        children.append(buildRow(row, { role: 'treeitem', level: 2 }));
      }
      tree.append(children);
    }
    const first = treeItems()[0];
    if (first) first.tabIndex = 0;
  }

  function markSelection(state) {
    const id = state.selectedRegion?.id ?? null;
    for (const item of [...options(), ...treeItems()]) {
      if (!item.dataset.regionId) continue;
      const selected = item.dataset.regionId === id;
      item.dataset.selected = String(selected);
      if (item.getAttribute('role') === 'option') {
        item.setAttribute('aria-selected', String(selected));
      } else {
        item.setAttribute('aria-current', selected ? 'true' : 'false');
      }
    }
  }

  /** Combobox: the field keeps focus, the active option is pointed at. */
  function moveActiveOption(delta) {
    const list = options();
    if (!list.length) return;
    for (const option of list) delete option.dataset.active;
    activeIndex = Math.max(0, Math.min(list.length - 1, activeIndex + delta));
    const active = list[activeIndex];
    active.dataset.active = 'true';
    active.scrollIntoView({ block: 'nearest' });
    search.setAttribute('aria-activedescendant', active.id);
  }

  /** Tree: focus itself moves, so the reader hears one item per keypress. */
  function moveTreeFocus(delta) {
    const items = treeItems();
    if (!items.length) return;
    const index = items.indexOf(document.activeElement);
    const next = items[Math.max(0, Math.min(items.length - 1, index + delta))];
    for (const item of items) item.tabIndex = -1;
    next.tabIndex = 0;
    next.focus();
  }

  const onTreeKey = event => {
    const item = event.target.closest('[role="treeitem"]');
    if (!item) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveTreeFocus(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      item.click();
    } else if (event.key === 'ArrowRight' && item.dataset.groupKey) {
      if (item.getAttribute('aria-expanded') === 'false') item.click();
    } else if (event.key === 'ArrowLeft' && item.dataset.groupKey) {
      if (item.getAttribute('aria-expanded') === 'true') item.click();
    }
  };

  const onSearchKey = event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveActiveOption(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Enter') {
      const active = options()[activeIndex];
      if (active) {
        event.preventDefault();
        activate(active);
      }
    }
  };

  const onInput = event => onQuery(event.target.value);
  search.addEventListener('input', onInput);
  search.addEventListener('keydown', onSearchKey);
  tree.addEventListener('keydown', onTreeKey);

  return {
    update(state) {
      const searching = state.query.trim().length > 0;
      results.hidden = !searching;
      tree.hidden = searching;
      search.setAttribute('aria-expanded', String(searching));
      if (document.activeElement !== search) search.value = state.query;

      // Rebuild only when the structure could have changed.
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

    moveFocus(delta) {
      if (results.hidden) moveTreeFocus(delta);
      else moveActiveOption(delta);
    },

    dispose() {
      search.removeEventListener('input', onInput);
      search.removeEventListener('keydown', onSearchKey);
      tree.removeEventListener('keydown', onTreeKey);
      results.replaceChildren();
      tree.replaceChildren();
    },
  };
}
