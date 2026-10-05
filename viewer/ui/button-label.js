const ICON_PATHS = {
  find: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 6 6',
  tissue: 'M12 5c-2-3-6-1-6 2-4 0-5 4-3 6-1 3 1 6 4 6 0 3 5 3 5 0V5Zm0 0c2-3 6-1 6 2 4 0 5 4 3 6 1 3-1 6-4 6 0 3-5 3-5 0M6 7c0 2 1 3 3 3m9-3c0 2-1 3-3 3',
  mri: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 8h8v8H8Zm4 0v8m-4-4h8',
  atlas: 'M3 3h18v18H3ZM3 9h18M3 15h18M9 3v18M15 3v18',
  network: 'M6 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm12 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm-6 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM8 7h8M7 9l4 7m6-7-4 7',
  region: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10m0-2v4m0 6v4M5 12h4m6 0h4',
  cuts: 'm3 8 9-5 9 5-9 5-9-5Zm0 4 9 5 9-5M3 16l9 5 9-5',
  display: 'M4 7h4m4 0h8M4 17h8m4 0h4M10 4v6m4 4v6',
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
