import assert from 'node:assert/strict';
import { describe, it, onTestFinished, vi } from 'vitest';
import { ARIA_KEYSHORTCUTS, SHORTCUT_KEYS, dispatchKey, installKeymap } from './keymap.ts';
import type { KeymapCommands, KeymapHost, KeymapState } from './keymap.ts';

const STATE: KeymapState = {
  explorer: 'anatomy',
  selectedRegion: null,
  selectedFunction: null,
  selectedDeficit: null,
  cortexVisible: true,
  internalVisible: false,
  spinalCordVisible: false,
  hemisphere: 'both',
  singleKeys: true,
  diffusionMriOpen: false,
  mprOpen: false,
  shortcutsOpen: false,
  focusInDetail: false,
  tractReferenceActive: false,
};
const REGION = {} as KeymapState['selectedRegion'];

const COMMAND_NAMES = [
  'back',
  'clearSelection',
  'closeFunction',
  'closeDeficit',
  'rescueFocus',
  'toggleShortcuts',
  'showList',
  'focusSearch',
  'walkTree',
  'chooseView',
  'openDiffusionMri',
  'openMpr',
  'closeMpr',
  'focusSelection',
  'isolateSelection',
  'setCortexVisible',
  'setInternalVisible',
  'setSpinalCordVisible',
  'setHemisphere',
  'orbitBy',
  'dolly',
] as const;

function host(state: Partial<KeymapState> = {}) {
  const commands = Object.fromEntries(COMMAND_NAMES.map((name) => [name, vi.fn()])) as unknown as {
    [name in keyof KeymapCommands]: ReturnType<typeof vi.fn>;
  };
  const canvas = {} as EventTarget;
  const keymap: KeymapHost = {
    canvas,
    state: () => ({ ...STATE, ...state }),
    commands: commands as unknown as KeymapCommands,
  };
  return { keymap, commands, canvas };
}

function press(key: string, target: object | null = null, extra: object = {}) {
  const event = {
    key,
    target,
    defaultPrevented: false,
    isComposing: false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    preventDefault: vi.fn(),
    ...extra,
  };
  return event as unknown as KeyboardEvent & { preventDefault: ReturnType<typeof vi.fn> };
}

const calls = (command: ReturnType<typeof vi.fn>) => command.mock.calls.length;

