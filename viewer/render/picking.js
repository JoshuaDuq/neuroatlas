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
 * Identification is click-only. Naming a region on pointermove fought the
 * orbit (a raycast every frame, and a chip that stole the drag) and told
 * the reader something they had not asked for.
 */
export function createPicker({ domElement, camera, model, onSelect }) {
  const raycaster = new Raycaster();
  raycaster.firstHitOnly = true;
  const pointer = new Vector2();
  let pressed = null;

  /** Cast through a point given relative to the canvas, in CSS pixels. */
  function regionAtPoint(x, y) {
    const rect = domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    pointer.set((x / rect.width) * 2 - 1, -(y / rect.height) * 2 + 1);
    camera.updateMatrixWorld();
    raycaster.setFromCamera(pointer, camera);
    return model().pick(raycaster);
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

  const clearPress = () => { pressed = null; };

  domElement.addEventListener('pointerdown', onPointerDown);
  domElement.addEventListener('pointerup', onPointerUp);
  domElement.addEventListener('pointercancel', clearPress);
  domElement.addEventListener('pointerleave', clearPress);

  return {
    dispose() {
      domElement.removeEventListener('pointerdown', onPointerDown);
      domElement.removeEventListener('pointerup', onPointerUp);
      domElement.removeEventListener('pointercancel', clearPress);
      domElement.removeEventListener('pointerleave', clearPress);
    },
  };
}
