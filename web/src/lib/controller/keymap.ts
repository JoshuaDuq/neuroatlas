import { characterShortcutAllowed, isCharacterKey } from '../core/keyboard.ts';
import type { OwnKeysTarget } from '../core/keyboard.ts';
import { shortcutsAllowed } from '../core/state/session.ts';
import type { ShortcutTarget } from '../core/state/session.ts';
import type { OrbitTurn } from '../engine/api.ts';
import { DOLLY_KEYS, ORBIT_KEYS } from '../engine/render/keyboard-orbit.ts';
import type { Hemisphere, ViewName } from '../types/index.ts';
import type { View } from '../state/view.svelte.ts';

/** `1`–`6` choose these views (app.js:66); `0` chooses the oblique one. */
const DIGIT_VIEWS: ReadonlyMap<string, ViewName> = new Map([
  ['0', 'oblique'],
  ['1', 'left'],
  ['2', 'right'],
  ['3', 'anterior'],
  ['4', 'posterior'],
  ['5', 'superior'],
  ['6', 'inferior'],
]);

const HEMISPHERE_ORDER: readonly Hemisphere[] = ['both', 'left', 'right'];

/** What the keys read when one is pressed. */
export type KeymapState = Pick<
  View,
  | 'explorer'
  | 'selectedRegion'
  | 'selectedFunction'
  | 'selectedDeficit'
  | 'cortexVisible'
  | 'internalVisible'
  | 'spinalCordVisible'
  | 'hemisphere'
> & {
  /** The reader has not turned single-key shortcuts off (WCAG 2.1.4). */
  singleKeys: boolean;
  /** The diffusion MRI navigator is open. */
  diffusionMriOpen: boolean;
  /** The linked MRI dialog is open. */
  mprOpen: boolean;
  shortcutsOpen: boolean;
  /** Focus is inside a region's detail view, where Escape is Back. */
  focusInDetail: boolean;
  /** The tract reference is shown alone. */
  tractReferenceActive: boolean;
};

/** What the keys do: the same commands the controls call. */
export interface KeymapCommands {
  back(): void;
  clearSelection(): void;
  closeFunction(): void;
  closeDeficit(): void;
  /** Gives the tab in front the focus that a control hiding or disabling itself dropped. */
  rescueFocus(): void;
  toggleShortcuts(): void;
  showList(): void;
  /** Focuses the search field of the explorer in front, or its list where it has none. */
  focusSearch(explorer: KeymapState['explorer']): void;
  /** Moves focus to the next (1) or previous (-1) row of the region tree. */
  walkTree(step: 1 | -1): void;
  chooseView(view: ViewName): void;
  openDiffusionMri(): void;
  openMpr(): void;
  closeMpr(): void;
  focusSelection(): void;
  isolateSelection(): void;
  setCortexVisible(visible: boolean): void;
  setInternalVisible(visible: boolean): void;
  setSpinalCordVisible(visible: boolean): void;
  setHemisphere(hemisphere: Hemisphere): void;
  orbitBy(turn: OrbitTurn): void;
  dolly(factor: number): void;
}

export interface KeymapHost {
  /** The stage's canvas: the arrows and `+ = -` orbit and zoom only while it holds focus. */
  canvas: EventTarget;
  state(): KeymapState;
  commands: KeymapCommands;
}

type KeyTarget = EventTarget & ShortcutTarget & OwnKeysTarget;
type Press = KeyboardEvent & { target: KeyTarget | null };

/**
 * One keymap entry, reached once a key has passed the gates. The first entry whose `keys` match
 * takes the key, whether or not it then acts: a key the table names is never passed on.
 */
interface Command {
  keys(key: string): boolean;
  run(press: Press, commands: KeymapCommands, state: KeymapState): void;
}

const letters =
  (...names: string[]) =>
  (key: string) =>
    names.includes(key.toLowerCase());

