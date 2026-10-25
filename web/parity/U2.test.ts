// U2 parity: the legacy modules and the ports run the same scripted inputs and must leave
// identical traces. Deviations (docs/decisions/deviations/u2-*.md) are kept out of these scripts
// and tested where they differ.
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import { createAnnouncer as legacyCreateAnnouncer } from '../../viewer/ui/announce.js';
import { trackDrag as legacyTrackDrag } from '../../viewer/ui/drag.js';
import {
  bindRoving as legacyBindRoving,
  rovingStep as legacyRovingStep,
  tabStop as legacyTabStop,
} from '../../viewer/ui/roving.js';
import { startLanguage as legacyStartLanguage } from '../../viewer/state/boot.js';
import { createTheme as legacyCreateTheme } from '../../viewer/state/theme.js';
import { startLanguage } from '../src/lib/state/language.svelte.ts';
import {
  blockedStorage,
  fakeStorage,
  fakeSystem,
  installFakeDocument,
} from '../src/lib/state/test-support.ts';
import { createTheme } from '../src/lib/state/theme.svelte.ts';
import { attachAnnouncer, createDebouncedAnnouncer } from '../src/lib/ui/announcer.svelte.ts';
import { trackDrag } from '../src/lib/ui/drag.ts';
import { bindRoving, rovingStep, tabStop } from '../src/lib/ui/roving.ts';
import { fakeGroup } from '../src/lib/ui/test-support.ts';
import type { Spec } from '../src/lib/ui/test-support.ts';
import type { Language } from '../src/lib/types/index.ts';

describe('roving', () => {
  const KEYS = [
    'ArrowRight',
    'ArrowDown',
    'ArrowLeft',
    'ArrowUp',
    'Home',
    'End',
    'Enter',
    ' ',
    'Tab',
    'a',
  ];

  it('rovingStep agrees on every key, index and size', () => {
    for (const key of KEYS) {
      for (let count = 0; count <= 5; count += 1) {
        for (let index = -1; index <= count; index += 1) {
          assert.equal(rovingStep(key, index, count), legacyRovingStep(key, index, count));
        }
      }
    }
  });

  const SPECS: Spec[][] = [
    [{}, {}, { pressed: true }, {}],
    [{ pressed: true }, { disabled: true }, {}, {}],
    [{ disabled: true }, {}, { hidden: true, pressed: true }, {}],
    [{ disabled: true }, { disabled: true }],
    [{}],
    [],
  ];

  /** Every key from every member, then leaving the group, then a changed choice. */
  function trace(bind: (group: HTMLElement) => { sync(): void; dispose(): void }, specs: Spec[]) {
    const rig = fakeGroup(specs);
    const roving = bind(rig.group);
    const log: unknown[] = [rig.stops()];
    for (const start of rig.items.keys()) {
      for (const key of KEYS) {
        rig.items[start].focus();
        const handled = rig.press(key);
        log.push([start, key, handled, rig.doc.activeElement?.index ?? null, rig.stops()]);
      }
    }
    rig.leave();
    log.push(rig.stops());
    for (const item of rig.items) item.pressed = !item.pressed;
    roving.sync();
    log.push(rig.stops());
    roving.dispose();
    log.push(Object.keys(rig.listeners));
    return log;
  }

  it('a bound group leaves the same Tab stops, focus and handled keys', () => {
    for (const specs of SPECS) {
      assert.deepEqual(trace(bindRoving, specs), trace(legacyBindRoving as never, specs));
    }
  });

  it('tabStop agrees for every focused member', () => {
    for (const specs of SPECS) {
      const { items } = fakeGroup(specs);
      for (const focused of [null, ...items]) {
        assert.equal(
          tabStop(items as never, focused as never),
          legacyTabStop(items, focused as never),
        );
      }
    }
  });
});

