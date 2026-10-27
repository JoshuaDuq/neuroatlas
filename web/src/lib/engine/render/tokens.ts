/** A CSS custom property's current value; the token layer owns both palettes. */
export const token = (name: string): string =>
  typeof document === 'undefined'
    ? ''
    : getComputedStyle(document.documentElement).getPropertyValue(name).trim();
