import assert from 'node:assert/strict';
import { afterEach, describe, it, vi } from 'vitest';
import { EventDispatcher, Vector3 } from 'three';
import { CAMERA_KEYS, createHeldView } from './held-view.ts';

afterEach(() => {
  vi.useRealTimers();
});

type Listener = (event: object) => void;

/** An element that records its listeners and fires them with the event it is given. */
function createHost() {
  const listeners = new Map<string, Set<Listener>>();
  return {
    addEventListener: (type: string, fn: Listener) => {
      listeners.set(type, (listeners.get(type) ?? new Set()).add(fn));
    },
    removeEventListener: (type: string, fn: Listener) => listeners.get(type)?.delete(fn),
    fire: (type: string, event: object) => listeners.get(type)?.forEach((fn) => fn(event)),
  };
}

function setup() {
  const camera = { position: new Vector3(0, 0, 0.3) };
  const controls = Object.assign(
    new EventDispatcher<{ start: object; change: object; end: object }>(),
    {
      object: camera,
      target: new Vector3(),
    },
  );
  const host = createHost();
  const changes: boolean[] = [];
  const held = createHeldView({
    controls,
    host: host as unknown as HTMLElement,
    onChange: (value) => changes.push(value),
  });
  return { camera, controls, host, held, changes };
}

describe('the held view', () => {
  it('FACADE-19 a gesture that moves the camera by more than a micrometre releases the view', () => {
    for (const [moved, released] of [
      [1e-6, false],
      [1.0000001e-6, true],
      [1e-5, true],
    ] as const) {
      const { camera, controls, held } = setup();
      held.hold();
      controls.dispatchEvent({ type: 'start' });
      camera.position.x += moved;
      controls.dispatchEvent({ type: 'change' });
      assert.equal(held.held, !released, `a position step of ${moved}`);
    }
  });

  it('FACADE-19 a move of the orbit centre counts the same as a move of the camera', () => {
    for (const [moved, released] of [
      [1e-6, false],
      [1e-5, true],
    ] as const) {
      const { controls, held } = setup();
      held.hold();
      controls.dispatchEvent({ type: 'start' });
      controls.target.x += moved;
      controls.dispatchEvent({ type: 'change' });
      assert.equal(held.held, !released, `a target step of ${moved}`);
    }
  });

  it('FACADE-19 a press that moves nothing, like a click that selects, keeps the view', () => {
    const { controls, held } = setup();
    held.hold();
    controls.dispatchEvent({ type: 'start' });
    controls.dispatchEvent({ type: 'end' });
    assert.equal(held.held, true);
  });

  it('FACADE-20 a move shortly after a wheel step ends still counts, and a late one does not', () => {
    vi.useFakeTimers();
    for (const [wait, released] of [
      [100, true],
      [500, false],
    ] as const) {
      const { camera, controls, held } = setup();
      held.hold();
      controls.dispatchEvent({ type: 'start' });
      controls.dispatchEvent({ type: 'end' });
      vi.advanceTimersByTime(wait);
      camera.position.x += 1e-5;
      controls.dispatchEvent({ type: 'change' });
      assert.equal(held.held, !released, `${wait} ms after the step`);
    }
  });

  it('FACADE-21 the arrow keys and the zoom keys on the canvas release the view', () => {
    assert.deepEqual([...CAMERA_KEYS].sort(), [
      '+',
      '-',
      '=',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
    ]);
    for (const key of CAMERA_KEYS) {
      const { host, held } = setup();
      held.hold();
      host.fire('keydown', { key, target: { tagName: 'CANVAS' } });
      assert.equal(held.held, false, key);
    }
  });

  it('FACADE-21 the same keys with Ctrl, Meta or Alt are the browser’s and keep the view; Shift is allowed', () => {
    const { host, held } = setup();
    const press = (modifiers: object) =>
      host.fire('keydown', { key: '-', target: { tagName: 'CANVAS' }, ...modifiers });
    held.hold();
    for (const modifier of ['ctrlKey', 'metaKey', 'altKey']) {
      press({ [modifier]: true });
      assert.equal(held.held, true, modifier);
    }
    press({ shiftKey: true });
    assert.equal(held.held, false);
  });

  it('FACADE-21 other keys on the canvas, and camera keys elsewhere, keep the view', () => {
    const { host, held } = setup();
    held.hold();
    for (const key of ['a', 'Enter', 'Escape']) {
      host.fire('keydown', { key, target: { tagName: 'CANVAS' } });
    }
    host.fire('keydown', { key: '-', target: { tagName: 'DIV' } });
    assert.equal(held.held, true);
  });

  it('FACADE-22 the held state is reported when it changes and never when it is set to what it is', () => {
    const { held, changes } = setup();
    held.release();
    held.hold();
    held.hold();
    held.release();
    held.release();
    assert.deepEqual(changes, [true, false]);
  });
});
