// The two timings of the legacy announcer (ui/announce.js and the direct writes), and clear-then-set.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { announce, attachAnnouncer, createDebouncedAnnouncer } from './announcer.svelte.ts';

/** Records every value the live region held, which is what a screen reader reacts to. */
function fakeRegion() {
  const writes: string[] = [];
  let text = '';
  const element = {
    get textContent() {
      return text;
    },
    set textContent(value: string) {
      text = value;
      writes.push(value);
    },
  };
  return { element: element as unknown as HTMLElement, writes };
}

let region: ReturnType<typeof fakeRegion>;
let release: () => void;
beforeEach(() => {
  vi.useFakeTimers();
  region = fakeRegion();
  release = attachAnnouncer(region.element);
});
afterEach(() => {
  release();
  vi.useRealTimers();
});

describe('announce (immediate)', () => {
  test('writes at once', () => {
    announce('Loading failed');
    expect(region.writes).toEqual(['Loading failed']);
  });

  test('a repeated sentence is cleared, then set after a gap, so it is spoken again', () => {
    announce('Hemisphere: left');
    announce('Hemisphere: left');
    expect(region.writes).toEqual(['Hemisphere: left', '']);
    vi.advanceTimersByTime(99);
    expect(region.writes).toEqual(['Hemisphere: left', '']);
    vi.advanceTimersByTime(1);
    expect(region.writes).toEqual(['Hemisphere: left', '', 'Hemisphere: left']);
  });

  test('a new sentence during the gap replaces the pending repeat', () => {
    announce('a');
    announce('a');
    announce('b');
    vi.advanceTimersByTime(1000);
    expect(region.writes).toEqual(['a', '', 'b']);
    expect(region.element.textContent).toBe('b');
  });

  test('fails fast when no live region is attached', () => {
    release();
    expect(() => announce('x')).toThrow('before attachAnnouncer');
  });
});

describe('createDebouncedAnnouncer', () => {
  test('says only the last text, 500 ms after the last call', () => {
    const say = createDebouncedAnnouncer();
    say.say('1 result');
    vi.advanceTimersByTime(499);
    say.say('12 results');
    vi.advanceTimersByTime(499);
    expect(region.writes).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(region.writes).toEqual(['12 results']);
  });

  test('says nothing for what it already said, even when typing returns to it', () => {
    const say = createDebouncedAnnouncer();
    say.say('3 results');
    vi.advanceTimersByTime(500);
    say.say('4 results');
    vi.advanceTimersByTime(200);
    say.say('3 results');
    vi.advanceTimersByTime(1000);
    expect(region.writes).toEqual(['3 results']);
  });

  test('reset forgets the last sentence, so it may be said again', () => {
    const say = createDebouncedAnnouncer();
    say.say('3 results');
    vi.advanceTimersByTime(500);
    say.reset();
    say.say('3 results');
    vi.advanceTimersByTime(500);
    expect(region.writes).toEqual(['3 results', '']);
    vi.advanceTimersByTime(100);
    expect(region.writes).toEqual(['3 results', '', '3 results']);
  });

  test('reset and dispose cancel what is pending', () => {
    const say = createDebouncedAnnouncer();
    say.say('a');
    say.reset();
    say.say('b');
    say.dispose();
    vi.advanceTimersByTime(1000);
    expect(region.writes).toEqual([]);
  });

  test('a custom delay is honoured', () => {
    createDebouncedAnnouncer(50).say('quick');
    vi.advanceTimersByTime(50);
    expect(region.writes).toEqual(['quick']);
  });
});

test('UI-19: a scripted typing session writes each settled sentence once, at its fixed time', () => {
  const say = createDebouncedAnnouncer();
  const start = Date.now();
  const writes: Array<[number, string]> = [];
  const stop = vi.spyOn(region.element, 'textContent', 'set');
  stop.mockImplementation((value: string) => {
    writes.push([Date.now() - start, value]);
  });
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
  for (const [wait, text] of script) {
    vi.advanceTimersByTime(wait);
    say.say(text);
  }
  vi.advanceTimersByTime(2000);
  expect(writes).toEqual([
    [1000, 'abc'],
    [2859, 'x'],
    [3959, 'y'],
    [4559, 'x'],
  ]);
});
