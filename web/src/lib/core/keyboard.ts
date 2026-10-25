import { OWN_KEYS_SELECTOR } from '../ui/keys.ts';

/** The part of a focused element that says whether it has keys of its own. */
export interface OwnKeysTarget {
  closest?(selector: string): unknown;
}

/** Letters, digits and symbols: the keys WCAG 2.1.4 lets a reader turn off. */
export const isCharacterKey = (key: unknown): key is string =>
  typeof key === 'string' && [...key].length === 1;

/**
 * Whether a one-character shortcut may act. Off entirely if the reader turned them off, and never
 * from a control that marks its keys as its own (`data-own-keys`): an `h` pressed on a hemisphere
 * button would otherwise change the hemisphere.
 */
export function characterShortcutAllowed(
  target: OwnKeysTarget | null | undefined,
  enabled: boolean,
): boolean {
  if (!enabled) return false;
  return !target?.closest?.(OWN_KEYS_SELECTOR);
}
