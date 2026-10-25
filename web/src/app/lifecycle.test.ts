import { expect, test } from 'vitest';
import { bindAppLifecycle } from './lifecycle.ts';

function pageHide(persisted: boolean): Event {
  return Object.assign(new Event('pagehide'), { persisted });
}

test('a page preserved for browser Back keeps its running application', () => {
  const events = new EventTarget();
  let disposals = 0;
  bindAppLifecycle({ dispose: () => disposals++ }, events);
  events.dispatchEvent(pageHide(true));
  expect(disposals).toBe(0);
});

test('a preserved page is disposed once when it eventually leaves', () => {
  const events = new EventTarget();
  let disposals = 0;
  bindAppLifecycle({ dispose: () => disposals++ }, events);
  events.dispatchEvent(pageHide(true));
  expect(disposals).toBe(0);
  events.dispatchEvent(pageHide(false));
  events.dispatchEvent(pageHide(false));
  expect(disposals).toBe(1);
});
