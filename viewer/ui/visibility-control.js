import { t } from '../i18n/translations.js';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/** What each control acts on, kept so a hide elsewhere can update it in place. */
const controls = new WeakMap();

/** Shown, hidden, or partly hidden: a group eye stays in view while anything under it is hidden. */
export function visibilityStateOf(ids, hiddenRegions) {
  const hiddenCount = ids.filter(id => hiddenRegions.has(id)).length;
  if (hiddenCount === ids.length && ids.length) return 'hidden';
  return hiddenCount ? 'partial' : 'shown';
}

/**
 * A reversible anatomical visibility action, independent of selection. The
 * label names the action, so no aria-pressed (a pressed "Hide" reads
 * backwards); `data-state` carries it for styling. Rows reach it by arrow key.
 * The side letter follows the eye on group and leaf rows alike.
 */
export function createVisibilityControl({ key, ids, name, hiddenRegions, side, lang, onHide, onShow }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'visibility-control';
  button.dataset.visibilityKey = key;
  button.tabIndex = -1;

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
  const slash = document.createElementNS(SVG_NAMESPACE, 'path');
  slash.setAttribute('d', 'm3 3 18 18');
  icon.append(outline, pupil);
  const marker = document.createElement('span');
  marker.className = 'visibility-side';
  marker.textContent = t(lang, 'sides').glyphs[side];
  marker.setAttribute('aria-hidden', 'true');
  button.append(icon, marker);
  controls.set(button, { ids, name, side, lang, icon, slash });
  syncVisibilityControl(button, hiddenRegions);
  button.addEventListener('click', event => {
    event.stopPropagation();
    if (button.dataset.state === 'shown') onHide(ids);
    else onShow(ids);
  });
  return button;
}

/** Bring a control up to date without replacing it, so focus stays where it is. */
export function syncVisibilityControl(button, hiddenRegions) {
  const { ids, name, side, lang, icon, slash } = controls.get(button);
  const state = visibilityStateOf(ids, hiddenRegions);
  const shown = state !== 'hidden';
  const i18n = t(lang, 'dissection');
  const label = (shown ? i18n.hidePart : i18n.showPart)(name, t(lang, 'sides').words[side]);
  button.dataset.state = shown ? 'shown' : 'hidden';
  button.dataset.partial = String(state === 'partial');
  button.setAttribute('aria-label', label);
  button.title = label + (state === 'partial' ? ` · ${i18n.partial}` : '');
  if (shown) slash.remove();
  else if (slash.parentNode !== icon) icon.append(slash);
}
