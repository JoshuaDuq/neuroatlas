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
