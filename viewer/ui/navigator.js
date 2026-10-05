import { count } from './format.js';
import { atlasSwitchLabel, t } from '../i18n/translations.js';
import { createVisibilityControl, syncVisibilityControl } from './visibility-control.js';

/**
 * What a key does on a focused tree row (WAI-ARIA tree pattern). A leaf has
 * no children, so Right steps into its eye control; V hides or shows the row.
 */
export function treeKeyAction(key, { group, expanded }) {
  switch (key) {
    case 'ArrowDown': return 'next';
    case 'ArrowUp': return 'previous';
    case 'Home': return 'first';
    case 'End': return 'last';
    case 'Enter': case ' ': return 'activate';
    case 'v': case 'V': return 'visibility';
    case 'ArrowRight': return !group ? 'controls' : expanded ? 'child' : 'expand';
    case 'ArrowLeft': return !group ? 'parent' : expanded ? 'collapse' : null;
    default: return null;
  }
}

/** What a key does on one of a row's eye controls; Enter and Space stay native. */
export function controlKeyAction(key, { first, last }) {
  switch (key) {
    case 'ArrowRight': return last ? null : 'nextControl';
    case 'ArrowLeft': return first ? 'row' : 'previousControl';
    case 'Escape': return 'row';
    case 'ArrowDown': return 'next';
    case 'ArrowUp': return 'previous';
    case 'Home': return 'first';
    case 'End': return 'last';
    default: return null;
  }
}

/**
 * The next row an arrow key can arm.
 *
 * Disabled rows explain themselves and do nothing, so the key moves past
 * them. Past the ends of the list the armed row stays where it is.
 */
export function nextEnabledIndex(disabled, index, delta) {
  const count = disabled.length;
  if (!count || !delta) return index;
  for (let step = 1; step <= count; step += 1) {
    const next = index + delta * step;
    if (next < 0 || next >= count) return index;
    if (!disabled[next]) return next;
  }
  return index;
}

/** The vocabulary a region's group name comes from. */
export function vocabularyOf(region) {
  if (region.kind === 'structure' || region.kind === 'tissue-region') return 'system';
  return region.atlas === 'hcp-mmp' ? 'network' : 'lobe';
}

/** Group names that two vocabularies use at once, such as a Limbic lobe beside the Limbic system. */
export function sharedGroupNames(groups) {
  const vocabularies = new Map();
  for (const group of groups) {
    const vocabulary = vocabularyOf(group.rows[0].region);
    vocabularies.set(group.name, (vocabularies.get(group.name) ?? new Set()).add(vocabulary));
  }
  return new Set([...vocabularies].filter(([, used]) => used.size > 1).map(([name]) => name));
}

/** A shared name says which vocabulary it is from; any other name is shown as the atlas gives it. */
export function groupDisplayName(name, region, shared, lang) {
  return shared.has(name) ? t(lang, 'navigator').groupIn[vocabularyOf(region)](name) : name;
}

/** Groups with their shown names, alphabetical by that name within each family, families kept in order. */
export function labelledGroups(groups, lang) {
  const shared = sharedGroupNames(groups);
  const families = [...new Set(groups.map(group => group.kind))];
  return groups
    .map(group => ({ group, label: groupDisplayName(group.name, group.rows[0].region, shared, lang) }))
    .sort((a, b) => families.indexOf(a.group.kind) - families.indexOf(b.group.kind)
      || a.label.localeCompare(b.label, lang));
}

/** Reasons that mean "in a different atlas" rather than "hidden here". */
const OTHER_ATLAS = new Set(['other-atlas', 'other-cut-atlas']);
/** Reasons no control can undo: the row explains, and activating it does nothing. */
const UNREVEALABLE = new Set(['below-cut-resolution']);
const EXPAND_ICON = 'm7 15 5 5 5-5M7 9l5-5 5 5';
const COLLAPSE_ICON = 'm7 20 5-5 5 5M7 4l5 5 5-5';

