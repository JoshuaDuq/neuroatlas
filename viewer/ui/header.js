import { count } from './format.js';
import { t } from '../i18n/translations.js';
import { PHONE_QUERY } from '../render/device.js';

const switchProgress = (progress, lang) => {
  const i18n = t(lang, 'header');
  return progress?.total ? i18n.loadingProgress(progress) : i18n.loadingAtlas;
};

/** Atlas choice, visible region count, language switch, and theme switch. */
export function createHeader({ atlases, onAtlas, onTheme, onLang }) {
  const container = document.getElementById('atlas-switch');
  const regionCount = document.getElementById('region-count');
  const themeButton = document.getElementById('theme-toggle');
  const themeLabel = document.getElementById('theme-label');
  const langContainer = document.getElementById('lang-switch');
  const shortcutsButton = document.getElementById('shortcuts-open');
  const moreButton = document.getElementById('masthead-more');
  const menu = document.getElementById('masthead-menu');

  /*
   * On a phone the region count, language, theme and shortcuts do not fit
   * beside the atlas switch, and the row they wrapped onto overflowed a
   * fixed-height masthead and was painted over by the panel below — the theme
   * toggle and the shortcuts button could not be tapped at all. They collapse
   * behind one button here. Above the breakpoint the panel is display:contents
   * and the masthead is exactly as it was.
   */
  const phoneQuery = globalThis.matchMedia?.(PHONE_QUERY)
    ?? { matches: false, addEventListener() {}, removeEventListener() {} };

  function closeMenu() {
    menu.hidden = true;
    moreButton.setAttribute('aria-expanded', 'false');
  }

  function applyMode() {
    const phone = phoneQuery.matches;
    moreButton.hidden = !phone;
    // Above the breakpoint the panel must never be hidden: it is the masthead.
    menu.hidden = phone;
    moreButton.setAttribute('aria-expanded', 'false');
  }

  const onMore = event => {
    event.stopPropagation();
    const open = menu.hidden;
    menu.hidden = !open;
    moreButton.setAttribute('aria-expanded', String(open));
  };
  const onDocumentPointer = event => {
    if (!phoneQuery.matches || menu.hidden) return;
    if (menu.contains(event.target) || moreButton.contains(event.target)) return;
    closeMenu();
  };
  const onEscape = event => {
    if (event.key === 'Escape' && phoneQuery.matches && !menu.hidden) closeMenu();
  };
  // A setting chosen from the menu has been applied; leaving it open hides
  // the anatomy the reader just changed.
  const onMenuClick = event => {
    if (phoneQuery.matches && event.target.closest('button')) closeMenu();
  };

  moreButton.addEventListener('click', onMore);
  menu.addEventListener('click', onMenuClick);
  document.addEventListener('pointerdown', onDocumentPointer);
  document.addEventListener('keydown', onEscape);
  phoneQuery.addEventListener('change', applyMode);
  applyMode();

  // Two atlases: showing both is clearer than hiding one behind a dropdown.
  const buttons = atlases.map(atlas => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = atlas.label.replace(/ (anatomical )?atlas$/i, '');
    button.title = atlas.label;
    button.dataset.atlas = atlas.id;
    button.addEventListener('click', () => onAtlas(atlas.id));
    container.append(button);
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

      container.setAttribute('aria-label', i18n.atlasSwitch);
      if (langContainer) langContainer.setAttribute('aria-label', i18n.languageSwitch);
      if (shortcutsButton) shortcutsButton.setAttribute('aria-label', i18n.shortcuts);
      moreButton.setAttribute('aria-label', t(state.lang, 'menu').more);

      for (const btn of langButtons) {
        const active = btn.dataset.lang === state.lang;
        btn.setAttribute('aria-pressed', String(active));
      }

      for (const button of buttons) {
        const active = button.dataset.atlas === state.atlas;
        const fullLabel = atlasDict[button.dataset.atlas] ?? button.dataset.atlas;
        button.title = fullLabel;
        button.setAttribute('aria-pressed', String(active));
        button.disabled = state.status === 'loading' || switching;
        button.dataset.loading = String(switching && !active);
      }

      regionCount.textContent = switching
        ? switchProgress(state.progress, state.lang)
        : state.status === 'ready' ? count(visibleCount, 'region', state.lang) : '';

      const dark = state.theme === 'dark';
      themeLabel.textContent = dark ? i18n.lightTheme : i18n.darkTheme;
      themeButton.setAttribute('aria-pressed', String(dark));
      themeButton.setAttribute('aria-label', dark ? i18n.switchToLight : i18n.switchToDark);
    },
    dispose() {
      moreButton.removeEventListener('click', onMore);
      menu.removeEventListener('click', onMenuClick);
      document.removeEventListener('pointerdown', onDocumentPointer);
      document.removeEventListener('keydown', onEscape);
      phoneQuery.removeEventListener('change', applyMode);
      themeButton.removeEventListener('click', onThemeClick);
      for (const [btn, handler] of onLangClicks) {
        btn.removeEventListener('click', handler);
      }
      container.replaceChildren();
    },
  };
}
