import { count } from './format.js';
import { atlasSwitchLabel, t } from '../i18n/translations.js';
import { createButtonLabel } from './button-label.js';

const switchProgress = (progress, lang) => {
  const i18n = t(lang, 'header');
  return progress?.total ? i18n.loadingProgress(progress) : i18n.loadingAtlas;
};

const SURFACE_MODES = ['tissue', 'mri', 'atlas', 'network'];

/** Short name for the identity switch: the specimen, not the reconstruction title. */
export function anatomySwitchLabel(entry) {
  const quoted = String(entry?.display_name ?? '').match(/[“"]([^”"]+)[”"]/);
  return quoted?.[1] ?? entry?.subject ?? entry?.id ?? '';
}

/** Source and appearance controls in View; identity and preferences above it. */
export function createHeader({ atlases, networks, anatomy, anatomies = [], onAtlas, onSurfaceColor, onTheme, onLang, onAnatomy }) {
  const container = document.getElementById('atlas-switch');
  const surfaceContainer = document.getElementById('surface-switch');
  const regionCount = document.getElementById('region-count');
  const themeButton = document.getElementById('theme-toggle');
  const themeLabel = document.getElementById('theme-label');
  const langContainer = document.getElementById('lang-switch');
  const shortcutsButton = document.getElementById('shortcuts-open');
  const shortcutsLabel = document.getElementById('shortcuts-label');
  const moreButton = document.getElementById('masthead-more');
  const menu = document.getElementById('masthead-menu');
  const studyName = document.getElementById('study-name');
  const anatomySwitch = document.getElementById('anatomy-switch');
  const specimenLabel = document.getElementById('specimen-label');
  const atlasControlLabel = document.getElementById('atlas-control-label');
  const surfaceControlLabel = document.getElementById('surface-control-label');
  const brandDescription = document.getElementById('brand-description');
  const source = document.getElementById('workspace-source');

  /*
   * Which brain. A dropdown rather than a segmented control: the names are
   * long, and unlike the atlas switch this one replaces every asset on the
   * page, so it should read as a deliberate choice rather than a toggle. With
   * only one brain published there is nothing to choose, and the control stays
   * hidden — an option that can never be taken is not a choice.
   *
   * With multiple specimens, the View panel replaces the static name with
   * this dropdown. The header keeps a compact readout of the current source.
   */
  const offerAnatomies = anatomies.length > 1;
  const onAnatomyChange = event => onAnatomy?.(event.target.value);
  if (studyName && anatomy?.subject) {
    studyName.textContent = anatomy.subject;
    studyName.title = anatomy.label || anatomy.display_name || anatomy.subject;
    studyName.hidden = offerAnatomies;
  }
  if (anatomySwitch && offerAnatomies) {
    for (const entry of anatomies) {
      const option = document.createElement('option');
      option.value = entry.id;
      option.textContent = anatomySwitchLabel(entry);
      option.title = entry.display_name ?? entry.id;
      option.selected = entry.id === anatomy?.id;
      anatomySwitch.append(option);
    }
    anatomySwitch.hidden = false;
    anatomySwitch.addEventListener('change', onAnatomyChange);
  }

  let lastLang = 'en';

  function closeMenu() {
    menu.hidden = true;
    moreButton.setAttribute('aria-expanded', 'false');
  }

  function paintShortcuts() {
    shortcutsLabel.textContent = t(lastLang, 'header').shortcuts;
  }

  const onMore = event => {
    event.stopPropagation();
    const open = menu.hidden;
    menu.hidden = !open;
    moreButton.setAttribute('aria-expanded', String(open));
  };
  const onDocumentPointer = event => {
    if (menu.hidden) return;
    if (menu.contains(event.target) || moreButton.contains(event.target)) return;
    closeMenu();
  };
  // Marked handled: the app's own Escape would otherwise go on to clear the selection.
  const onEscape = event => {
    if (event.key !== 'Escape' || menu.hidden) return;
    event.preventDefault();
    closeMenu();
    moreButton.focus();
  };
  // A setting chosen from the menu has been applied; leaving it open hides
  // the anatomy the reader just changed.
  const onMenuClick = event => {
    if (event.target.closest('button')) {
      closeMenu();
      moreButton.focus();
    }
  };

  moreButton.addEventListener('click', onMore);
  menu.addEventListener('click', onMenuClick);
  document.addEventListener('pointerdown', onDocumentPointer);
  document.addEventListener('keydown', onEscape);
  moreButton.hidden = false;
  closeMenu();
  paintShortcuts();

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
  const surfaceLabels = new Map();
  const surfaceButtons = SURFACE_MODES
    .filter(mode => mode !== 'network' || networks)
    .map(mode => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.surface = mode;
      surfaceLabels.set(button, createButtonLabel(button, mode));
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

  const onThemeClick = () => onTheme();
  themeButton.addEventListener('click', onThemeClick);

  return {
    update(state, { visibleCount }) {
      const i18n = t(state.lang, 'header');
      const atlasDict = t(state.lang, 'atlases');
      const switching = state.status === 'switching';

      lastLang = state.lang;
      brandDescription.textContent = i18n.description;
      source.textContent = `${anatomySwitchLabel(anatomy)} · ${atlasSwitchLabel(state.atlas)}`;
      source.title = anatomy.display_name;
      specimenLabel.textContent = i18n.anatomySwitch;
      atlasControlLabel.textContent = i18n.atlasSwitch;
      surfaceControlLabel.textContent = i18n.appearance;
      container.setAttribute('aria-label', i18n.atlasSwitch);
      surfaceContainer.setAttribute('aria-label', t(state.lang, 'display').surfaceColor);
      if (langContainer) langContainer.setAttribute('aria-label', i18n.languageSwitch);
      if (anatomySwitch && offerAnatomies) {
        anatomySwitch.setAttribute('aria-label', i18n.anatomySwitch);
        anatomySwitch.title = anatomySwitch.selectedOptions[0]?.title || i18n.anatomySwitch;
        anatomySwitch.disabled = state.status === 'loading' || switching;
      }
      if (shortcutsButton) shortcutsButton.setAttribute('aria-label', i18n.shortcuts);
      paintShortcuts();
      moreButton.setAttribute('aria-label', t(state.lang, 'menu').more);

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

      const surfaces = t(state.lang, 'display');
      for (const button of surfaceButtons) {
        const mode = button.dataset.surface;
        surfaceLabels.get(button).textContent = surfaces.surfaceColors[mode] ?? mode;
        button.title = surfaces.surfaceColorTitles[mode] ?? '';
        button.setAttribute('aria-pressed', String(mode === state.surfaceColor));
      }

      regionCount.textContent = switching
        ? switchProgress(state.progress, state.lang)
        : state.status === 'ready' ? count(visibleCount, 'region', state.lang) : '';

      const dark = state.theme === 'dark';
      themeLabel.textContent = dark ? i18n.darkTheme : i18n.lightTheme;
      themeButton.setAttribute('aria-pressed', String(dark));
      themeButton.setAttribute('aria-label', dark ? i18n.switchToLight : i18n.switchToDark);
    },
    dispose() {
      moreButton.removeEventListener('click', onMore);
      menu.removeEventListener('click', onMenuClick);
      document.removeEventListener('pointerdown', onDocumentPointer);
      document.removeEventListener('keydown', onEscape);
      themeButton.removeEventListener('click', onThemeClick);
      for (const [btn, handler] of onLangClicks) {
        btn.removeEventListener('click', handler);
      }
      anatomySwitch?.removeEventListener('change', onAnatomyChange);
      container.replaceChildren();
      surfaceContainer.replaceChildren();
    },
  };
}