describe('keymap', () => {
  it('leaves a key a control already handled, as Escape from the settings panel is', () => {
    const { keymap, commands } = host({ selectedRegion: REGION });
    dispatchKey(press('Escape', null, { defaultPrevented: true }), keymap);
    assert.equal(calls(commands.clearSelection), 0);
    dispatchKey(press('Escape'), keymap);
    assert.equal(calls(commands.clearSelection), 1);
  });

  it('steps Escape back through detail, region, function, deficit, each with focus rescue', () => {
    const detail = host({ focusInDetail: true, selectedRegion: REGION });
    dispatchKey(press('Escape'), detail.keymap);
    assert.equal(calls(detail.commands.back), 1);
    assert.equal(calls(detail.commands.clearSelection), 0);

    const order: string[] = [];
    const all = host({
      selectedRegion: REGION,
      explorer: 'functions',
      selectedFunction: 'f',
      selectedDeficit: 'd',
    });
    all.commands.clearSelection.mockImplementation(() => order.push('clear'));
    all.commands.rescueFocus.mockImplementation(() => order.push('rescue'));
    dispatchKey(press('Escape'), all.keymap);
    assert.deepEqual(order, ['clear', 'rescue']);

    const fn = host({ explorer: 'functions', selectedFunction: 'f', selectedDeficit: 'd' });
    dispatchKey(press('Escape'), fn.keymap);
    assert.equal(calls(fn.commands.closeFunction), 1);
    assert.equal(calls(fn.commands.rescueFocus), 1);
    assert.equal(calls(fn.commands.closeDeficit), 0);

    const deficit = host({ selectedDeficit: 'd' });
    dispatchKey(press('Escape'), deficit.keymap);
    assert.equal(calls(deficit.commands.closeDeficit), 1);
    assert.equal(calls(deficit.commands.rescueFocus), 1);
  });

  it('does nothing on Escape while the shortcut sheet is open or the tract reference is shown', () => {
    for (const state of [{ shortcutsOpen: true }, { tractReferenceActive: true }]) {
      const { keymap, commands } = host({ ...state, selectedRegion: REGION });
      dispatchKey(press('Escape'), keymap);
      assert.equal(calls(commands.clearSelection), 0);
    }
  });

  it('leaves Escape with a modifier, or during a composition, alone', () => {
    const { keymap, commands } = host({ selectedRegion: REGION });
    dispatchKey(press('Escape', null, { ctrlKey: true }), keymap);
    dispatchKey(press('Escape', null, { isComposing: true }), keymap);
    assert.equal(calls(commands.clearSelection), 0);
  });

  it('is inert while the diffusion MRI is open, whatever the key', () => {
    const { keymap, commands } = host({ diffusionMriOpen: true });
    for (const key of ['m', '?', 'Escape', '1']) dispatchKey(press(key), keymap);
    assert.ok(Object.values(commands).every((command) => calls(command) === 0));
  });

  it('walks the tree with the arrows from the page but leaves a focused tab its own arrows', () => {
    const { keymap, commands } = host();
    const tab = { closest: (selector: string) => (selector === '[role="tab"]' ? {} : null) };
    const down = press('ArrowDown', tab);
    dispatchKey(down, keymap);
    assert.equal(calls(commands.walkTree), 0);
    assert.equal(calls(down.preventDefault), 0);
    dispatchKey(press('ArrowDown', { closest: () => null }), keymap);
    assert.deepEqual(commands.walkTree.mock.calls, [[1]]);
  });

  it('keeps the single-key shortcuts from a control in a marked region, and from all when turned off', () => {
    const { keymap, commands } = host();
    const marked = (control: boolean) => ({
      matches: () => control,
      closest: (selector: string) => (selector === '[data-own-keys]' ? {} : null),
    });
    dispatchKey(press('h', marked(true)), keymap);
    assert.equal(calls(commands.setHemisphere), 0);
    // A tree row in a marked region is not a control with keys of its own.
    dispatchKey(press('h', marked(false)), keymap);
    assert.deepEqual(commands.setHemisphere.mock.calls, [['left']]);
    const off = host({ singleKeys: false });
    dispatchKey(press('h'), off.keymap);
    assert.equal(calls(off.commands.setHemisphere), 0);
  });

  it('gives the commands the options a key press carries', () => {
    const { keymap, commands } = host({ selectedRegion: REGION });
    dispatchKey(press('?'), keymap);
    dispatchKey(press('f'), keymap);
    dispatchKey(press('3'), keymap);
    dispatchKey(press('m'), keymap);
    assert.deepEqual(commands.toggleShortcuts.mock.calls, [[{ instant: true }]]);
    assert.deepEqual(commands.focusSelection.mock.calls, [[{ immediate: true }]]);
    assert.deepEqual(commands.chooseView.mock.calls, [['anterior', { immediate: true }]]);
    assert.deepEqual(commands.openMpr.mock.calls, [[{ instant: true }]]);
  });

  it('keeps f from the tract reference and with nothing selected, and every shortcut but ? from the open sheet', () => {
    const reference = host({ tractReferenceActive: true, selectedRegion: REGION });
    dispatchKey(press('f'), reference.keymap);
    assert.equal(calls(reference.commands.focusSelection), 0);
    const none = host();
    dispatchKey(press('f'), none.keymap);
    assert.equal(calls(none.commands.focusSelection), 0);
    const sheet = host({ shortcutsOpen: true });
    for (const key of ['c', '/', '1', 'm']) dispatchKey(press(key), sheet.keymap);
    assert.ok(Object.values(sheet.commands).every((command) => calls(command) === 0));
    dispatchKey(press('?'), sheet.keymap);
    assert.equal(calls(sheet.commands.toggleShortcuts), 1);
  });

  it('zooms and turns on the canvas even when single-key shortcuts are off', () => {
    const { keymap, commands, canvas } = host({ singleKeys: false });
    dispatchKey(press('+', canvas), keymap);
    dispatchKey(press('-', canvas), keymap);
    assert.equal(calls(commands.dolly), 2);
    assert.ok((commands.dolly.mock.calls[0][0] as number) < 1);
    dispatchKey(press('ArrowLeft', canvas), keymap);
    assert.equal(calls(commands.orbitBy), 1);
  });

  describe('with the linked MRI open (app.test.js:29-46)', () => {
    const mri = (state: Partial<KeymapState>, key: string, target: object | null, extra = {}) => {
      const { keymap, commands } = host({ mprOpen: true, ...state });
      const event = press(key, target, extra);
      dispatchKey(event, keymap);
      return {
        closed: calls(commands.closeMpr) === 1,
        prevented: calls(event.preventDefault) === 1,
      };
    };
    const NOTHING = { closed: false, prevented: false };

    it('respects the disabled single-key preference', () => {
      assert.deepEqual(mri({ singleKeys: false }, 'm', { tagName: 'BUTTON' }), NOTHING);
    });

    it('leaves editable inputs and modified keys alone', () => {
      for (const target of [
        { tagName: 'INPUT', type: 'text' },
        { tagName: 'TEXTAREA' },
        { isContentEditable: true },
      ]) {
        assert.deepEqual(mri({}, 'm', target), NOTHING);
      }
      for (const modifier of ['ctrlKey', 'metaKey', 'altKey']) {
        assert.deepEqual(mri({}, 'm', { tagName: 'BUTTON' }, { [modifier]: true }), NOTHING);
      }
    });

    it('ignores a key used by an input composition', () => {
      assert.deepEqual(mri({}, 'm', { tagName: 'BUTTON' }, { isComposing: true }), NOTHING);
    });

    it('closes on M and leaves Escape to the dialog', () => {
      assert.deepEqual(mri({}, 'M', { tagName: 'BUTTON' }), { closed: true, prevented: true });
      assert.deepEqual(mri({ singleKeys: false }, 'Escape', { tagName: 'BUTTON' }), NOTHING);
    });
  });

  it('closes a function only from the Functions explorer', () => {
    const anatomy = host({ explorer: 'anatomy', selectedFunction: 'f' });
    dispatchKey(press('Escape'), anatomy.keymap);
    assert.equal(calls(anatomy.commands.closeFunction), 0);
    const functions = host({ explorer: 'functions', selectedFunction: 'f' });
    dispatchKey(press('Escape'), functions.keymap);
    assert.equal(calls(functions.commands.closeFunction), 1);
  });

  it('goes Back from the detail without rescuing focus, and does nothing with nothing open', () => {
    const detail = host({ focusInDetail: true });
    dispatchKey(press('Escape'), detail.keymap);
    assert.equal(calls(detail.commands.back), 1);
    assert.equal(calls(detail.commands.rescueFocus), 0);
    const idle = host();
    dispatchKey(press('Escape'), idle.keymap);
    assert.ok(Object.values(idle.commands).every((command) => calls(command) === 0));
  });

  it('walks the tree with the arrows only in the Anatomy explorer', () => {
    for (const explorer of ['functions', 'deficits', 'circuits', 'diffusion'] as const) {
      const { keymap, commands } = host({ explorer });
      const down = press('ArrowDown');
      dispatchKey(down, keymap);
      dispatchKey(press('ArrowUp'), keymap);
      assert.equal(calls(commands.walkTree), 0, explorer);
      assert.equal(calls(down.preventDefault), 0, explorer);
    }
    const { keymap, commands } = host();
    dispatchKey(press('ArrowDown'), keymap);
    dispatchKey(press('ArrowUp'), keymap);
    assert.deepEqual(commands.walkTree.mock.calls, [[1], [-1]]);
  });

  it('opens the diffusion MRI with m in the Diffusion explorer, even under the tract reference', () => {
    const { keymap, commands } = host({ explorer: 'diffusion', tractReferenceActive: true });
    const event = press('m');
    dispatchKey(event, keymap);
    assert.equal(calls(commands.openDiffusionMri), 1);
    assert.equal(calls(commands.openMpr), 0);
    assert.equal(calls(event.preventDefault), 1);
    const reference = host({ explorer: 'anatomy', tractReferenceActive: true });
    dispatchKey(press('m'), reference.keymap);
    assert.equal(calls(reference.commands.openMpr), 0);
  });

  it('takes the letters in either case and toggles the display without cancelling the key', () => {
    const { keymap, commands } = host({ selectedRegion: REGION, hemisphere: 'right' });
    for (const key of ['C', 'U', 'S', 'H']) {
      const event = press(key);
      dispatchKey(event, keymap);
      assert.equal(calls(event.preventDefault), 0, key);
    }
    assert.deepEqual(commands.setCortexVisible.mock.calls, [[false]]);
    assert.deepEqual(commands.setInternalVisible.mock.calls, [[true]]);
    assert.deepEqual(commands.setSpinalCordVisible.mock.calls, [[true]]);
    assert.deepEqual(commands.setHemisphere.mock.calls, [['both']]);
    dispatchKey(press('F'), keymap);
    dispatchKey(press('I'), keymap);
    dispatchKey(press('M'), keymap);
    assert.equal(calls(commands.focusSelection), 1);
    assert.equal(calls(commands.isolateSelection), 1);
    assert.equal(calls(commands.openMpr), 1);
  });

  it('cycles the hemisphere both, left, right', () => {
    for (const [from, to] of [
      ['both', 'left'],
      ['left', 'right'],
      ['right', 'both'],
    ] as const) {
      const { keymap, commands } = host({ hemisphere: from });
      dispatchKey(press('h'), keymap);
      assert.deepEqual(commands.setHemisphere.mock.calls, [[to]]);
    }
  });

  it('chooses the view each digit names, and ignores the others', () => {
    const { keymap, commands } = host();
    const views: Record<string, string> = {
      '0': 'oblique',
      '1': 'left',
      '2': 'right',
      '3': 'anterior',
      '4': 'posterior',
      '5': 'superior',
      '6': 'inferior',
    };
    for (const key of ['0', '1', '2', '3', '4', '5', '6', '7', '9']) {
      commands.chooseView.mockClear();
      dispatchKey(press(key), keymap);
      assert.deepEqual(
        commands.chooseView.mock.calls.map(([view]) => view),
        key in views ? [views[key]] : [],
        `key ${key}`,
      );
    }
  });

  it('writes ? as Shift+/ for aria-keyshortcuts and keeps the other keys as matched', () => {
    assert.equal(ARIA_KEYSHORTCUTS.shortcuts, 'Shift+/');
    assert.equal(SHORTCUT_KEYS.shortcuts, '?');
    assert.equal(ARIA_KEYSHORTCUTS.cortex, SHORTCUT_KEYS.cortex);
  });

  it('adds one bubble-phase keydown listener on the window and removes it', () => {
    type Listener = (event: KeyboardEvent) => void;
    const listeners = new Map<Listener, [string, unknown]>();
    vi.stubGlobal('addEventListener', (type: string, listener: Listener, options?: unknown) =>
      listeners.set(listener, [type, options]),
    );
    vi.stubGlobal('removeEventListener', (type: string, listener: Listener, options?: unknown) => {
      assert.deepEqual(listeners.get(listener), [type, options]);
      listeners.delete(listener);
    });
    onTestFinished(() => void vi.unstubAllGlobals());
    const { keymap, commands } = host();
    const remove = installKeymap(keymap);
    assert.equal(listeners.size, 1);
    const [[listener, [type, options]]] = [...listeners];
    assert.equal(type, 'keydown');
    // Bubble phase: neither `capture` nor a bare `true`.
    assert.ok(options === undefined || options === false);
    listener(press('?'));
    assert.equal(calls(commands.toggleShortcuts), 1);
    remove();
    assert.equal(listeners.size, 0);
  });
});

