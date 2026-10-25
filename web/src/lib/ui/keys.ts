/**
 * Marks a pressable control or field that uses letters or digits itself. The global
 * single-key shortcuts (S5a) skip a target carrying it, so an `h` pressed on a hemisphere
 * button does not also change the hemisphere. Replaces the legacy `#sheet, #masthead,
 * #stage-dock` id selector (ui/chrome/shortcuts.js:9-10), which only covered three containers.
 */
export const OWN_KEYS_ATTRIBUTE = 'data-own-keys';

export const OWN_KEYS_SELECTOR = `[${OWN_KEYS_ATTRIBUTE}]`;
