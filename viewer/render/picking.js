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
 * Turns pointer events over the canvas into region hover and selection.
 *
 * Dependencies are injected rather than imported, so this never reaches for
 * the scene module and the dependency graph stays acyclic.
 *
 * Hover is deliberately kept out of the state loop: it fires once per frame,
 * and routing it through a full re-render would rebuild every panel sixty
 * times a second. It reports directly to its callback instead.
 */
export function createPicker({ domElement, camera, model, onHover, onSelect }) {
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
    // longer pointing at. The reticle carries identification on touch.
    if (event.pointerType === 'touch' || event.buttons || frame !== null) return;
    const { clientX, clientY } = event;
    frame = requestAnimationFrame(() => {
      frame = null;
      const region = regionAt({ clientX, clientY });
      const rect = domElement.getBoundingClientRect();
      onHover(region, { x: clientX - rect.left, y: clientY - rect.top });
      // OrbitControls writes this inline too, so a stylesheet cannot reach it;
      // `grab` is the resting cursor it is configured with in scene.js.
      domElement.style.cursor = region ? 'pointer' : 'grab';
    });
  };

  const clearHover = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    pressed = null;
    onHover(null, null);
  };

  domElement.addEventListener('pointerdown', onPointerDown);
  domElement.addEventListener('pointerup', onPointerUp);
  domElement.addEventListener('pointercancel', clearHover);
  domElement.addEventListener('pointerleave', clearHover);
  domElement.addEventListener('pointermove', onPointerMove);

  return {
    /**
     * What lies under a point on the canvas, in CSS pixels from its top left.
     *
     * The reticle reads this on every camera change. It is deliberately not
     * routed through the state loop, for the same reason hover is not: it
     * fires once per frame of an orbit.
     */
    pickAt(x, y) {
      return regionAtPoint(x, y);
    },

    dispose() {
      if (frame !== null) cancelAnimationFrame(frame);
      domElement.removeEventListener('pointerdown', onPointerDown);
      domElement.removeEventListener('pointerup', onPointerUp);
      domElement.removeEventListener('pointercancel', clearHover);
      domElement.removeEventListener('pointerleave', clearHover);
      domElement.removeEventListener('pointermove', onPointerMove);
    },
  };
}