/** A fixed table of key presses and what they do: the commands issued, in order, and whether the key is cancelled. */
describe('keymap outcomes', () => {
  const marked = (control: boolean) => ({
    tagName: 'BUTTON',
    matches: () => control,
    closest: (selector: string) => (selector === '[data-own-keys]' ? {} : null),
  });
  const TEXT = { tagName: 'INPUT', type: 'text' };
  const RANGE = { tagName: 'INPUT', type: 'range' };
  const CHECKBOX = { tagName: 'INPUT', type: 'checkbox' };

  function outcome(
    state: Partial<KeymapState>,
    key: string,
    target: object | 'canvas' | null = null,
    extra: object = {},
  ) {
    const log: string[] = [];
    const { keymap, commands, canvas } = host(state);
    for (const name of COMMAND_NAMES) {
      commands[name].mockImplementation((...args: unknown[]) =>
        log.push(args.length ? `${name}(${JSON.stringify(args)})` : name),
      );
    }
    const event = press(key, target === 'canvas' ? canvas : target, extra);
    dispatchKey(event, keymap);
    return { log, prevented: calls(event.preventDefault) > 0 };
  }

  it('KEY-01 leaves a key with Ctrl, Meta or Alt to the browser, whatever the key', () => {
    for (const key of [
      'Escape',
      '?',
      '/',
      '0',
      '1',
      'f',
      'i',
      'c',
      'u',
      's',
      'h',
      'm',
      'ArrowDown',
    ]) {
      for (const modifier of ['ctrlKey', 'metaKey', 'altKey']) {
        assert.deepEqual(
          outcome({ selectedRegion: REGION }, key, null, { [modifier]: true }),
          { log: [], prevented: false },
          `${key} with ${modifier}`,
        );
      }
    }
  });

  it('KEY-01 leaves Ctrl, Meta and Alt with a zoom or arrow key on the focused canvas to the browser', () => {
    for (const key of ['+', '=', '-', 'ArrowLeft', 'c']) {
      for (const modifier of ['ctrlKey', 'metaKey', 'altKey']) {
        assert.deepEqual(
          outcome({}, key, 'canvas', { [modifier]: true }),
          { log: [], prevented: false },
          `${key} with ${modifier}`,
        );
      }
    }
  });

  it('KEY-01 still acts with Shift, and leaves a composing or already handled key alone', () => {
    assert.deepEqual(outcome({}, 'H', null, { shiftKey: true }), {
      log: ['setHemisphere(["left"])'],
      prevented: false,
    });
    for (const key of ['c', '1', '?', 'Escape']) {
      for (const extra of [{ isComposing: true }, { defaultPrevented: true }]) {
        assert.deepEqual(outcome({ selectedRegion: REGION }, key, null, extra), {
          log: [],
          prevented: false,
        });
      }
    }
  });

  it('KEY-04 Escape in a text field that did not use it still clears the selection', () => {
    assert.deepEqual(outcome({ selectedRegion: REGION }, 'Escape', TEXT), {
      log: ['clearSelection', 'rescueFocus'],
      prevented: false,
    });
    assert.deepEqual(
      outcome({ selectedRegion: REGION }, 'Escape', TEXT, { defaultPrevented: true }),
      {
        log: [],
        prevented: false,
      },
    );
  });

  it('KEY-05 a text field, textarea, select or editable element keeps every shortcut key', () => {
    const state = { selectedRegion: REGION };
    for (const target of [
      TEXT,
      { tagName: 'INPUT', type: 'search' },
      { tagName: 'INPUT' },
      { tagName: 'TEXTAREA' },
      { tagName: 'SELECT' },
      { tagName: 'DIV', isContentEditable: true },
    ]) {
      for (const key of ['c', 'h', 'f', '1', '/', '?', 'm', 'ArrowDown']) {
        assert.deepEqual(outcome(state, key, target), { log: [], prevented: false }, key);
      }
    }
  });

  it('KEY-05 a slider keeps its arrows but not the other keys, and a checkbox keeps nothing', () => {
    assert.deepEqual(outcome({}, 'ArrowDown', RANGE), { log: [], prevented: false });
    assert.deepEqual(outcome({}, 'c', RANGE), {
      log: ['setCortexVisible([false])'],
      prevented: false,
    });
    assert.deepEqual(outcome({}, 'c', CHECKBOX), {
      log: ['setCortexVisible([false])'],
      prevented: false,
    });
  });

  it('KEY-06 a button in a marked region keeps h; a plain row there, or single keys off, decide', () => {
    assert.deepEqual(outcome({}, 'h', marked(true)), { log: [], prevented: false });
    assert.deepEqual(outcome({}, 'h', marked(false)), {
      log: ['setHemisphere(["left"])'],
      prevented: false,
    });
    assert.deepEqual(outcome({ singleKeys: false }, 'h'), { log: [], prevented: false });
    // The question mark is a character key too.
    assert.deepEqual(outcome({ singleKeys: false }, '?'), { log: [], prevented: false });
    // Escape and the arrows are not.
    assert.deepEqual(outcome({ singleKeys: false, selectedDeficit: 'd' }, 'Escape'), {
      log: ['closeDeficit', 'rescueFocus'],
      prevented: false,
    });
    assert.deepEqual(outcome({ singleKeys: false }, 'ArrowDown'), {
      log: ['walkTree([1])'],
      prevented: true,
    });
  });

  it('KEY-07 on the canvas the arrows turn and + = - zoom, each cancelled, with single keys off', () => {
    const run = (key: string) => {
      const log: string[] = [];
      const { keymap, commands } = host({ singleKeys: false });
      commands.orbitBy.mockImplementation(() => log.push('orbitBy'));
      commands.dolly.mockImplementation((factor: number) =>
        log.push(`dolly ${factor < 1 ? 'in' : 'out'}`),
      );
      const event = press(key, keymap.canvas);
      dispatchKey(event, keymap);
      return { log, prevented: calls(event.preventDefault) === 1 };
    };
    assert.deepEqual(run('+'), { log: ['dolly in'], prevented: true });
    assert.deepEqual(run('='), { log: ['dolly in'], prevented: true });
    assert.deepEqual(run('-'), { log: ['dolly out'], prevented: true });
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) {
      assert.deepEqual(run(key), { log: ['orbitBy'], prevented: true }, key);
    }
  });

  it('KEY-09 / shows the list and focuses the search of the explorer in front', () => {
    for (const explorer of ['anatomy', 'functions', 'deficits', 'circuits', 'diffusion'] as const) {
      assert.deepEqual(outcome({ explorer }, '/'), {
        log: ['showList', `focusSearch(["${explorer}"])`],
        prevented: true,
      });
    }
  });

  it('KEY-12 M opens the linked MRI, but not under the tract reference', () => {
    assert.deepEqual(outcome({}, 'm'), { log: ['openMpr([{"instant":true}])'], prevented: true });
    assert.deepEqual(outcome({ tractReferenceActive: true }, 'M'), { log: [], prevented: false });
    assert.deepEqual(outcome({ explorer: 'diffusion' }, 'M'), {
      log: ['openDiffusionMri'],
      prevented: true,
    });
  });

  it('KEY-13 F and I act only with a selection, in either case, and cancel only then', () => {
    for (const [key, command] of [
      ['f', 'focusSelection([{"immediate":true}])'],
      ['F', 'focusSelection([{"immediate":true}])'],
      ['i', 'isolateSelection'],
      ['I', 'isolateSelection'],
    ]) {
      assert.deepEqual(outcome({ selectedRegion: REGION }, key), {
        log: [command],
        prevented: true,
      });
      assert.deepEqual(outcome({}, key), { log: [], prevented: false });
      assert.deepEqual(outcome({ selectedRegion: REGION, tractReferenceActive: true }, key), {
        log: [],
        prevented: false,
      });
    }
  });

  it('KEY-14 C, U, S and H do nothing under the tract reference', () => {
    for (const key of ['c', 'u', 's', 'h', 'C', 'U', 'S', 'H']) {
      assert.deepEqual(outcome({ tractReferenceActive: true }, key), { log: [], prevented: false });
    }
  });

  it('KEY-01 Enter, Space, Tab, a and 7 do nothing and are not cancelled', () => {
    for (const key of ['Enter', ' ', 'Tab', 'a', '7']) {
      assert.deepEqual(
        outcome({ selectedRegion: REGION }, key),
        { log: [], prevented: false },
        key,
      );
    }
  });

  it('KEY-08 only ? acts while the sheet is open, and it is cancelled', () => {
    assert.deepEqual(outcome({ shortcutsOpen: true }, '?'), {
      log: ['toggleShortcuts([{"instant":true}])'],
      prevented: true,
    });
    for (const key of ['/', 'ArrowDown', '0', 'f', 'h', 'm', 'Escape']) {
      assert.deepEqual(outcome({ shortcutsOpen: true, selectedRegion: REGION }, key), {
        log: [],
        prevented: false,
      });
    }
  });
});