/**
 * Find a region: search, or browse the anatomy.
 *
 * Two established patterns rather than one improvised one. Search is a
 * combobox: focus stays in the field and aria-activedescendant points at the
 * active option, so typing is never interrupted. The browse tree is a tree:
 * focus moves between items, arrows open and close, and Enter selects. It is
 * one Tab stop; the eye controls on a row are reached with the arrows.
 * Selecting on focus would announce once per keypress while arrowing through
 * 360 areas.
 *
 * A region that matches but is not on screen is shown dimmed with the reason
 * and an action that reveals it. Silent absence is what makes a tool feel
 * broken.
 */
function highlightMatch(text, query) {
  if (!query) {
    const span = document.createElement('span');
    span.textContent = text;
    return span;
  }
  const normText = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const normQuery = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const idx = normText.indexOf(normQuery);
  const container = document.createDocumentFragment();
  if (idx === -1) {
    container.append(document.createTextNode(text));
    return container;
  }
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + query.length);
  const after = text.slice(idx + query.length);
  if (before) container.append(document.createTextNode(before));
  const mark = document.createElement('mark');
  mark.className = 'query-match';
  mark.textContent = match;
  container.append(mark);
  if (after) container.append(document.createTextNode(after));
  return container;
}

export function createNavigator({
  catalog, atlases, cutAtlases, onSelect, onToggleGroup, onToggleAllGroups, onQuery,
  onReveal, onAtlas, onCutAtlas, onHideRegions, onShowRegions,
}) {
  const search = document.getElementById('search');
  const searchClear = document.getElementById('search-clear');
  const treeHeader = document.getElementById('tree-header');
  const treeToggleAll = document.getElementById('tree-toggle-all');
  const results = document.getElementById('results');
  const notes = document.getElementById('results-notes');
  const tree = document.getElementById('tree');
  const announcer = document.getElementById('announcer');
  const notice = document.getElementById('rail-notice');
  const searchLabel = document.getElementById('search-label');
  const navRail = document.getElementById('navigator');
  const title = document.getElementById('navigator-title');
  let structureKey = null;
  let hiddenKey = null;
  let activeIndex = -1;
  let lastScrolledRegionId = null;
  let roving = null;
  let announceTimer = null;
  let announced = null;

  const options = () => [...results.querySelectorAll('[role="option"]')];
  const treeItems = () => [...tree.querySelectorAll('[role="treeitem"]')];
  const controlsOf = item => [...item.querySelectorAll(
    ':scope > .visibility-control, :scope > .row-eyes > .visibility-control')];

  /** The tree is one Tab stop: the row last focused. */
  function setRoving(item) {
    if (roving && roving !== item) roving.tabIndex = -1;
    item.tabIndex = 0;
    roving = item;
  }

  function focusItem(item) {
    if (!item) return;
    setRoving(item);
    item.focus();
  }

  /** Ways to find a focused row or control again once the tree is rebuilt, nearest first. */
  function focusSelectors(element) {
    if (!element || !tree.contains(element)) return [];
    const row = element.closest('[role="treeitem"]');
    const parent = row?.closest('.tree-group')?.querySelector(':scope > .group-row');
    const selectors = [];
    if (element.dataset.visibilityKey) {
      selectors.push(`[data-visibility-key="${CSS.escape(element.dataset.visibilityKey)}"]`);
    }
    if (row?.dataset.regionId) {
      selectors.push(`[role="treeitem"][data-region-id="${CSS.escape(row.dataset.regionId)}"]`);
    }
    for (const group of [row, parent]) {
      if (group?.dataset.groupKey) selectors.push(`[data-group-key="${CSS.escape(group.dataset.groupKey)}"]`);
    }
    return selectors;
  }

  const findFirst = selectors => selectors.map(selector => tree.querySelector(selector)).find(Boolean) ?? null;

  /** Spoken once typing pauses, and only when it says something new. */
  function announce(text) {
    clearTimeout(announceTimer);
    if (text === announced) return;
    announceTimer = setTimeout(() => {
      announced = text;
      if (announcer) announcer.textContent = text;
    }, 500);
  }

  function activate(row) {
    const hidden = row.dataset.visible !== 'true';
    if (hidden && UNREVEALABLE.has(row.dataset.reason)) return;
    // A chosen hit belongs in the tree, beside its neighbours. Leaving the
    // query up would keep the result list in front of that place.
    if (search.value) {
      search.value = '';
      onQuery('');
    }
    if (hidden) onReveal(row.dataset.reason, row.dataset.regionId);
    else onSelect(row.dataset.regionId);
  }

  function buildRow(row, { role, level, lang, query, hiddenRegions, shared }) {
    const i18n = t(lang, 'navigator');
    const reasons = t(lang, 'reasons');
    const sideGlyphs = t(lang, 'sides').glyphs;
    const sideWords = t(lang, 'sides').words;

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
    // The alias is why a row matched when the name itself does not contain
    // the query. It stays outside .row-name and follows the last word, so
    // the match is still there when the name wraps.
    let matchedAlias = null;
    if (role === 'option' && query) {
      name.append(highlightMatch(row.label.name, query));
      const normQuery = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const normName = row.label.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      if (!normName.includes(normQuery)) {
        if (row.label.code) {
          const normCode = row.label.code.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
          if (normCode.includes(normQuery)) matchedAlias = row.label.code;
        }
        if (!matchedAlias && row.label.aliases) {
          for (const a of row.label.aliases) {
            const normA = a.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            if (normA.includes(normQuery)) {
              matchedAlias = a;
              break;
            }
          }
        }
      }
    } else {
      name.textContent = row.label.name;
    }
    if (role === 'option') {
      const nameBlock = document.createElement('span');
      nameBlock.className = 'row-title';
      nameBlock.append(name);
      if (matchedAlias) {
        const aliasSpan = document.createElement('span');
        aliasSpan.className = 'row-alias';
        aliasSpan.append('(');
        aliasSpan.append(highlightMatch(matchedAlias, query));
        aliasSpan.append(')');
        nameBlock.append(aliasSpan);
      }
      item.append(nameBlock);
    } else {
      item.append(name);
    }

    const side = sideWords[row.region.hemisphere] ?? row.region.hemisphere;
    const heard = matchedAlias ? `${row.label.name}, ${matchedAlias}` : row.label.name;
    const eye = role === 'treeitem' && !UNREVEALABLE.has(row.reason);
    const tail = document.createElement('span');
    if (row.visible) {
      tail.className = 'row-side';
      tail.textContent = sideGlyphs[row.region.hemisphere] ?? '';
      // The glyph is "L"; the name says "left". Laterality is never a glyph alone,
      // and it is what distinguishes two otherwise identical rows. Search has no
      // parent group, so the lobe or system is named on the row itself.
      const place = role === 'option' ? groupDisplayName(row.label.group, row.region, shared, lang) : '';
      item.setAttribute('aria-label', place
        ? `${heard}, ${side}, ${place}`
        : `${heard}, ${side}`);
      if (place) {
        const group = document.createElement('span');
        group.className = 'row-group';
        group.textContent = place;
        item.append(group);
      }
    } else {
      item.dataset.hidden = 'true';
      item.dataset.reason = row.reason;
      if (role === 'option') {
        const sideMarker = document.createElement('span');
        sideMarker.className = 'row-side';
        sideMarker.textContent = sideGlyphs[row.region.hemisphere];
        item.append(sideMarker);
      }
      tail.className = 'row-reason';
      tail.textContent = row.reason === 'other-detail'
        ? reasons.inDetailSet(atlasSwitchLabel(row.region.atlas, lang))
        : reasons[row.reason] ?? reasons.fallback;
      // Spoken as part of the row, so the state is never colour-only.
      if (UNREVEALABLE.has(row.reason)) {
        item.setAttribute('aria-disabled', 'true');
        item.setAttribute('aria-label', i18n.rowUnavailableAria(heard, side, tail.textContent));
      } else {
        item.setAttribute('aria-label', i18n.rowHiddenAria(heard, side, tail.textContent));
      }
      // The reason is a status word. The label says the click will bring it back.
      item.title = item.getAttribute('aria-label');
    }
    // A shown row's letter stands alone at rest; on a fine pointer its eye, which repeats it, lies over it.
    if (eye && row.visible) tail.classList.add('row-side-rest');
    item.append(tail);
    if (role === 'treeitem' && !eye) {
      const sideMarker = document.createElement('span');
      sideMarker.className = 'row-side row-side-solo';
      sideMarker.textContent = sideGlyphs[row.region.hemisphere] ?? '';
      item.append(sideMarker);
    }
    if (eye) {
      item.append(createVisibilityControl({
        key: `region:${row.region.id}`,
        ids: [row.region.id], name: row.label.name, hiddenRegions,
        side: row.region.hemisphere, lang, onHide: onHideRegions, onShow: onShowRegions,
      }));
    }
    item.addEventListener('click', () => activate(item));
    return item;
  }

  function renderResults(state) {
    const i18n = t(state.lang, 'navigator');
    const atlasDict = t(state.lang, 'atlases');
    const found = catalog.search(state.query, state);
    // A row hidden by an atlas mismatch is not absent, it is elsewhere — and the
    // two kinds are separated because switching a surface atlas and switching
    // the cut labels are different controls.
    const here = found.rows.filter(row => !OTHER_ATLAS.has(row.reason));
    const elsewhere = found.rows.filter(row => row.reason === 'other-atlas');
    const elsewhereCut = found.rows.filter(row => row.reason === 'other-cut-atlas');
    const capped = found.total - found.rows.length;
    results.replaceChildren();
    notes.replaceChildren();
    activeIndex = -1;
    search.removeAttribute('aria-activedescendant');

    const shared = sharedGroupNames(catalog.groups(state));
    for (const row of here) {
      results.append(buildRow(row, { role: 'option', lang: state.lang, query: state.query.trim(), shared }));
    }

    // A listbox holds only options, so the sentences sit after it and are also spoken.
    const spoken = here.length && capped <= 0 ? [`${count(here.length, 'match', state.lang)}.`] : [];
    const note = (text, action, onAction) => {
      const line = document.createElement('p');
      line.className = 'empty';
      line.textContent = text;
      spoken.push(text.trim());
      if (action) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = action;
        button.addEventListener('click', onAction);
        line.append(button);
      }
      notes.append(line);
    };

    if (!here.length) {
      const heading = document.createElement('p');
      heading.className = 'empty-title';
      heading.textContent = i18n.noMatch(state.query.trim());
      notes.append(heading);
      spoken.push(`${heading.textContent}.`);
      // Matches in another atlas are the next step when there are any.
      if (!found.rows.length) note(i18n.noMatchHint);
    }
    if (capped > 0) note(i18n.showingCapped(here.length, count(found.total, 'match', state.lang)));

    // Matches in the other parcellation are reported, not dropped.
    if (elsewhere.length) {
      const other = atlases.find(atlas => atlas.id !== state.atlas);
      const otherLabel = atlasDict[other?.id] ?? other?.label ?? '';
      note(i18n.matchesInOther(count(elsewhere.length, 'match', state.lang), otherLabel),
        i18n.switchAtlas, () => onAtlas(other.id));
    }

    if (elsewhereCut.length) {
      const other = cutAtlases.find(atlas => atlas.id !== state.cutAtlas);
      const otherLabel = atlasDict[other?.id] ?? other?.label ?? '';
      note(i18n.matchesInOtherCut(count(elsewhereCut.length, 'match', state.lang), otherLabel),
        i18n.switchCutAtlas, () => onCutAtlas(other.id));
    }
    announce(spoken.join(' '));

    // Enter chooses this row. Arming it on the first keystroke means the
    // reader does not have to press Down before the search will act.
    const choices = options();
    const index = choices.findIndex(option => option.getAttribute('aria-disabled') !== 'true');
    if (index >= 0) {
      activeIndex = index;
      choices[index].dataset.active = 'true';
      choices[index].scrollIntoView({ block: 'start' });
      search.setAttribute('aria-activedescendant', choices[index].id);
    }
  }

  function renderTree(state) {
    const i18n = t(state.lang, 'navigator');
    const focused = focusSelectors(document.activeElement);
    const tabStop = focusSelectors(roving);
    tree.replaceChildren();
    roving = null;
    let section = null;
    let sectionGroup = tree;
    for (const { group, label } of labelledGroups(catalog.groups(state), state.lang)) {
      // Lobes and systems are separate vocabularies and can share a name, so
      // the tree says which is which. The heading names a group rather than
      // sitting in the tree as a stray paragraph.
      if (group.kind !== section) {
        section = group.kind;
        const heading = document.createElement('p');
        heading.className = 'section-label';
        heading.id = `tree-section-${section}`;
        heading.setAttribute('aria-hidden', 'true');
        heading.textContent = section === 'cortex' ? i18n.cortex
          : section === 'tissue' ? i18n.cutOnly
          : i18n.subcortical;
        sectionGroup = document.createElement('div');
        sectionGroup.setAttribute('role', 'group');
        sectionGroup.setAttribute('aria-labelledby', heading.id);
        tree.append(heading, sectionGroup);
      }

      const expanded = state.expanded.has(group.key);
      const groupBlock = document.createElement('div');
      groupBlock.className = 'tree-group';
      const header = document.createElement('div');
      header.className = 'row group-row';
      header.setAttribute('role', 'treeitem');
      header.setAttribute('aria-expanded', String(expanded));
      header.setAttribute('aria-level', '1');
      header.tabIndex = -1;
      header.dataset.groupKey = group.key;

      const marker = document.createElement('span');
      marker.className = 'disclosure';
      marker.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" '
        + 'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" '
        + 'stroke-linejoin="round"><path d="m9 6 6 6-6 6" /></svg>';
      marker.setAttribute('aria-hidden', 'true');
      const name = document.createElement('span');
      name.className = 'row-name';
      name.textContent = label;
      const badge = document.createElement('span');
      badge.className = 'group-count';
      badge.textContent = String(group.rows.length);
      // Inside the name, so a wrapped name keeps its count after the last word.
      name.append(badge);
      header.append(marker, name);
      // On a fine pointer the eyes overlay the row end (components.css), so the name keeps the row.
      const eyes = document.createElement('span');
      eyes.className = 'row-eyes';
      for (const side of ['midline', 'left', 'right']) {
        const ids = group.rows.filter(row => row.region.hemisphere === side &&
          !UNREVEALABLE.has(row.reason)).map(row => row.region.id);
        if (!ids.length) continue;
        eyes.append(createVisibilityControl({
          key: `group:${group.key}:${side}`,
          ids, name: label, hiddenRegions: state.hiddenRegions,
          side, lang: state.lang, onHide: onHideRegions, onShow: onShowRegions,
        }));
      }
      if (eyes.childElementCount) header.append(eyes);
      header.setAttribute('aria-label', `${label}, ${count(group.rows.length, 'region', state.lang)}`);
      header.addEventListener('click', () => onToggleGroup(group.key));
      groupBlock.append(header);
      sectionGroup.append(groupBlock);

      if (!expanded) continue;
      // Children exist only while open: 360 areas need not all be DOM.
      const children = document.createElement('div');
      children.setAttribute('role', 'group');
      for (const row of group.rows) {
        children.append(buildRow(row, {
          role: 'treeitem', level: 2, lang: state.lang, hiddenRegions: state.hiddenRegions,
        }));
      }
      groupBlock.append(children);
    }
    const stop = findFirst(tabStop) ?? treeItems()[0];
    if (stop) setRoving(stop);
    findFirst(focused)?.focus();
  }

  /** Only hidden parts changed: update the rows that did, and keep the rest of the tree. */
  function patchTree(state) {
    const focused = focusSelectors(document.activeElement);
    const rows = new Map(catalog.groups(state).flatMap(group => group.rows)
      .map(row => [row.region.id, row]));
    for (const control of tree.querySelectorAll('.group-row > .row-eyes > .visibility-control')) {
      syncVisibilityControl(control, state.hiddenRegions);
    }
    for (const item of tree.querySelectorAll('[role="treeitem"][data-region-id]')) {
      const row = rows.get(item.dataset.regionId);
      if (!row) continue;
      if (item.dataset.visible === String(row.visible)
          && (item.dataset.reason ?? null) === (row.visible ? null : row.reason)) {
        const control = item.querySelector(':scope > .visibility-control');
        if (control) syncVisibilityControl(control, state.hiddenRegions);
        continue;
      }
      const next = buildRow(row, {
        role: 'treeitem', level: 2, lang: state.lang, hiddenRegions: state.hiddenRegions,
      });
      next.tabIndex = item.tabIndex;
      if (roving === item) roving = next;
      item.replaceWith(next);
    }
    if (!tree.contains(document.activeElement)) findFirst(focused)?.focus();
  }

  function markSelection(state) {
    const id = state.selectedRegion?.id ?? null;
    let selectedItem = null;
    for (const item of [...options(), ...treeItems()]) {
      if (!item.dataset.regionId) continue;
      const selected = item.dataset.regionId === id;
      item.dataset.selected = String(selected);
      if (item.getAttribute('role') === 'option') {
        item.setAttribute('aria-selected', String(selected));
      } else {
        item.setAttribute('aria-current', selected ? 'true' : 'false');
      }
      if (selected) selectedItem = item;
    }
    if (id && id !== lastScrolledRegionId && selectedItem) {
      lastScrolledRegionId = id;
      selectedItem.scrollIntoView({ block: 'nearest' });
    } else if (!id) {
      lastScrolledRegionId = null;
    }
  }

  /** Combobox: the field keeps focus, the active option is pointed at. */
  function moveActiveOption(delta) {
    const list = options();
    if (!list.length) return;
    const next = nextEnabledIndex(
      list.map(option => option.getAttribute('aria-disabled') === 'true'),
      activeIndex,
      delta,
    );
    if (next === activeIndex) return;
    for (const option of list) delete option.dataset.active;
    activeIndex = next;
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
    focusItem(items[Math.max(0, Math.min(items.length - 1, index + delta))]);
  }

  const onTreeKey = event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const item = event.target.closest('[role="treeitem"]');
    if (!item) return;
    const control = event.target.closest('.visibility-control');
    const eyes = controlsOf(item);
    let action;
    if (control) {
      const at = eyes.indexOf(control);
      action = controlKeyAction(event.key, { first: at === 0, last: at === eyes.length - 1 });
      if (action === 'nextControl' || action === 'previousControl') {
        event.preventDefault();
        eyes[at + (action === 'nextControl' ? 1 : -1)].focus();
        return;
      }
    } else {
      action = treeKeyAction(event.key, {
        group: Boolean(item.dataset.groupKey),
        expanded: item.getAttribute('aria-expanded') === 'true',
      });
    }
    if (!action) return;
    event.preventDefault();
    const items = treeItems();
    const index = items.indexOf(item);
    const block = item.closest('.tree-group');
    switch (action) {
      case 'next': return focusItem(items[Math.min(index + 1, items.length - 1)]);
      case 'previous': return focusItem(items[Math.max(index - 1, 0)]);
      case 'first': return focusItem(items[0]);
      case 'last': return focusItem(items.at(-1));
      case 'row': return focusItem(item);
      case 'child': return focusItem(block?.querySelector(':scope > [role="group"] > [role="treeitem"]'));
      case 'parent': return focusItem(block?.querySelector(':scope > .group-row'));
      case 'controls': return eyes[0]?.focus();
      // A row with one eye toggles it; a group with one per side goes to them to choose.
      case 'visibility': return eyes.length === 1 ? eyes[0].click() : eyes[0]?.focus();
      default: return item.click();
    }
  };
  const onTreeFocus = event => {
    const item = event.target.closest('[role="treeitem"]');
    if (item) setRoving(item);
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
  const onClearSearch = () => {
    search.value = '';
    if (searchClear) searchClear.hidden = true;
    onQuery('');
    search.focus();
  };
  const onToggleAll = () => onToggleAllGroups?.();
  search.addEventListener('input', onInput);
  search.addEventListener('keydown', onSearchKey);
  searchClear?.addEventListener('click', onClearSearch);
  treeToggleAll?.addEventListener('click', onToggleAll);
  tree.addEventListener('keydown', onTreeKey);
  tree.addEventListener('focusin', onTreeFocus);

  return {
    update(state) {
      const i18n = t(state.lang, 'navigator');
      title.textContent = i18n.title;
      const searching = state.query.trim().length > 0;
      results.hidden = !searching;
      notes.hidden = !searching;
      if (!searching) {
        clearTimeout(announceTimer);
        announced = null;
      }
      tree.hidden = searching;
      if (treeHeader) treeHeader.hidden = searching;
      if (treeToggleAll && !searching) {
        const groups = catalog.groups(state);
        const allExpanded = groups.length > 0 && groups.every(g => state.expanded.has(g.key));
        const label = allExpanded ? i18n.collapseAll : i18n.expandAll;
        treeToggleAll.setAttribute('aria-label', label);
        treeToggleAll.title = label;
        treeToggleAll.querySelector('path').setAttribute('d', allExpanded ? COLLAPSE_ICON : EXPAND_ICON);
      }
      if (searchClear) {
        searchClear.hidden = !searching;
        searchClear.setAttribute('aria-label', i18n.clearSearch);
      }
      search.setAttribute('aria-expanded', String(searching));
      search.placeholder = i18n.searchPlaceholder;
      if (searchLabel) searchLabel.textContent = i18n.searchPlaceholder;
      if (navRail) navRail.setAttribute('aria-label', i18n.findRegion);
      results.setAttribute('aria-label', i18n.searchResults);
      tree.setAttribute('aria-label', i18n.browseAnatomy);
      if (document.activeElement !== search) search.value = state.query;

      // Rebuild only when the structure could have changed.
      const key = [
        state.atlas, state.detail, state.cutAtlas, state.cutActive, state.lang, state.hemisphere,
        state.cortexVisible, state.cortexOpacity > 0, state.internalVisible,
        state.isolatedRegion, state.internalSystem, state.query, [...state.expanded].sort().join(),
      ].join('|');
      const hidden = [...state.hiddenRegions].sort().join();
      if (key !== structureKey || (searching && hidden !== hiddenKey)) {
        if (searching) renderResults(state);
        else renderTree(state);
      } else if (hidden !== hiddenKey) {
        patchTree(state);
      }
      structureKey = key;
      hiddenKey = hidden;
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
      searchClear?.removeEventListener('click', onClearSearch);
      treeToggleAll?.removeEventListener('click', onToggleAll);
      tree.removeEventListener('keydown', onTreeKey);
      tree.removeEventListener('focusin', onTreeFocus);
      clearTimeout(announceTimer);
      results.replaceChildren();
      notes.replaceChildren();
      tree.replaceChildren();
    },
  };
}
