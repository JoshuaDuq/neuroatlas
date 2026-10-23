import { atlasSwitchLabel, t } from '../../i18n/translations.js';
import { requiredAtlas } from '../../state/scene-commands.js';
import { percent } from '../format.js';
import { createProvenance } from '../panels/provenance.js';
import { bindRoving } from '../roving.js';

/** The Colour field's groups, in order; the last choices stand on their own. */
const COLOUR_GROUPS = [
  ['appearance', ['tissue', 'mri']],
  ['parcellation', ['atlas']],
  ['networks', ['network', 'cab-np']],
  [null, ['functional', 'domains']],
];

// The label is also kept as data-label, which the masthead's CSS uses to hold the bold width.
const setLabel = (button, text) => {
  button.textContent = text;
  button.dataset.label = text;
};

// Written on every render; only a change touches the DOM.
const setText = (node, text) => {
  if (node.textContent !== text) node.textContent = text;
};

/** A field's one-line note, printed in the summary popover. */
function setNote(note, text) {
  setText(note, text);
  note.hidden = !text;
}

/** The published title without its quotation marks: "SNAIL subj_1", dataset and subject together. */
export function subjectName(entry) {
  const name = String(entry?.display_name ?? '').replace(/[“”"]/g, '').replace(/\s+/g, ' ').trim();
  return name || entry?.subject || entry?.id || '';
}

/** What the collapsed masthead names, part by part: subject, atlas, colouring, internal anatomy, or the tract reference alone. */
export function dataSummary({ subject, atlas, colour, detail, reference }) {
  if (reference) return [{ part: 'subject', text: reference }];
  return Object.entries({ subject, atlas, colour, detail })
    .filter(([, text]) => text)
    .map(([part, text]) => ({ part, text }));
}

/** The Colour field's optgroups, offering only the colourings this build publishes. */
export function colourGroups({ networks, cabNp, functionalRegions, domains }) {
  const published = {
    network: Boolean(networks), 'cab-np': Boolean(cabNp), functional: Boolean(functionalRegions), domains: Boolean(domains),
  };
  return COLOUR_GROUPS
    .map(([group, modes]) => [group, modes.filter(mode => published[mode] ?? true)])
    .filter(([, modes]) => modes.length);
}

/** A Colour option names the atlas it switches to when it is defined on another atlas's areas. */
export function colourOption(lang, mode, { atlas, required }) {
  const name = t(lang, 'display').surfaceColors[mode];
  return required && required !== atlas ? t(lang, 'header').atlasBecomes(name, atlasSwitchLabel(required, lang)) : name;
}

/** An Atlas option names the colouring it drops when the one shown is defined on another atlas. */
export function atlasOption(lang, id, required) {
  const name = atlasSwitchLabel(id, lang);
  return required && required !== id
    ? t(lang, 'header').colourBecomes(name, t(lang, 'display').surfaceColors.atlas) : name;
}

/** How far a download has come, or that it has started. */
export function loadingText(lang, progress) {
  const i18n = t(lang, 'header');
  return progress?.total ? i18n.loadingProgress(percent(progress.loaded / progress.total, lang)) : i18n.loading;
}

/** The status bar's statement, then what is loaded, named as the masthead names it; alone until something is. */
export function colophonParts(lang, { anatomy, reference } = {}) {
  const copy = t(lang, 'footer');
  const description = reference ? copy.referenceColophon(reference.label)
    : anatomy ? copy.colophon(subjectName(anatomy), anatomy.individual) : '';
  return { description, statement: copy.statementAlone };
}

export function paintColophon(lang, loaded) {
  const { description, statement } = colophonParts(lang, loaded);
  document.getElementById('colophon-description').textContent = description;
  document.getElementById('colophon-statement').textContent = statement;
}

/**
 * The masthead's actions and ⋯ settings menu, and the skip link. None of them waits on the
 * anatomy, so they are wired while it loads; Full screen and Save image wait until it is drawn.
 */
export function createSettings({ modelView, onTheme, onLang, onSingleKeys }) {
  const moreButton = document.getElementById('masthead-more');
  const menu = document.getElementById('masthead-menu');
  const menuFullscreen = document.getElementById('menu-fullscreen');
  const fullscreenButton = document.getElementById('viewport-fullscreen');
  const snapshotButton = document.getElementById('viewport-snapshot');
  const skipLink = document.getElementById('skip-to-model');
  const langContainer = document.getElementById('lang-switch');
  const langLabel = document.getElementById('lang-label');
  const themeContainer = document.getElementById('theme-switch');
  const themeLabel = document.getElementById('theme-label');
  const singleKeysContainer = document.getElementById('single-keys-switch');
  const singleKeysLabel = document.getElementById('single-keys-label');
  const shortcutsButton = document.getElementById('shortcuts-open');
  const shortcutsLabel = document.getElementById('shortcuts-label');
  const langButtons = [...langContainer.querySelectorAll('[data-lang]')];
  const themeButtons = [...themeContainer.querySelectorAll('[data-theme-option]')];
  const singleKeyButtons = [...singleKeysContainer.querySelectorAll('[data-single-keys]')];

  const open = () => !menu.hidden;
  function setOpen(next) {
    menu.hidden = !next;
    moreButton.setAttribute('aria-expanded', String(next));
  }

  const onMore = event => {
    event.stopPropagation();
    menu.toggleAttribute('data-instant', event.detail === 0);
    setOpen(!open());
  };
  // A setting chosen from the menu has been applied; leaving it open hides the anatomy it changed.
  const onMenuClick = event => {
    if (!event.target.closest('button')) return;
    setOpen(false);
    moreButton.focus();
  };
  const onDocumentPointer = event => {
    if (open() && !menu.contains(event.target) && !moreButton.contains(event.target)) setOpen(false);
  };
  // Tabbing out of the menu closes it, as it does the data popover.
  const onFocusOut = event => {
    const next = event.relatedTarget;
    if (open() && next && !menu.contains(next) && next !== moreButton) setOpen(false);
  };
  // Marked handled: the app's own Escape would otherwise go on to clear the selection.
  const onEscape = event => {
    if (event.key !== 'Escape' || !open()) return;
    event.preventDefault();
    setOpen(false);
    moreButton.focus();
  };
  const onMenuKeyDown = event => {
    // Segmented choices handle their own arrows; ordinary items must not move the anatomy tree.
    if (!event.defaultPrevented && ['ArrowUp', 'ArrowDown'].includes(event.key)
      && event.target.matches('button')) event.preventDefault();
  };
  const onLangClick = event => {
    const button = event.target.closest('[data-lang]');
    if (button && button.getAttribute('aria-pressed') !== 'true') onLang(button.dataset.lang);
  };
  const onThemeClick = event => {
    const button = event.target.closest('[data-theme-option]');
    if (button && button.getAttribute('aria-pressed') !== 'true') onTheme(button.dataset.themeOption);
  };
  const onSingleKeysClick = event => {
    const button = event.target.closest('[data-single-keys]');
    if (button) onSingleKeys(button.dataset.singleKeys === 'on');
  };
  // One masthead popover at a time, however the other was opened.
  const onDataToggle = () => setOpen(false);
  const onMenuFullscreen = () => fullscreenButton.click();
  const onSkip = event => {
    event.preventDefault();
    modelView.focus({ focusVisible: true });
  };

  const listeners = [
    [moreButton, 'click', onMore],
    [moreButton, 'focusout', onFocusOut],
    [menu, 'click', onMenuClick],
    [menu, 'keydown', onMenuKeyDown],
    [menu, 'focusout', onFocusOut],
    [langContainer, 'click', onLangClick],
    [themeContainer, 'click', onThemeClick],
    [singleKeysContainer, 'click', onSingleKeysClick],
    [menuFullscreen, 'click', onMenuFullscreen],
    [document.getElementById('masthead-data-toggle'), 'click', onDataToggle],
    [skipLink, 'click', onSkip],
    [document, 'pointerdown', onDocumentPointer],
    [document, 'keydown', onEscape],
  ];
  for (const [target, type, listener] of listeners) target.addEventListener(type, listener);
  // Each exclusive choice is one Tab stop; arrows move inside it.
  const rovingGroups = [langContainer, themeContainer, singleKeysContainer].map(group => bindRoving(group));
  moreButton.hidden = false;
  skipLink.hidden = false;
  menuFullscreen.hidden = !document.fullscreenEnabled;
  setOpen(false);

  return {
    update({ lang, status }, { singleKeys, themeChoice }) {
      const i18n = t(lang, 'header');
      const viewport = t(lang, 'viewport');
      const ready = status === 'ready' || status === 'switching';
      skipLink.textContent = i18n.skipToModel;
      for (const [button, label] of [[fullscreenButton, viewport.fullscreen], [snapshotButton, viewport.snapshot],
        [moreButton, t(lang, 'menu').more]]) {
        button.setAttribute('aria-label', label);
        button.dataset.tooltip = label;
      }
      fullscreenButton.disabled = !ready;
      snapshotButton.disabled = !ready;
      menuFullscreen.textContent = viewport.fullscreen;
      menuFullscreen.disabled = !ready;

      langLabel.textContent = i18n.languageSwitch;
      for (const button of langButtons) {
        setLabel(button, button.dataset.lang.toUpperCase());
        button.setAttribute('aria-pressed', String(button.dataset.lang === lang));
      }
      themeLabel.textContent = i18n.theme;
      const themeNames = { system: i18n.systemTheme, light: i18n.lightTheme, dark: i18n.darkTheme };
      for (const button of themeButtons) {
        const option = button.dataset.themeOption;
        setLabel(button, themeNames[option]);
        if (option === 'system') button.dataset.tooltip = i18n.systemThemeNote;
        button.setAttribute('aria-pressed', String(option === themeChoice));
      }
      singleKeysLabel.textContent = i18n.singleKeys;
      for (const button of singleKeyButtons) {
        const on = button.dataset.singleKeys === 'on';
        setLabel(button, on ? i18n.singleKeysOn : i18n.singleKeysOff);
        button.setAttribute('aria-pressed', String(on === singleKeys));
      }
      shortcutsLabel.textContent = i18n.shortcuts;
      shortcutsButton.setAttribute('aria-label', i18n.shortcuts);
      for (const group of rovingGroups) group.sync();
    },
    dispose() {
      for (const [target, type, listener] of listeners) target.removeEventListener(type, listener);
      for (const group of rovingGroups) group.dispose();
      setOpen(false);
      moreButton.hidden = true;
    },
  };
}

/**
 * The masthead's data: subject, atlas, colour and internal anatomy as four native selects,
 * a bar where it fits and a popover behind a summary where it does not; and the status bar.
 */
export function createHeader({
  atlases, networks, cabNp, functionalRegions, domains, detailLevels, anatomy, anatomies = [], manifest, manifestUrl, indexUrl,
  onAtlas, onSurfaceColor, onDetail, onAnatomy,
}) {
  const regionCount = document.getElementById('region-count');
  const masthead = document.getElementById('masthead');
  const dataWrap = document.getElementById('masthead-data-wrap');
  const dataToggle = document.getElementById('masthead-data-toggle');
  const dataSummaryNode = document.getElementById('masthead-data-summary');
  const data = document.getElementById('masthead-data');
  const studyName = document.getElementById('study-name');
  const surfaceField = document.getElementById('surface-field');
  const labels = {
    subject: document.getElementById('subject-label'),
    atlas: document.getElementById('atlas-label'),
    colour: document.getElementById('surface-label'),
    detail: document.getElementById('detail-label'),
  };
  const selects = {
    subject: document.getElementById('anatomy-switch'),
    atlas: document.getElementById('atlas-switch'),
    colour: document.getElementById('surface-switch'),
    detail: document.getElementById('detail'),
  };
  const notes = {
    subject: document.getElementById('subject-note'),
    atlas: document.getElementById('atlas-note'),
    colour: document.getElementById('surface-note'),
    detail: document.getElementById('detail-note'),
  };
  const fallbackDetail = detailLevels[0]?.id ?? null;
  const required = colour => requiredAtlas({ cabNp, functionalRegions, domains }, colour);

  const option = value => {
    const node = document.createElement('option');
    node.value = value;
    return node;
  };
  // A dropdown only when there is a choice; one published brain is a name, not a control.
  const offerAnatomies = anatomies.length > 1;
  if (offerAnatomies) {
    selects.subject.append(...anatomies.map(entry => {
      const node = option(entry.id);
      node.textContent = subjectName(entry);
      return node;
    }));
    selects.subject.value = anatomy.id;
  }
  selects.atlas.append(...atlases.map(atlas => option(atlas.id)));
  const optgroups = [];
  for (const [group, modes] of colourGroups({ networks, cabNp, functionalRegions, domains })) {
    const options = modes.map(option);
    if (!group) {
      selects.colour.append(...options);
      continue;
    }
    const optgroup = document.createElement('optgroup');
    optgroup.dataset.group = group;
    optgroup.append(...options);
    optgroups.push(optgroup);
    selects.colour.append(optgroup);
  }
  // A build without the optional fine level offers one choice, and so no control.
  const offersDetail = detailLevels.length > 1;
  selects.detail.append(...detailLevels.map(level => option(level.id)));
  selects.detail.hidden = !offersDetail;
  labels.detail.hidden = !offersDetail;

  // What the reader just chose in a field, held in its select while it downloads.
  const chosen = { atlas: null, colour: null, detail: null };
  const choose = (field, handler) => event => {
    chosen[field] = event.target.value;
    handler(event.target.value);
  };
  const changes = [
    [selects.atlas, choose('atlas', onAtlas)],
    [selects.colour, choose('colour', onSurfaceColor)],
    [selects.detail, choose('detail', onDetail)],
    ...(offerAnatomies ? [[selects.subject, event => onAnatomy(event.target.value)]] : []),
  ];
  for (const [select, listener] of changes) select.addEventListener('change', listener);

  const shortLandscape = globalThis.matchMedia?.('(max-height: 480px) and (orientation: landscape)');
  const collapsed = () => masthead.hasAttribute('data-collapsed');
  const dataOpen = () => dataToggle.getAttribute('aria-expanded') === 'true';
  function setDataOpen(open) {
    dataToggle.setAttribute('aria-expanded', String(open));
    data.toggleAttribute('data-open', open);
  }
  // Each field's note is its control's tooltip on the bar. The popover prints the notes, so there a tooltip would say each twice.
  let tips = [];
  function showTips() {
    const printed = collapsed() && !masthead.hasAttribute('data-reference');
    for (const [node, text] of tips) {
      if (text && !printed) node.dataset.tooltip = text;
      else delete node.dataset.tooltip;
    }
  }
  // Measured rather than a breakpoint: subject names, French labels and loading progress change the bar's width.
  function fitBar() {
    masthead.removeAttribute('data-collapsed');
    const fits = !shortLandscape?.matches
      && data.scrollWidth <= dataWrap.clientWidth
      && masthead.scrollWidth <= masthead.clientWidth;
    masthead.toggleAttribute('data-collapsed', !fits);
    if (fits) setDataOpen(false);
    else if (data.contains(document.activeElement)) {
      // A resize or translated label must not hide the control the reader is using.
      data.toggleAttribute('data-instant', true);
      setDataOpen(true);
    }
    showTips();
  }
  // Keep the subject complete: internal anatomy and colouring drop before the atlas.
  // Only a subject that still does not fit on its own truncates.
  function fitSummary() {
    dataSummaryNode.removeAttribute('data-short');
    const subject = dataSummaryNode.querySelector('[data-part="subject"]');
    if (!collapsed() || !subject) return;
    const tooShort = () => subject.clientWidth < subject.scrollWidth;
    const dropped = [];
    for (const part of ['detail', 'colour', 'atlas']) {
      if (!tooShort()) return;
      if (!dataSummaryNode.querySelector(`[data-part="${part}"]`)) continue;
      dropped.push(part);
      dataSummaryNode.dataset.short = dropped.join(' ');
    }
  }
  const onResize = () => {
    fitBar();
    fitSummary();
  };

  const onDataToggle = event => {
    event.stopPropagation();
    data.toggleAttribute('data-instant', event.detail === 0);
    setDataOpen(!dataOpen());
  };
  const onDocumentPointer = event => {
    if (dataOpen() && !dataWrap.contains(event.target)) setDataOpen(false);
  };
  const onMore = () => setDataOpen(false);
  // Marked handled: the app's own Escape would otherwise go on to clear the selection.
  const onEscape = event => {
    if (event.key !== 'Escape' || !dataOpen() || !collapsed()) return;
    event.preventDefault();
    setDataOpen(false);
    dataToggle.focus();
  };
  // Tabbing past the last control leaves the popover; it should not stay open behind the reader.
  const onDataFocusOut = event => {
    if (dataOpen() && event.relatedTarget && !dataWrap.contains(event.relatedTarget)) setDataOpen(false);
  };
  const listeners = [
    [dataToggle, 'click', onDataToggle],
    [document.getElementById('masthead-more'), 'click', onMore],
    [dataWrap, 'focusout', onDataFocusOut],
    [document, 'pointerdown', onDocumentPointer],
    [document, 'keydown', onEscape],
    [globalThis, 'resize', onResize],
  ];
  for (const [target, type, listener] of listeners) target.addEventListener(type, listener);
  setDataOpen(false);
  document.fonts?.ready.then(onResize);

  const provenance = createProvenance({
    manifest, manifestUrl, indexUrl, domains, fallbackFocus: document.getElementById('masthead-more'),
  });

  let paintedSummary = '';
  function paintSummary(parts) {
    const key = parts.map(({ part, text }) => `${part}:${text}`).join('\n');
    if (key === paintedSummary) return false;
    paintedSummary = key;
    dataSummaryNode.replaceChildren(...parts.flatMap(({ part, text }, index) => {
      const node = document.createElement('span');
      node.className = 'data-summary-part';
      node.dataset.part = part;
      node.textContent = text;
      if (!index) return [node];
      const dot = document.createElement('span');
      dot.className = 'data-summary-sep';
      dot.dataset.part = part;
      dot.setAttribute('aria-hidden', 'true');
      dot.textContent = '·';
      return [dot, node];
    }));
    return true;
  }

  let fittedLang = '';
  return {
    update(state, { visibleCount, reference, tracts = null }) {
      const { lang } = state;
      const i18n = t(lang, 'header');
      const display = t(lang, 'display');
      const footer = t(lang, 'footer');
      const switching = state.status === 'switching';
      const kind = typeof anatomy.individual === 'boolean' ? footer.kind(anatomy.individual) : '';
      const atlasNote = id => i18n.notes[id] ?? t(lang, 'atlases')[id] ?? '';

      // A choice is held only while it downloads: once it lands, fails or is overtaken, the select shows the state.
      const values = { atlas: state.atlas, colour: state.surfaceColor, detail: state.detail ?? fallbackDetail };
      for (const field of Object.keys(chosen)) {
        if (!switching || chosen[field] === values[field]) chosen[field] = null;
      }
      const shown = field => chosen[field] ?? values[field];
      // The selected option is the field's value: its name, and how far it has loaded while it downloads.
      // Every other option says what else choosing it would change.
      const text = (field, value, name, other) => (value !== shown(field) ? other
        : chosen[field] ? `${name} · ${loadingText(lang, state.progress)}` : name);

      for (const node of selects.atlas.options) {
        const id = node.value;
        setText(node, text('atlas', id, atlasSwitchLabel(id, lang), atlasOption(lang, id, required(shown('colour')))));
      }
      for (const optgroup of optgroups) optgroup.label = i18n.colourGroups[optgroup.dataset.group];
      for (const node of selects.colour.options) {
        const mode = node.value;
        setText(node, text('colour', mode, display.surfaceColors[mode],
          colourOption(lang, mode, { atlas: shown('atlas'), required: required(mode) })));
      }
      for (const node of selects.detail.options) {
        const name = atlasSwitchLabel(node.value, lang);
        setText(node, text('detail', node.value, name, name));
      }
      for (const field of ['atlas', 'colour', 'detail']) selects[field].value = shown(field);

      // The tract reference is another subject: name it, and offer nothing that would not change it.
      masthead.toggleAttribute('data-reference', Boolean(reference));
      if (reference && dataOpen()) setDataOpen(false);
      studyName.textContent = reference?.label ?? subjectName(anatomy);
      studyName.hidden = offerAnatomies && !reference;
      surfaceField.hidden = Boolean(reference);
      selects.subject.hidden = !offerAnatomies || Boolean(reference);
      // Another subject is another page, so it waits for a download to finish.
      selects.subject.disabled = switching;

      labels.subject.textContent = i18n.subject;
      labels.atlas.textContent = i18n.atlas;
      labels.colour.textContent = i18n.colour;
      labels.detail.textContent = display.internalAnatomy;
      setNote(notes.subject, kind);
      setNote(notes.atlas, atlasNote(shown('atlas')));
      setNote(notes.colour, display.surfaceColorTitles[shown('colour')] ?? '');
      setNote(notes.detail, offersDetail ? atlasNote(shown('detail')) : '');
      tips = [...Object.entries(selects).map(([field, select]) => [select, notes[field].textContent]),
        [studyName, reference?.description ?? kind]];
      dataToggle.dataset.tooltip = i18n.dataSummary;

      const selected = field => selects[field].selectedOptions[0]?.textContent ?? '';
      const changed = paintSummary(dataSummary({
        subject: subjectName(anatomy),
        atlas: selected('atlas'),
        colour: selected('colour'),
        detail: offersDetail ? selected('detail') : null,
        reference: reference?.label,
      }));
      if (changed || lang !== fittedLang) {
        fittedLang = lang;
        onResize();
      } else showTips();

      // Tracts mode counts its bundles; elsewhere, the regions drawn, or a download the masthead is not already showing.
      const shownInMasthead = Object.values(chosen).some(Boolean);
      regionCount.textContent = tracts ?? (switching && !shownInMasthead
        ? loadingText(lang, state.progress)
        : state.status === 'ready' || switching ? footer.visibleRegions(visibleCount) : '');
      paintColophon(lang, { anatomy, reference });
      provenance.update(lang, reference ? {
        label: reference.label,
        links: ['native-tract-source', 'native-tract-provenance']
          .map(id => document.getElementById(id))
          .filter(anchor => anchor?.href)
          .map(anchor => ({ href: anchor.href, text: anchor.textContent })),
      } : null);
    },
    dispose() {
      for (const [target, type, listener] of listeners) target.removeEventListener(type, listener);
      for (const [select, listener] of changes) select.removeEventListener('change', listener);
      provenance.dispose();
      for (const select of Object.values(selects)) select.replaceChildren();
    },
  };
}
