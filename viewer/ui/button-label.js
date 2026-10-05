const ICON_PATHS = {
  off: 'M5 3h14v18H5ZM9 3v18M15 3v18',
  sagittal: 'M5 3h14v18H5ZM12 3v18',
  coronal: 'M5 3h14v18H5ZM5 8h14M5 16h14',
  axial: 'M5 3h14v18H5ZM5 12h14',
  oblique: 'M5 3h14v18H5ZM5 17 19 7',
};

/** Keep decorative icons separate from the translated, accessible label. */
export function createButtonLabel(button, icon) {
  const pathData = ICON_PATHS[icon];
  if (!pathData) throw new RangeError(`Unknown control icon: ${icon}`);

  const namespace = 'http://www.w3.org/2000/svg';
  const graphic = document.createElementNS(namespace, 'svg');
  graphic.setAttribute('viewBox', '0 0 24 24');
  graphic.setAttribute('fill', 'none');
  graphic.setAttribute('stroke', 'currentColor');
  graphic.setAttribute('stroke-width', '1.5');
  graphic.setAttribute('stroke-linecap', 'round');
  graphic.setAttribute('stroke-linejoin', 'round');
  graphic.setAttribute('aria-hidden', 'true');
  graphic.classList.add('control-icon');
  const path = document.createElementNS(namespace, 'path');
  path.setAttribute('d', pathData);
  graphic.append(path);

  const label = document.createElement('span');
  label.className = 'control-label';
  label.textContent = button.textContent;
  button.replaceChildren(graphic, label);
  return label;
}
