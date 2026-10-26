/**
 * Marks a region whose controls use letters or digits themselves: the masthead, the panels
 * and the stage dock (legacy `#sheet, #masthead, #stage-dock`, ui/chrome/shortcuts.js:9-10).
 * The global single-key shortcuts (S5a) skip a pressable control inside a marked region, so an
 * `h` pressed on a hemisphere button does not also change the hemisphere. Controls outside
 * those regions are not marked (conductor decision 7 on #4).
 */
export const OWN_KEYS_ATTRIBUTE = 'data-own-keys';

export const OWN_KEYS_SELECTOR = `[${OWN_KEYS_ATTRIBUTE}]`;
