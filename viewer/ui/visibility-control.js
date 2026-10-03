import { t } from '../i18n/translations.js';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/** A reversible anatomical visibility action, independent of selection. */
export function createVisibilityControl({ key, ids, name, hiddenRegions, side, lang, onHide, onShow }) {
  const hiddenCount = ids.filter(id => hiddenRegions.has(id)).length;
  const shown = hiddenCount < ids.length;
  const i18n = t(lang, 'dissection');
  const sideName = t(lang, 'sides').words[side];
  const action = shown ? i18n.hidePart : i18n.showPart;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'visibility-control';
  button.dataset.visibilityKey = key;
  button.setAttribute('aria-pressed', String(shown));
  button.setAttribute('aria-label', action(name, sideName));
  button.title = action(name, sideName) + (hiddenCount && shown ? ` · ${i18n.partial}` : '');

  const icon = document.createElementNS(SVG_NAMESPACE, 'svg');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('fill', 'none');
  icon.setAttribute('stroke', 'currentColor');
  icon.setAttribute('stroke-width', '1.6');
  icon.setAttribute('stroke-linecap', 'round');
  icon.setAttribute('stroke-linejoin', 'round');
  icon.setAttribute('aria-hidden', 'true');
  const outline = document.createElementNS(SVG_NAMESPACE, 'path');
  outline.setAttribute('d', 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z');
  const pupil = document.createElementNS(SVG_NAMESPACE, 'circle');
  pupil.setAttribute('cx', '12');
  pupil.setAttribute('cy', '12');
  pupil.setAttribute('r', '3');
  icon.append(outline, pupil);
  if (!shown) {
    const slash = document.createElementNS(SVG_NAMESPACE, 'path');
    slash.setAttribute('d', 'm3 3 18 18');
    icon.append(slash);
  }
  button.append(icon);
  if (key.startsWith('group:')) {
    const marker = document.createElement('span');
    marker.textContent = t(lang, 'sides').glyphs[side];
    marker.setAttribute('aria-hidden', 'true');
    button.append(marker);
  }
  button.addEventListener('click', event => {
    event.stopPropagation();
    if (shown) onHide(ids);
    else onShow(ids);
  });
  return button;
}
