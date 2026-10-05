import { atlasSwitchLabel, t } from '../i18n/translations.js';
import { createProvenance } from './provenance.js';
import { bindRoving } from './roving.js';

const switchProgress = (progress, lang) => {
  const i18n = t(lang, 'header');
  return progress?.total ? i18n.loadingProgress(progress) : i18n.loadingAtlas;
};

const SURFACE_MODES = ['tissue', 'mri', 'atlas', 'network'];

/** The published title without its quotation marks: "SNAIL subj_1", dataset and subject together. */
export function subjectName(entry) {
  const name = String(entry?.display_name ?? '').replace(/[“”"]/g, '').replace(/\s+/g, ' ').trim();
  return name || entry?.subject || entry?.id || '';
}

/** What the collapsed masthead names: subject, atlas and colouring, or the tract reference alone. */
export function dataSummary({ subject, atlas, colour, reference }) {
  return reference ? [reference] : [subject, atlas, colour].filter(Boolean);
}

/** The status bar's statement, after what is loaded; alone until something is. */
export function colophonParts(lang, { anatomy, reference } = {}) {
  const copy = t(lang, 'footer');
  if (reference) return { description: copy.referenceColophon(reference.label), statement: copy.statement };
  if (anatomy) return { description: copy.colophon(anatomy), statement: copy.statement };
  return { description: '', statement: copy.statementAlone };
}

export function paintColophon(lang, loaded) {
  const { description, statement } = colophonParts(lang, loaded);
  document.getElementById('colophon-description').textContent = description;
  document.getElementById('colophon-statement').textContent = statement;
}

/** The masthead: which data is loaded, plus fullscreen, snapshot and settings; and the status bar under the stage. */
export function createHeader({
  atlases, networks, anatomy, anatomies = [], manifest, manifestUrl, indexUrl, modelView,
  onAtlas, onSurfaceColor, onTheme, onLang, onAnatomy, onSingleKeys,
}) {
  const container = document.getElementById('atlas-switch');
  const surfaceContainer = document.getElementById('surface-switch');
  const surfaceField = document.getElementById('surface-field');
  const regionCount = document.getElementById('region-count');
  const themeContainer = document.getElementById('theme-switch');
  const themeLabel = document.getElementById('theme-label');
  const singleKeysContainer = document.getElementById('single-keys-switch');
  const singleKeysLabel = document.getElementById('single-keys-label');
  const langContainer = document.getElementById('lang-switch');
  const langLabel = document.getElementById('lang-label');
  const shortcutsButton = document.getElementById('shortcuts-open');
  const shortcutsLabel = document.getElementById('shortcuts-label');
  const moreButton = document.getElementById('masthead-more');
  const menu = document.getElementById('masthead-menu');
  const menuFullscreen = document.getElementById('menu-fullscreen');
  const fullscreenButton = document.getElementById('viewport-fullscreen');
  const masthead = document.getElementById('masthead');
  const skipLink = document.getElementById('skip-to-model');
  const dataWrap = document.getElementById('masthead-data-wrap');
  const dataToggle = document.getElementById('masthead-data-toggle');
  const dataSummaryNode = document.getElementById('masthead-data-summary');
  const data = document.getElementById('masthead-data');
  const studyName = document.getElementById('study-name');
  const anatomySwitch = document.getElementById('anatomy-switch');
  const subjectLabel = document.getElementById('subject-label');
  const atlasControlLabel = document.getElementById('atlas-control-label');
  const surfaceControlLabel = document.getElementById('surface-control-label');

  // A dropdown only when there is a choice; one published brain is a name, not a control.
  const offerAnatomies = anatomies.length > 1;
  const onAnatomyChange = event => onAnatomy?.(event.target.value);
  if (anatomySwitch && offerAnatomies) {
    for (const entry of anatomies) {
      const option = document.createElement('option');
      option.value = entry.id;
      option.textContent = subjectName(entry);
      option.title = entry.label ?? entry.display_name ?? entry.id;
      option.selected = entry.id === anatomy?.id;
      anatomySwitch.append(option);
    }
    anatomySwitch.addEventListener('change', onAnatomyChange);
  }

  let lastLang = 'en';

  function closeMenu() {
    menu.hidden = true;
    moreButton.setAttribute('aria-expanded', 'false');
  }

  // The summary button is only rendered where the bar does not fit.
  const collapsed = () => dataToggle.getClientRects().length > 0;
  const dataOpen = () => dataToggle.getAttribute('aria-expanded') === 'true';
  function setDataOpen(open) {
    dataToggle.setAttribute('aria-expanded', String(open));
    data.toggleAttribute('data-open', open);
  }

  function paintShortcuts() {
    shortcutsLabel.textContent = t(lastLang, 'header').shortcuts;
  }

  const onMore = event => {
    event.stopPropagation();
    const open = menu.hidden;
    menu.hidden = !open;
    moreButton.setAttribute('aria-expanded', String(open));
    if (open) setDataOpen(false);
  };
  const onDataToggle = event => {
    event.stopPropagation();
    const open = !dataOpen();
    setDataOpen(open);
    if (open) closeMenu();
  };
  const onDocumentPointer = event => {
    if (!menu.hidden && !menu.contains(event.target) && !moreButton.contains(event.target)) closeMenu();
    if (dataOpen() && !dataWrap.contains(event.target)) setDataOpen(false);
  };
  // Marked handled: the app's own Escape would otherwise go on to clear the selection.
  const onEscape = event => {
    if (event.key !== 'Escape') return;
    if (!menu.hidden) {
      event.preventDefault();
      closeMenu();
      moreButton.focus();
    } else if (dataOpen() && collapsed()) {
      event.preventDefault();
      setDataOpen(false);
      dataToggle.focus();
    }
  };
  // Tabbing past the last control leaves the popover; it should not stay open behind the reader.
  const onDataFocusOut = event => {
    if (dataOpen() && event.relatedTarget && !dataWrap.contains(event.relatedTarget)) setDataOpen(false);
  };
  const onResize = () => {
    if (dataOpen() && !collapsed()) setDataOpen(false);
    fitSummary();
  };
  // A setting chosen from the menu has been applied; leaving it open hides
  // the anatomy the reader just changed.
  const onMenuClick = event => {
    if (event.target.closest('button')) {
      closeMenu();
      moreButton.focus();
    }
  };
  const onMenuFullscreen = () => fullscreenButton?.click();
  const onSkip = event => {
    event.preventDefault();
    modelView.focus({ focusVisible: true });
  };

  moreButton.addEventListener('click', onMore);
  menu.addEventListener('click', onMenuClick);
  dataToggle.addEventListener('click', onDataToggle);
  dataWrap.addEventListener('focusout', onDataFocusOut);
  menuFullscreen?.addEventListener('click', onMenuFullscreen);
  skipLink.addEventListener('click', onSkip);
  document.addEventListener('pointerdown', onDocumentPointer);
  document.addEventListener('keydown', onEscape);
  globalThis.addEventListener('resize', onResize);
  moreButton.hidden = false;
  skipLink.hidden = false;
  if (menuFullscreen) menuFullscreen.hidden = !document.fullscreenEnabled;
  closeMenu();
  setDataOpen(false);
  paintShortcuts();

  const provenance = createProvenance({ manifest, manifestUrl, indexUrl, fallbackFocus: moreButton });

  // Two atlases: showing both is clearer than hiding one behind a dropdown.
  const buttons = atlases.map(atlas => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = atlasSwitchLabel(atlas.id);
    button.title = atlas.label;
    button.dataset.atlas = atlas.id;
    button.addEventListener('click', () => onAtlas(atlas.id));
    container.append(button);
    return button;
  });

  // A build without the network layer must not offer to colour by it. Absent
  // rather than disabled: an option that can never be chosen is not a choice.
  const surfaceButtons = SURFACE_MODES
    .filter(mode => mode !== 'network' || networks)
    .map(mode => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.surface = mode;
      button.addEventListener('click', () => onSurfaceColor(mode));
      surfaceContainer.append(button);
      return button;
    });

  const langButtons = langContainer ? [...langContainer.querySelectorAll('button')] : [];
  const onLangClicks = langButtons.map(btn => {
    const handler = () => onLang?.(btn.dataset.lang);
    btn.addEventListener('click', handler);
    return [btn, handler];
  });

  const themeButtons = [...themeContainer.querySelectorAll('[data-theme-option]')];
  const onThemeClick = event => {
    const button = event.target.closest('[data-theme-option]');
    if (button && button.getAttribute('aria-pressed') !== 'true') onTheme();
  };
  themeContainer.addEventListener('click', onThemeClick);

  const singleKeyButtons = [...(singleKeysContainer?.querySelectorAll('[data-single-keys]') ?? [])];
  const onSingleKeysClick = event => {
    const button = event.target.closest('[data-single-keys]');
    if (button) onSingleKeys?.(button.dataset.singleKeys === 'on');
  };
  singleKeysContainer?.addEventListener('click', onSingleKeysClick);

  // Each exclusive choice is one Tab stop; arrows move inside it.
  const rovingGroups = [container, surfaceContainer, langContainer, themeContainer, singleKeysContainer]
    .filter(Boolean)
    .map(group => bindRoving(group));

  // The colouring (Networks) is the last to go: the subject truncates first, then the atlas drops,
  // and only when the subject would be cut below about five letters does the colour drop too.
  function fitSummary() {
    dataSummaryNode.removeAttribute('data-short');
    const subject = dataSummaryNode.firstElementChild;
    if (!collapsed() || !subject) return;
    const tooShort = () => subject.clientWidth
      < Math.min(subject.scrollWidth, 5 * parseFloat(getComputedStyle(subject).fontSize));
    for (const level of ['atlas', 'colour']) {
      if (dataSummaryNode.children.length < 3 || !tooShort()) return;
      dataSummaryNode.dataset.short = level;
    }
  }
  document.fonts?.ready.then(fitSummary);

  let paintedSummary = '';
  function paintSummary(parts) {
    const key = parts.join('\n');
    if (key === paintedSummary) return;
    paintedSummary = key;
    dataSummaryNode.replaceChildren(...parts.flatMap((text, index) => {
      const part = document.createElement('span');
      part.className = 'data-summary-part';
      part.textContent = text;
      if (!index) return [part];
      const dot = document.createElement('span');
      dot.className = 'data-summary-sep';
      dot.setAttribute('aria-hidden', 'true');
      dot.textContent = '·';
      return [dot, part];
    }));
    fitSummary();
  }

  return {
    update(state, { visibleCount, reference, tracts = null, singleKeys = true }) {
      const i18n = t(state.lang, 'header');
      const atlasDict = t(state.lang, 'atlases');
      const surfaces = t(state.lang, 'display');
      const switching = state.status === 'switching';

      lastLang = state.lang;
      skipLink.textContent = i18n.skipToModel;
      // The tract reference is another subject: name it, and offer nothing that would not change it.
      masthead.toggleAttribute('data-reference', Boolean(reference));
      if (reference && dataOpen()) setDataOpen(false);
      studyName.textContent = reference?.label ?? subjectName(anatomy);
      studyName.title = reference?.description ?? anatomy.label ?? '';
      studyName.hidden = offerAnatomies && !reference;
      surfaceField.hidden = Boolean(reference);
      if (anatomySwitch && offerAnatomies) {
        anatomySwitch.hidden = Boolean(reference);
        anatomySwitch.title = anatomySwitch.selectedOptions[0]?.title || i18n.subject;
        anatomySwitch.disabled = state.status === 'loading' || switching;
      }
      subjectLabel.textContent = i18n.subject;
      atlasControlLabel.textContent = i18n.atlas;
      surfaceControlLabel.textContent = i18n.colour;
      container.setAttribute('aria-label', i18n.atlasSwitch);
      surfaceContainer.setAttribute('aria-label', surfaces.surfaceColor);
      paintSummary(dataSummary({
        subject: subjectName(anatomy),
        atlas: atlasSwitchLabel(state.atlas, state.lang),
        colour: surfaces.surfaceColors[state.surfaceColor],
        reference: reference?.label,
      }));
      dataToggle.title = i18n.dataSummary;
      if (langLabel) langLabel.textContent = i18n.languageSwitch;
      if (shortcutsButton) shortcutsButton.setAttribute('aria-label', i18n.shortcuts);
      if (menuFullscreen) menuFullscreen.textContent = t(state.lang, 'viewport').fullscreen;
      paintShortcuts();
      const moreLabel = t(state.lang, 'menu').more;
      moreButton.setAttribute('aria-label', moreLabel);
      moreButton.title = moreLabel;

      for (const btn of langButtons) {
        const active = btn.dataset.lang === state.lang;
        btn.setAttribute('aria-pressed', String(active));
      }

      for (const button of buttons) {
        const active = button.dataset.atlas === state.atlas;
        const fullLabel = atlasDict[button.dataset.atlas] ?? button.dataset.atlas;
        button.textContent = atlasSwitchLabel(button.dataset.atlas, state.lang);
        button.title = fullLabel;
        button.setAttribute('aria-pressed', String(active));
        button.disabled = state.status === 'loading' || switching;
        button.dataset.loading = String(switching && !active);
      }

      for (const button of surfaceButtons) {
        const mode = button.dataset.surface;
        button.textContent = surfaces.surfaceColors[mode] ?? mode;
        button.title = surfaces.surfaceColorTitles[mode] ?? '';
        button.setAttribute('aria-pressed', String(mode === state.surfaceColor));
      }

      // Tracts mode counts its bundles; elsewhere, the regions currently drawn.
      const footer = t(state.lang, 'footer');
      regionCount.textContent = tracts ?? (switching
        ? switchProgress(state.progress, state.lang)
        : state.status === 'ready' ? footer.visibleRegions(visibleCount) : '');
      paintColophon(state.lang, { anatomy, reference });
      provenance.update(state.lang, reference ? {
        label: reference.label,
        links: ['native-tract-source', 'native-tract-provenance']
          .map(id => document.getElementById(id))
          .filter(anchor => anchor?.href)
          .map(anchor => ({ href: anchor.href, text: anchor.textContent })),
      } : null);

      themeLabel.textContent = i18n.theme;
      for (const button of themeButtons) {
        const option = button.dataset.themeOption;
        button.textContent = option === 'dark' ? i18n.darkTheme : i18n.lightTheme;
        button.setAttribute('aria-pressed', String(option === state.theme));
      }

      if (singleKeysLabel) singleKeysLabel.textContent = i18n.singleKeys;
      for (const button of singleKeyButtons) {
        const on = button.dataset.singleKeys === 'on';
        button.textContent = on ? i18n.singleKeysOn : i18n.singleKeysOff;
        button.setAttribute('aria-pressed', String(on === singleKeys));
      }
      for (const group of rovingGroups) group.sync();
    },
    dispose() {
      moreButton.removeEventListener('click', onMore);
      menu.removeEventListener('click', onMenuClick);
      dataToggle.removeEventListener('click', onDataToggle);
      dataWrap.removeEventListener('focusout', onDataFocusOut);
      menuFullscreen?.removeEventListener('click', onMenuFullscreen);
      skipLink.removeEventListener('click', onSkip);
      document.removeEventListener('pointerdown', onDocumentPointer);
      document.removeEventListener('keydown', onEscape);
      globalThis.removeEventListener('resize', onResize);
      themeContainer.removeEventListener('click', onThemeClick);
      singleKeysContainer?.removeEventListener('click', onSingleKeysClick);
      for (const [btn, handler] of onLangClicks) {
        btn.removeEventListener('click', handler);
      }
      anatomySwitch?.removeEventListener('change', onAnatomyChange);
      for (const group of rovingGroups) group.dispose();
      provenance.dispose();
      container.replaceChildren();
      surfaceContainer.replaceChildren();
    },
  };
}