const COMMANDS: readonly Command[] = [
  {
    keys: (key) => key === '?',
    run: (press, commands) => {
      press.preventDefault();
      commands.toggleShortcuts();
    },
  },
  {
    keys: (key) => key === '/',
    run: (press, commands, state) => {
      press.preventDefault();
      commands.showList();
      commands.focusSearch(state.explorer);
    },
  },
  {
    // The tree is walked from the anatomy only, and not from a tab, which has the arrows for itself.
    keys: (key) => key === 'ArrowDown' || key === 'ArrowUp',
    run: (press, commands, state) => {
      if (state.explorer !== 'anatomy' || press.target?.closest?.('[role="tab"]')) return;
      press.preventDefault();
      commands.walkTree(press.key === 'ArrowDown' ? 1 : -1);
    },
  },
  {
    keys: (key) => DIGIT_VIEWS.has(key),
    run: (press, commands) => commands.chooseView(DIGIT_VIEWS.get(press.key)!),
  },
  {
    keys: letters('m'),
    run: (press, commands, state) => {
      if (state.explorer === 'diffusion') {
        press.preventDefault();
        commands.openDiffusionMri();
      } else if (!state.tractReferenceActive) {
        press.preventDefault();
        commands.openMpr();
      }
    },
  },
  {
    keys: letters('f'),
    run: (press, commands, state) => {
      if (state.tractReferenceActive || !state.selectedRegion) return;
      press.preventDefault();
      commands.focusSelection();
    },
  },
  {
    keys: letters('i'),
    run: (press, commands, state) => {
      if (state.tractReferenceActive || !state.selectedRegion) return;
      press.preventDefault();
      commands.isolateSelection();
    },
  },
  {
    keys: letters('c'),
    run: (_press, commands, state) => {
      if (!state.tractReferenceActive) commands.setCortexVisible(!state.cortexVisible);
    },
  },
  {
    keys: letters('u'),
    run: (_press, commands, state) => {
      if (!state.tractReferenceActive) commands.setInternalVisible(!state.internalVisible);
    },
  },
  {
    keys: letters('s'),
    run: (_press, commands, state) => {
      if (!state.tractReferenceActive) commands.setSpinalCordVisible(!state.spinalCordVisible);
    },
  },
  {
    keys: letters('h'),
    run: (_press, commands, state) => {
      if (state.tractReferenceActive) return;
      const next = (HEMISPHERE_ORDER.indexOf(state.hemisphere) + 1) % HEMISPHERE_ORDER.length;
      commands.setHemisphere(HEMISPHERE_ORDER[next]);
    },
  },
];

const hasModifier = (event: KeyboardEvent) => event.metaKey || event.ctrlKey || event.altKey;

/** Escape steps back through the detail, the region, the open function, then the open deficit. */
function escape(commands: KeymapCommands, state: KeymapState): void {
  // The dialog closes itself; the selection under it is not the target.
  if (state.shortcutsOpen) return;
  // Inside a detail view Escape is Back; the selection stays for a second Escape.
  if (state.focusInDetail) {
    commands.back();
  } else if (state.selectedRegion) {
    commands.clearSelection();
    commands.rescueFocus();
  } else if (state.explorer === 'functions' && state.selectedFunction) {
    commands.closeFunction();
    commands.rescueFocus();
  } else if (state.selectedDeficit) {
    commands.closeDeficit();
    commands.rescueFocus();
  }
}

/** The arrows turn the model and `+ = -` zoom it, while the canvas itself holds focus. */
function orbitFromKeyboard(press: Press, { canvas, commands }: KeymapHost): boolean {
  if (press.target !== canvas) return false;
  const turn = ORBIT_KEYS[press.key as keyof typeof ORBIT_KEYS] as OrbitTurn | undefined;
  const dolly = DOLLY_KEYS[press.key as keyof typeof DOLLY_KEYS] as number | undefined;
  if (!turn && !dolly) return false;
  press.preventDefault();
  if (turn) commands.orbitBy(turn);
  else commands.dolly(dolly!);
  return true;
}

/** Decides what a `keydown` does (app.js:1882-1979). */
export function dispatchKey(event: KeyboardEvent, host: KeymapHost): void {
  // A control that handled the key itself, and a composition in progress, are not for the page.
  if (event.defaultPrevented || event.isComposing) return;
  const state = host.state();
  if (state.diffusionMriOpen) return;
  const press = event as Press;
  const { key } = press;
  if (state.mprOpen) {
    if (
      key.toLowerCase() === 'm' &&
      !hasModifier(press) &&
      shortcutsAllowed(press.target, key) &&
      characterShortcutAllowed(press.target, state.singleKeys)
    ) {
      press.preventDefault();
      host.commands.closeMpr();
    }
    return;
  }
  if (hasModifier(press)) return;
  if (key === 'Escape') {
    if (!state.tractReferenceActive) escape(host.commands, state);
    return;
  }
  if (!shortcutsAllowed(press.target, key)) return;
  if (orbitFromKeyboard(press, host)) return;
  // WCAG 2.1.4: one-character shortcuts can be turned off, and never act from a control that has
  // keys of its own.
  if (isCharacterKey(key) && !characterShortcutAllowed(press.target, state.singleKeys)) return;
  // With the shortcut sheet open only `?` acts: it shuts the sheet.
  if (state.shortcutsOpen && key !== '?') return;
  COMMANDS.find((command) => command.keys(key))?.run(press, host.commands, state);
}

/** One window listener, in the bubble phase so a control's own handling comes first. Returns its removal. */
export function installKeymap(host: KeymapHost): () => void {
  const onKeyDown = (event: KeyboardEvent) => dispatchKey(event, host);
  globalThis.addEventListener('keydown', onKeyDown);
  return () => globalThis.removeEventListener('keydown', onKeyDown);
}
