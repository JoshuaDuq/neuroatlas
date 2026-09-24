import { count } from './format.js';
import { atlasSwitchLabel, t } from '../i18n/translations.js';
import { MASTHEAD_MENU_QUERY } from '../render/device.js';

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

/**
 * Atlas choice, what the surface is coloured by, visible region count,
 * language and theme.
 *
 * The two segmented controls are siblings on purpose: one says which
 * parcellation the cortex carries, the other what the cortex is showing. Both
 * answer "what am I looking at", so both are in the masthead rather than one
 * of them behind a panel tab.
 */
export function createHeader({ atlases, networks, anatomy, anatomies = [], onAtlas, onSurfaceColor, onTheme, onLang, onAnatomy }) {
  const container = document.getElementById('atlas-switch');
  const surfaceContainer = document.getElementById('surface-switch');
  const regionCount = document.getElementById('region-count');
  const themeButton = document.getElementById('theme-toggle');
  const themeLabel = document.getElementById('theme-label');
  const langContainer = document.getElementById('lang-switch');
  const shortcutsButton = document.getElementById('shortcuts-open');
  const moreButton = document.getElementById('masthead-more');
  const menu = document.getElementById('masthead-menu');
  const studyName = document.getElementById('study-name');
  const anatomySwitch = document.getElementById('anatomy-switch');

  /*
   * Which brain. A dropdown rather than a segmented control: the names are
   * long, and unlike the atlas switch this one replaces every asset on the
   * page, so it should read as a deliberate choice rather than a toggle. With
   * only one brain published there is nothing to choose, and the control stays
   * hidden — an option that can never be taken is not a choice.
   *
   * When there is a choice it replaces the static study name in the identity
   * cluster. Showing both named the same specimen twice.
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

  /*
   * Below 1100px the region count, language, theme and shortcuts do not fit
   * beside the two instrument switches. They collapse behind one button.
   * Above the breakpoint the panel is display:contents and the settings sit
   * in the masthead row.
   */
  const menuQuery = globalThis.matchMedia?.(MASTHEAD_MENU_QUERY)
    ?? { matches: false, addEventListener() {}, removeEventListener() {} };
  let lastLang = 'en';

  function closeMenu() {
    menu.hidden = true;
    moreButton.setAttribute('aria-expanded', 'false');
  }

  function paintShortcuts(compact) {
    if (!shortcutsButton) return;
    shortcutsButton.textContent = compact ? t(lastLang, 'header').shortcuts : '?';
  }

  /*
   * In the three-column shell the menu drops over the right rail. Matching
   * that rail's width keeps its edge on the column boundary, rather than
   * through the middle of a tab label. A sheet or a stacked rail is not
   * that column, and the menu stays a compact list.
   */
  function placeMenu() {
    const masthead = moreButton.closest('header');
    const inspectorRail = document.getElementById('inspector');
    const rail = inspectorRail?.getBoundingClientRect();
    const head = masthead.getBoundingClientRect();
    const coversRail = menuQuery.matches && rail && rail.width > 160
      && Math.abs(rail.right - globalThis.innerWidth) < 2
      && rail.top <= head.bottom + 1;
    if (coversRail) masthead.style.setProperty('--settings-width', `${Math.round(rail.width)}px`);
    else masthead.style.removeProperty('--settings-width');
  }

  function applyMode() {
    const compact = menuQuery.matches;
    moreButton.hidden = !compact;
    // Above the breakpoint the panel must never be hidden: it is the masthead.
    menu.hidden = compact;
    moreButton.setAttribute('aria-expanded', 'false');
    paintShortcuts(compact);
    placeMenu();
  }

  const onMore = event => {
    event.stopPropagation();
    const open = menu.hidden;
    menu.hidden = !open;
    moreButton.setAttribute('aria-expanded', String(open));
    if (open) placeMenu();
  };
  const onResize = () => placeMenu();
  const onDocumentPointer = event => {
    if (!menuQuery.matches || menu.hidden) return;
    if (menu.contains(event.target) || moreButton.contains(event.target)) return;
    closeMenu();
  };
  // Marked handled: the app's own Escape would otherwise go on to clear the selection.
  const onEscape = event => {
    if (event.key !== 'Escape' || !menuQuery.matches || menu.hidden) return;
    event.preventDefault();
    closeMenu();
  };
  // A setting chosen from the menu has been applied; leaving it open hides
  // the anatomy the reader just changed.
  const onMenuClick = event => {
    if (menuQuery.matches && event.target.closest('button')) closeMenu();
  };

  moreButton.addEventListener('click', onMore);
  menu.addEventListener('click', onMenuClick);
  document.addEventListener('pointerdown', onDocumentPointer);
  document.addEventListener('keydown', onEscape);
  globalThis.addEventListener?.('resize', onResize);
  menuQuery.addEventListener('change', applyMode);
  applyMode();

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

  const onThemeClick = () => onTheme();
  themeButton.addEventListener('click', onThemeClick);

  return {
    update(state, { visibleCount }) {
      const i18n = t(state.lang, 'header');
      const atlasDict = t(state.lang, 'atlases');
      const switching = state.status === 'switching';

      lastLang = state.lang;
      container.setAttribute('aria-label', i18n.atlasSwitch);
      surfaceContainer.setAttribute('aria-label', t(state.lang, 'display').surfaceColor);
      if (langContainer) langContainer.setAttribute('aria-label', i18n.languageSwitch);
      if (anatomySwitch && offerAnatomies) {
        anatomySwitch.setAttribute('aria-label', i18n.anatomySwitch);
        anatomySwitch.title = anatomySwitch.selectedOptions[0]?.title || i18n.anatomySwitch;
        anatomySwitch.disabled = state.status === 'loading' || switching;
      }
      if (shortcutsButton) shortcutsButton.setAttribute('aria-label', i18n.shortcuts);
      paintShortcuts(menuQuery.matches);
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
        button.textContent = surfaces.surfaceColors[mode] ?? mode;
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
      globalThis.removeEventListener?.('resize', onResize);
      menuQuery.removeEventListener('change', applyMode);
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
