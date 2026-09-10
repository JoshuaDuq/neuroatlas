/** Atlas choice, visible region count, and the theme switch. */
export function createHeader({ atlases, onAtlas, onTheme }) {
  const container = document.getElementById('atlas-switch');
  const count = document.getElementById('region-count');
  const themeButton = document.getElementById('theme-toggle');
  const themeLabel = document.getElementById('theme-label');

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

  const onThemeClick = () => onTheme();
  themeButton.addEventListener('click', onThemeClick);

  return {
    update(state, { visibleCount }) {
      for (const button of buttons) {
        const active = button.dataset.atlas === state.atlas;
        button.setAttribute('aria-pressed', String(active));
        button.disabled = state.status === 'loading';
        button.dataset.loading = String(active && state.status === 'loading');
      }
      count.textContent = state.status === 'ready' ? `${visibleCount} regions` : '';
      const dark = state.theme === 'dark';
      themeLabel.textContent = dark ? 'Light' : 'Dark';
      themeButton.setAttribute('aria-pressed', String(dark));
      themeButton.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    },
    dispose() {
      themeButton.removeEventListener('click', onThemeClick);
      container.replaceChildren();
    },
  };
}