describe('theme', () => {
  let page: ReturnType<typeof installFakeDocument>;
  beforeEach(() => {
    page = installFakeDocument({ light: '#ffffff', dark: '#1d1d1f' });
  });
  afterEach(() => page.uninstall());

  type Create = typeof createTheme;
  type Options = NonNullable<Parameters<Create>[1]>;

  /** Load with `stored`, then drive choices and OS flips, observing the document after each step. */
  function trace(
    create: Create | typeof legacyCreateTheme,
    stored: Record<string, string>,
    systemDark: boolean,
  ) {
    page.uninstall();
    page = installFakeDocument({ light: '#ffffff', dark: '#1d1d1f' });
    const storage = fakeStorage(stored);
    const system = fakeSystem(systemDark);
    const notified: string[] = [];
    const theme = (create as Create)((t) => notified.push(t), {
      storage,
      system,
    } as unknown as Options);
    const snapshot = () => ({
      current: theme.current,
      choice: theme.choice,
      theme: page.root.dataset.theme,
      switching: page.root.dataset.themeSwitching,
      meta: page.meta.content,
      stored: { ...storage.store },
      listeners: system.listeners.size,
      notified: [...notified],
    });
    const log = [snapshot()];
    const step = (action: () => void) => {
      action();
      log.push(snapshot());
      page.nextFrame();
      log.push(snapshot());
      page.nextFrame();
      log.push(snapshot());
    };
    for (const next of ['dark', 'light', 'system', 'system', 'dark', 'system'] as const) {
      step(() => theme.choose(next));
      step(() => system.flip(!system.matches));
    }
    assert.throws(() => theme.choose('sepia' as never), RangeError);
    log.push(snapshot());
    theme.dispose();
    log.push(snapshot());
    return log;
  }

  it('leaves the same document, storage, listeners and notifications', () => {
    const storedCases: Record<string, string>[] = [
      {},
      { 'planum.theme': 'dark' },
      { 'planum.theme': 'light' },
      { 'planum.theme': 'sepia' },
    ];
    for (const stored of storedCases) {
      for (const systemDark of [false, true]) {
        assert.deepEqual(
          trace(createTheme, stored, systemDark),
          trace(legacyCreateTheme, stored, systemDark),
        );
      }
    }
  });

  it('blocked storage themes the same way', () => {
    const run = (create: Create | typeof legacyCreateTheme) => {
      const system = fakeSystem(true);
      const theme = (create as Create)(() => {}, {
        storage: blockedStorage,
        system,
      } as unknown as Options);
      const seen = [theme.current];
      for (const next of ['light', 'system'] as const) {
        theme.choose(next);
        seen.push(theme.current);
      }
      return seen;
    };
    assert.deepEqual(run(createTheme), run(legacyCreateTheme));
  });
});

describe('startLanguage', () => {
  it('agrees with the legacy hash reader for every link and saved value', () => {
    const links: Array<[string, Language | undefined]> = [
      ['#lang=fr', 'fr'],
      ['#lang=en', 'en'],
      ['#atlas=destrieux', undefined],
      ['', undefined],
      ['#lang=de', undefined],
      ['#lang=en&lang=fr', undefined],
    ];
    for (const [hash, decoded] of links) {
      for (const saved of [null, 'en', 'fr', 'de']) {
        assert.equal(
          startLanguage(decoded, saved),
          legacyStartLanguage(hash, saved),
          `${hash} ${saved}`,
        );
      }
    }
  });
});

describe('announcer timing', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('the debounced path writes the same sentences at the same times', () => {
    const script: Array<[number, string]> = [
      [0, 'a'],
      [100, 'ab'],
      [400, 'abc'],
      [700, 'abc'],
      [499, 'abcd'],
      [50, 'abc'],
      [600, 'abc'],
      [10, 'x'],
      [500, 'x'],
      [600, 'y'],
      [600, 'x'],
    ];
    const run = (create: 'legacy' | 'new') => {
      const writes: Array<[number, string]> = [];
      const start = Date.now();
      const element = {
        set textContent(value: string) {
          writes.push([Date.now() - start, value]);
        },
      } as unknown as HTMLElement;
      const release = create === 'new' ? attachAnnouncer(element) : () => {};
      const say =
        create === 'legacy'
          ? legacyCreateAnnouncer(element)
          : createDebouncedAnnouncer().say.bind(null);
      for (const [wait, text] of script) {
        vi.advanceTimersByTime(wait);
        say(text);
      }
      vi.advanceTimersByTime(2000);
      release();
      return writes;
    };
    // The new announcer reports repeats as clear-then-set; the script never repeats a sentence
    // already in the region, so the two paths write identically.
    assert.deepEqual(run('new'), run('legacy'));
  });
});

describe('trackDrag', () => {
  it('ends at the same events with the same callbacks', () => {
    const events = ['input', 'change', 'pointerup', 'pointercancel', 'blur', 'focus', 'click'];
    const run = (track: typeof trackDrag) => {
      const log: unknown[] = [];
      const [a, b] = [new EventTarget(), new EventTarget()];
      const drag = track([a, b], () => log.push('end'));
      for (const first of events) {
        for (const second of events) {
          a.dispatchEvent(new Event(first));
          b.dispatchEvent(new Event(second));
          log.push([first, second, drag.dragging]);
        }
      }
      drag.dispose();
      a.dispatchEvent(new Event('input'));
      log.push(drag.dragging);
      return log;
    };
    assert.deepEqual(run(trackDrag), run(legacyTrackDrag as never));
  });
});
