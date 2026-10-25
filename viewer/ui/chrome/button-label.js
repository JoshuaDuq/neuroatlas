// One oblique projection (depth runs up and to the right): the uncut solid, then each plane through it.
const ICON_PATHS = {
  off: 'M4 9h11v11H4ZM4 9l5-5h11l-5 5M20 4v11l-5 5',
  sagittal: 'M9 9.5 15 3.5v11l-6 6Z',
  coronal: 'M6.5 6.5h11v11h-11Z',
  axial: 'M4 14.5 9 9.5h11l-5 5Z',
  oblique: 'M4 18 9 6h11l-5 12Z',
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
