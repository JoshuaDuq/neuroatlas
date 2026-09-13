import { Raycaster, Vector2 } from 'three';

/*
 * How far a press may travel and still count as a tap.
 *
 * A mouse is held still; a fingertip rolls. Measured on the built viewer, a
 * touch that drifted six pixels selected nothing at all — it was read as a
 * drag, so it nudged the camera and cleared the press, and the reader saw no
 * response to a deliberate tap. Five pixels is a mouse threshold; the touch
 * figure is near the platform's own hit-slop.
 */
const CLICK_SLOP_PX = { mouse: 5, touch: 12 };

const slopFor = pointerType => CLICK_SLOP_PX[pointerType === 'touch' ? 'touch' : 'mouse'];

/**
 * Turns pointer events over the canvas into region selection.
 *
 * Dependencies are injected rather than imported, so this never reaches for
 * the scene module and the dependency graph stays acyclic.
 *
 * Hover names what the pointer is over; a click chooses it. What made hover
 * worth removing once was the raycast it cost on every frame of an orbit, so
 * hover answers at most once a frame and never while a button is down.
 */
export function createPicker({ domElement, camera, model, onHover, onSelect, onFocusPoint }) {
  const raycaster = new Raycaster();
  raycaster.firstHitOnly = true;
  const pointer = new Vector2();
  let pressed = null;
  let frame = null;

  /** Cast through a point given relative to the canvas, in CSS pixels. */
  function regionAtPoint(x, y) {
    const rect = domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    pointer.set((x / rect.width) * 2 - 1, -(y / rect.height) * 2 + 1);
    camera.updateMatrixWorld();
    raycaster.setFromCamera(pointer, camera);
    return model().pick(raycaster);
  }

  function intersectAtPoint(x, y) {
    const rect = domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    pointer.set((x / rect.width) * 2 - 1, -(y / rect.height) * 2 + 1);
    camera.updateMatrixWorld();
    raycaster.setFromCamera(pointer, camera);
    return model().intersect?.(raycaster) ?? null;
  }

  function regionAt(event) {
    const rect = domElement.getBoundingClientRect();
    return regionAtPoint(event.clientX - rect.left, event.clientY - rect.top);
  }

  const onPointerDown = event => {
    pressed = {
      x: event.clientX, y: event.clientY,
      button: event.button, pointerType: event.pointerType,
    };
  };

  const onPointerUp = event => {
    const isClick = pressed?.button === 0 &&
      Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y)
        < slopFor(pressed.pointerType);
    pressed = null;
    if (isClick) onSelect(regionAt(event)?.id ?? null);
  };

  const onPointerMove = event => {
    // A finger has no hover: it is either pressing or absent, and a stale
    // label left behind by the last tap would name a region the reader is no
    // longer pointing at. Held buttons are an orbit, which hover must not cost.
    if (event.pointerType === 'touch' || event.buttons || frame !== null) return;
    const { clientX, clientY } = event;
    frame = requestAnimationFrame(() => {
      frame = null;
      const region = regionAt({ clientX, clientY });
      const rect = domElement.getBoundingClientRect();
      onHover?.(region, { x: clientX - rect.left, y: clientY - rect.top });
      // OrbitControls writes this inline too, so a stylesheet cannot reach it;
      // `grab` is the resting cursor it is configured with in scene.js.
      domElement.style.cursor = region ? 'pointer' : 'grab';
    });
  };

  const clearPress = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    pressed = null;
    onHover?.(null, null);
  };

  const onDblClick = event => {
    if (!onFocusPoint) return;
    const rect = domElement.getBoundingClientRect();
    const hit = intersectAtPoint(event.clientX - rect.left, event.clientY - rect.top);
    if (hit?.point) onFocusPoint(hit.point);
  };

  domElement.addEventListener('pointerdown', onPointerDown);
  domElement.addEventListener('pointerup', onPointerUp);
  domElement.addEventListener('pointercancel', clearPress);
  domElement.addEventListener('pointerleave', clearPress);
  domElement.addEventListener('pointermove', onPointerMove);
  domElement.addEventListener('dblclick', onDblClick);

  return {
    dispose() {
      if (frame !== null) cancelAnimationFrame(frame);
      domElement.removeEventListener('pointerdown', onPointerDown);
      domElement.removeEventListener('pointerup', onPointerUp);
      domElement.removeEventListener('pointercancel', clearPress);
      domElement.removeEventListener('pointerleave', clearPress);
      domElement.removeEventListener('pointermove', onPointerMove);
      domElement.removeEventListener('dblclick', onDblClick);
    },
  };
}
