import assert from 'node:assert/strict';
import test from 'node:test';
import { EventDispatcher, PerspectiveCamera } from 'three';
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
  const controls = new EventDispatcher();
  const instance = createPicker({
    domElement, controls,
    camera: new PerspectiveCamera(),
    model: () => ({ pick: raycaster => { asked.push(raycaster); return region; } }),
    onHover: (...args) => hovered.push(args),
    onSelect: () => {},
  });
  return { domElement, controls, instance, asked, hovered, region };
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


test('moving the camera clears a stale hover once, without selecting anything', () => {
  const clock = frames();
  const { domElement, controls, hovered } = picker();
  domElement.emit('pointermove', {});
  clock.run();
  controls.dispatchEvent({ type: 'change' });
  controls.dispatchEvent({ type: 'change' });
  assert.deepEqual(hovered.at(-1), [null, null]);
  assert.equal(hovered.length, 2);
});

test('a camera move cancels a hover queued before the orbit', () => {
  const clock = frames();
  const { domElement, controls, asked } = picker();
  domElement.emit('pointermove', {});
  controls.dispatchEvent({ type: 'change' });
  clock.run();
  assert.equal(asked.length, 0);
});

test('coalesced hover picks the latest pointer position', () => {
  const clock = frames();
  const { domElement, hovered } = picker();
  domElement.emit('pointermove', { clientX: 20 });
  domElement.emit('pointermove', { clientX: 120 });
  clock.run();
  assert.equal(hovered[0][1].x, 120);
});

test('disposing the picker removes its camera listener', () => {
  const clock = frames();
  const { domElement, controls, instance, hovered } = picker();
  domElement.emit('pointermove', {});
  clock.run();
  instance.dispose();
  controls.dispatchEvent({ type: 'change' });
  assert.equal(hovered.length, 1);
});

test('camera motion clears the hover cursor without overriding an active grab', () => {
  const clock = frames();
  const { domElement, controls } = picker();
  domElement.emit('pointermove', {});
  clock.run();
  assert.equal(domElement.style.cursor, 'pointer');
  controls.dispatchEvent({ type: 'change' });
  assert.equal(domElement.style.cursor, 'grab');
  domElement.style.cursor = 'grabbing';
  controls.dispatchEvent({ type: 'change' });
  assert.equal(domElement.style.cursor, 'grabbing');
});
