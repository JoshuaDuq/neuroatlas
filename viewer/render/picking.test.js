import assert from 'node:assert/strict';
import test from 'node:test';
import { PerspectiveCamera } from 'three';
import { createPicker } from './picking.js';

/*
 * The browser paints between a pointer move and the raycast it schedules, so
 * the frames are held and run by hand: a test that never ran one would pass
 * against a picker that never scheduled anything.
 */
function frames() {
  const queued = [];
  globalThis.requestAnimationFrame = callback => queued.push(callback) && queued.length;
  globalThis.cancelAnimationFrame = handle => { queued[handle - 1] = null; };
  return { run() { for (const callback of queued.splice(0)) callback?.(); } };
}

function canvas() {
  const listeners = new Map();
  return {
    style: {},
    addEventListener: (type, fn) => listeners.set(type, fn),
    removeEventListener: type => listeners.delete(type),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 100 }),
    emit(type, event) {
      listeners.get(type)?.({ clientX: 100, clientY: 50, buttons: 0, pointerType: 'mouse', ...event });
    },
  };
}

function picker() {
  const region = { id: 'destrieux:left:1' };
  const asked = [];
  const hovered = [];
  const domElement = canvas();
  createPicker({
    domElement,
    camera: new PerspectiveCamera(),
    model: () => ({ pick: raycaster => { asked.push(raycaster); return region; } }),
    onHover: (...args) => hovered.push(args),
    onSelect: () => {},
  });
  return { domElement, asked, hovered, region };
}

test('the pointer names what it is over without being clicked', () => {
  const clock = frames();
  const { domElement, hovered, region } = picker();
  domElement.emit('pointermove', { clientX: 120, clientY: 40 });
  clock.run();
  assert.deepEqual(hovered, [[region, { x: 120, y: 40 }]]);
});

test('a finger never hovers: it is pressing or it is absent', () => {
  const clock = frames();
  const { domElement, asked } = picker();
  domElement.emit('pointermove', { pointerType: 'touch' });
  clock.run();
  assert.deepEqual(asked, []);
});

test('an orbit is not interrupted to name what it passes over', () => {
  const clock = frames();
  const { domElement, asked } = picker();
  domElement.emit('pointermove', { buttons: 1 });
  clock.run();
  assert.deepEqual(asked, []);
});

test('the anatomy is asked once a frame however far the pointer travelled', () => {
  const clock = frames();
  const { domElement, asked } = picker();
  for (let x = 0; x < 20; x++) domElement.emit('pointermove', { clientX: x });
  clock.run();
  assert.equal(asked.length, 1);
});

test('leaving the canvas takes the name with it', () => {
  const clock = frames();
  const { domElement, hovered } = picker();
  domElement.emit('pointermove', {});
  clock.run();
  domElement.emit('pointerleave', {});
  assert.deepEqual(hovered.at(-1), [null, null]);
});

test('a click on a region selects it', () => {
  const domElement = canvas();
  const chosen = [];
  createPicker({
    domElement,
    camera: new PerspectiveCamera(),
    model: () => ({ pick: () => ({ id: 'destrieux:left:1' }) }),
    onSelect: id => chosen.push(id),
  });
  domElement.emit('pointerdown', { button: 0 });
  domElement.emit('pointerup', { button: 0 });
  assert.deepEqual(chosen, ['destrieux:left:1']);
});

test('a click on the empty stage does not clear the selection', () => {
  const domElement = canvas();
  const chosen = [];
  createPicker({
    domElement,
    camera: new PerspectiveCamera(),
    model: () => ({ pick: () => null }),
    onSelect: id => chosen.push(id),
  });
  domElement.emit('pointerdown', { button: 0 });
  domElement.emit('pointerup', { button: 0 });
  assert.deepEqual(chosen, []);
});

test('double clicking a point triggers focus on that 3D coordinate', () => {
  const domElement = canvas();
  const targetPoint = { x: 0, y: -0.25, z: 0.05 };
  let focused = null;
  createPicker({
    domElement,
    camera: new PerspectiveCamera(),
    model: () => ({
      pick: () => null,
      intersect: () => ({ point: targetPoint }),
    }),
    onHover: () => {},
    onSelect: () => {},
    onFocusPoint: point => { focused = point; },
  });
  domElement.emit('dblclick', { clientX: 100, clientY: 50 });
  assert.deepEqual(focused, targetPoint);
});
