import assert from 'node:assert/strict';
import test from 'node:test';
import { trackDrag } from './drag.js';

for (const ending of ['change', 'pointerup', 'pointercancel', 'blur']) {
  test(`a drag ends on ${ending}, so a status held during it is said again`, () => {
    const slider = new EventTarget();
    let ended = 0;
    const drag = trackDrag([slider], () => { ended += 1; });
    slider.dispatchEvent(new Event('input'));
    assert.equal(drag.dragging, true);
    slider.dispatchEvent(new Event(ending));
    assert.equal(drag.dragging, false);
    assert.equal(ended, 1);
    // Released again with no drag under way: nothing to end.
    slider.dispatchEvent(new Event('pointerup'));
    assert.equal(ended, 1);
    drag.dispose();
    slider.dispatchEvent(new Event('input'));
    assert.equal(drag.dragging, false);
  });
}
