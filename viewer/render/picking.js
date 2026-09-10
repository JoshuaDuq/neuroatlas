import { Raycaster, Vector2 } from 'three';

const CLICK_SLOP_PX = 5;

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

  function regionAt(event) {
    const rect = domElement.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    camera.updateMatrixWorld();
    raycaster.setFromCamera(pointer, camera);
    return model().pick(raycaster);
  }

  const onPointerDown = event => {
    pressed = { x: event.clientX, y: event.clientY, button: event.button };
  };

  const onPointerUp = event => {
    const isClick = pressed?.button === 0 &&
      Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) < CLICK_SLOP_PX;
    pressed = null;
    if (isClick) onSelect(regionAt(event)?.id ?? null);
  };

  const onPointerMove = event => {
    if (event.buttons || frame !== null) return;
    const { clientX, clientY } = event;
    frame = requestAnimationFrame(() => {
      frame = null;
      const region = regionAt({ clientX, clientY });
      const rect = domElement.getBoundingClientRect();
      onHover(region, { x: clientX - rect.left, y: clientY - rect.top });
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
