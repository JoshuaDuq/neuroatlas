// Ported from viewer/ui/tooltip.test.js. The 150 ms departure delay is replaced by the grace
// area (deviations/u5-tooltip-grace-area.md), so its three cases assert that instead.
import { describe, expect, test } from 'vitest';
import {
  SHOW_DELAY,
  SKIP_WINDOW,
  createTooltipTiming,
  describedBy,
  inGraceArea,
} from './tooltip.ts';

// A clock and timers the test advances by hand.
function harness() {
  let time = 0;
  let timers: { at: number; callback: () => void }[] = [];
  const shown: [string, boolean][] = [];
  const hidden: string[] = [];
  const timing = createTooltipTiming<string>({
    now: () => time,
    schedule: (callback, delay) => {
      const timer = { at: time + delay, callback };
      timers.push(timer);
      return timer;
    },
    cancel: (timer) => {
      timers = timers.filter((other) => other !== timer);
    },
    show: (trigger, instant) => shown.push([trigger, instant]),
    hide: (trigger) => hidden.push(trigger),
  });
  const advance = (ms: number) => {
    time += ms;
    const due = timers.filter((timer) => timer.at <= time);
    timers = timers.filter((timer) => timer.at > time);
    due.forEach((timer) => timer.callback());
  };
  return { timing, shown, hidden, advance };
}

describe('tooltip timing', () => {
  test('a first hover waits the delay, then shows with its entry', () => {
    const { timing, shown, advance } = harness();
    timing.enter('save');
    advance(SHOW_DELAY - 1);
    expect(shown).toEqual([]);
    advance(1);
    expect(shown).toEqual([['save', false]]);
    expect(timing.open).toBe('save');
  });

  test('the delays are 500 ms and 300 ms', () => {
    expect([SHOW_DELAY, SKIP_WINDOW]).toEqual([500, 300]);
  });

  test('leaving before the delay shows nothing', () => {
    const { timing, shown, advance } = harness();
    timing.enter('save');
    advance(200);
    timing.leave('save');
    advance(SHOW_DELAY);
    expect(shown).toEqual([]);
  });

  test('moving within one trigger does not restart its delay', () => {
    const { timing, shown, advance } = harness();
    timing.enter('save');
    advance(300);
    timing.enter('save');
    advance(SHOW_DELAY - 300);
    expect(shown).toEqual([['save', false]]);
  });

  test('the next tooltip within the window after one closes appears at once, without its entry', () => {
    const { timing, shown, hidden, advance } = harness();
    timing.enter('save');
    advance(SHOW_DELAY);
    timing.leave('save');
    expect(hidden).toEqual(['save']);
    advance(SKIP_WINDOW - 1);
    timing.enter('fullscreen');
    expect(shown.at(-1)).toEqual(['fullscreen', true]);
  });

  test('after the window the delay applies again', () => {
    const { timing, shown, advance } = harness();
    timing.enter('save');
    advance(SHOW_DELAY);
    timing.leave('save');
    advance(SKIP_WINDOW);
    timing.enter('fullscreen');
    expect(shown).toHaveLength(1);
    advance(SHOW_DELAY);
    expect(shown.at(-1)).toEqual(['fullscreen', false]);
  });

  test('keyboard focus shows at once, and moving focus hands over without a gap', () => {
    const { timing, shown, hidden } = harness();
    timing.enter('save', { immediate: true });
    expect(shown).toEqual([['save', true]]);
    timing.enter('fullscreen', { immediate: true });
    expect(hidden).toEqual(['save']);
    expect(shown.at(-1)).toEqual(['fullscreen', true]);
    expect(timing.open).toBe('fullscreen');
  });

  test('a dismissal hides the open tooltip and cancels a waiting one', () => {
    const { timing, shown, hidden, advance } = harness();
    timing.enter('save', { immediate: true });
    timing.dismiss();
    expect(hidden).toEqual(['save']);
    expect(timing.open).toBeNull();
    advance(SKIP_WINDOW);
    timing.enter('fullscreen');
    timing.dismiss();
    advance(SHOW_DELAY);
    expect(shown).toHaveLength(1);
  });

  test('leaving a trigger that is not open does not close the open one', () => {
    const { timing, hidden } = harness();
    timing.enter('save', { immediate: true });
    timing.leave('fullscreen');
    expect(hidden).toEqual([]);
    expect(timing.open).toBe('save');
  });
});

describe('grace area', () => {
  const trigger = { left: 100, top: 10, right: 132, bottom: 42 };
  const tip = { left: 80, top: 50, right: 160, bottom: 74 };

  test('the pointer crossing the gap to the tooltip keeps it open', () => {
    expect(inGraceArea(116, 46, trigger, tip)).toBe(true);
  });

  test('the trigger and the tooltip themselves are inside it', () => {
    expect(inGraceArea(110, 20, trigger, tip)).toBe(true);
    expect(inGraceArea(90, 60, trigger, tip)).toBe(true);
  });

  test('a pointer beside the pair, or beyond either end, is outside it', () => {
    expect(inGraceArea(170, 30, trigger, tip)).toBe(false);
    expect(inGraceArea(70, 30, trigger, tip)).toBe(false);
    expect(inGraceArea(116, 90, trigger, tip)).toBe(false);
    expect(inGraceArea(116, 5, trigger, tip)).toBe(false);
  });
});

describe('describedBy', () => {
  test('adds the tooltip id once and removes it again', () => {
    expect(describedBy(null, 'tooltip', true, false)).toBe('tooltip');
    expect(describedBy('note tooltip', 'tooltip', true, false)).toBe('note tooltip');
    expect(describedBy('note tooltip', 'tooltip', false, false)).toBe('note');
    expect(describedBy('tooltip', 'tooltip', false, false)).toBeNull();
  });

  test('a tooltip that only repeats the name or an existing note is not added', () => {
    expect(describedBy('note', 'tooltip', true, true)).toBe('note');
    expect(describedBy(null, 'tooltip', true, true)).toBeNull();
  });
});
