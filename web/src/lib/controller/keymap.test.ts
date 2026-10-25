import assert from 'node:assert/strict';
import { describe, it, onTestFinished, vi } from 'vitest';
import { dispatchKey, installKeymap } from './keymap.ts';
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

  it('keeps the single-key shortcuts from a control with own keys, and from all when turned off', () => {
    const { keymap, commands } = host();
    const owned = { closest: (selector: string) => (selector === '[data-own-keys]' ? {} : null) };
    dispatchKey(press('h', owned), keymap);
    assert.equal(calls(commands.setHemisphere), 0);
    dispatchKey(press('h'), keymap);
    assert.deepEqual(commands.setHemisphere.mock.calls, [['left']]);
    const off = host({ singleKeys: false });
    dispatchKey(press('h'), off.keymap);
    assert.equal(calls(off.commands.setHemisphere), 0);
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

  it('adds one window listener and removes it', () => {
    type Listener = (event: KeyboardEvent) => void;
    const listeners = new Set<Listener>();
    vi.stubGlobal('addEventListener', (_type: string, listener: Listener) =>
      listeners.add(listener),
    );
    vi.stubGlobal('removeEventListener', (_type: string, listener: Listener) =>
      listeners.delete(listener),
    );
    onTestFinished(() => void vi.unstubAllGlobals());
    const { keymap, commands } = host();
    const remove = installKeymap(keymap);
    assert.equal(listeners.size, 1);
    [...listeners][0](press('?'));
    assert.equal(calls(commands.toggleShortcuts), 1);
    remove();
    assert.equal(listeners.size, 0);
  });
});
