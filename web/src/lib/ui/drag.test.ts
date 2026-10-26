// Ported from viewer/ui/drag.test.js.
import { describe, expect, test } from 'vitest';
import { trackDrag } from './drag.ts';

describe('trackDrag', () => {
  for (const ending of ['change', 'pointerup', 'pointercancel', 'blur']) {
    test(`a drag ends on ${ending}, so a status held during it is said again`, () => {
      const slider = new EventTarget();
      let ended = 0;
      const drag = trackDrag([slider], () => {
        ended += 1;
      });
      slider.dispatchEvent(new Event('input'));
      expect(drag.dragging).toBe(true);
      slider.dispatchEvent(new Event(ending));
      expect(drag.dragging).toBe(false);
      expect(ended).toBe(1);
      // Released again with no drag under way: nothing to end.
      slider.dispatchEvent(new Event('pointerup'));
      expect(ended).toBe(1);
      drag.dispose();
      slider.dispatchEvent(new Event('input'));
      expect(drag.dragging).toBe(false);
    });
  }

  test('any of several sliders starts and ends the one drag', () => {
    const [a, b] = [new EventTarget(), new EventTarget()];
    let ended = 0;
    const drag = trackDrag(new Set([a, b]), () => {
      ended += 1;
    });
    b.dispatchEvent(new Event('input'));
    expect(drag.dragging).toBe(true);
    a.dispatchEvent(new Event('change'));
    expect(drag.dragging).toBe(false);
    expect(ended).toBe(1);
  });
});

describe('UI-25: over every pair of events on two sliders', () => {
  const events = ['input', 'change', 'pointerup', 'pointercancel', 'blur', 'focus', 'click'];
  const ENDINGS = new Set(['change', 'pointerup', 'pointercancel', 'blur']);

  test('dragging is true exactly when the latest start or end event was input; focus and click change nothing', () => {
    for (const first of events) {
      for (const second of events) {
        const [a, b] = [new EventTarget(), new EventTarget()];
        const drag = trackDrag([a, b], () => {});
        a.dispatchEvent(new Event(first));
        b.dispatchEvent(new Event(second));
        const latest = [first, second]
          .filter((event) => event === 'input' || ENDINGS.has(event))
          .at(-1);
        expect(drag.dragging, `${first} then ${second}`).toBe(latest === 'input');
      }
    }
  });

  test('focus and click neither start nor end a drag', () => {
    const slider = new EventTarget();
    let ended = 0;
    const drag = trackDrag([slider], () => {
      ended += 1;
    });
    slider.dispatchEvent(new Event('focus'));
    slider.dispatchEvent(new Event('click'));
    expect(drag.dragging).toBe(false);
    slider.dispatchEvent(new Event('input'));
    slider.dispatchEvent(new Event('focus'));
    slider.dispatchEvent(new Event('click'));
    expect(drag.dragging).toBe(true);
    expect(ended).toBe(0);
  });
});
