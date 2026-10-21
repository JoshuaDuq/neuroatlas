import assert from 'node:assert/strict';
import test from 'node:test';
import { bindAppLifecycle } from './lifecycle.js';

function pageHide(persisted) {
  return Object.assign(new Event('pagehide'), { persisted });
}

test('a page preserved for browser Back keeps its running application', () => {
  const events = new EventTarget();
  let disposals = 0;
  bindAppLifecycle({ dispose: () => disposals++ }, events);
  events.dispatchEvent(pageHide(true));
  assert.equal(disposals, 0);
});

test('a preserved page is disposed once when it eventually leaves', () => {
  const events = new EventTarget();
  let disposals = 0;
  bindAppLifecycle({ dispose: () => disposals++ }, events);
  events.dispatchEvent(pageHide(true));
  assert.equal(disposals, 0);
  events.dispatchEvent(pageHide(false));
  events.dispatchEvent(pageHide(false));
  assert.equal(disposals, 1);
});
