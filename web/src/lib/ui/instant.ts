/**
 * An open or close started from the keyboard carries no entry animation: a `click` fired by
 * Enter or Space has `detail === 0`, a pointer click has `detail >= 1`
 * (ui/chrome/sections.js:236, sheet.js:211).
 */
export const INSTANT_ATTRIBUTE = 'data-instant';

export const isKeyboardActivation = (event: UIEvent): boolean => event.detail === 0;

export function setInstant(element: Element, instant: boolean): void {
  element.toggleAttribute(INSTANT_ATTRIBUTE, instant);
}
