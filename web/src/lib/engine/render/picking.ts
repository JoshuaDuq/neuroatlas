import { Raycaster, Vector2 } from 'three';
import type { Intersection, PerspectiveCamera, Vector3 } from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';

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

const slopFor = (pointerType: string): number =>
  CLICK_SLOP_PX[pointerType === 'touch' ? 'touch' : 'mouse'];

/** What the picker asks of the drawn anatomy. */
export interface PickModel<Region extends { id: string }> {
  pick(raycaster: Raycaster): Region | null;
  /** Used by a double click only: where the ray meets the surface. */
  intersect?(raycaster: Raycaster): Pick<Intersection, 'point'> | null;
}

export interface PickerOptions<Region extends { id: string }> {
  domElement: HTMLElement;
  camera: PerspectiveCamera;
  controls?: Pick<OrbitControls, 'addEventListener' | 'removeEventListener'>;
  model: () => PickModel<Region>;
  onHover?: (region: Region | null, position: { x: number; y: number } | null) => void;
  onSelect: (id: string) => void;
  onFocusPoint?: (point: Vector3) => void;
  /** While this holds, a click places at the point it meets rather than choosing a region. */
  placing?: () => boolean;
  onPlace?: (point: Vector3) => void;
}

interface Press {
  x: number;
  y: number;
  button: number;
  pointerType: string;
}

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
export function createPicker<Region extends { id: string }>({
  domElement,
  camera,
  controls,
  model,
  onHover,
  onSelect,
  onFocusPoint,
  placing,
  onPlace,
}: PickerOptions<Region>): { dispose(): void } {
  const raycaster = new Raycaster();
  raycaster.firstHitOnly = true;
  const pointer = new Vector2();
  let pressed: Press | null = null;
  let frame: number | null = null;
  let pendingPoint: { clientX: number; clientY: number } | null = null;
  let hovering = false;

  // A camera move makes the old hit invalid. Keeping its outline would also
  // cost a depth render of the whole brain on every frame of the orbit.
  const clearHover = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    pendingPoint = null;
    if (hovering) onHover?.(null, null);
    hovering = false;
    if (domElement.style.cursor === 'pointer') domElement.style.cursor = 'grab';
  };

  /** Aim the ray through a point given relative to the canvas, in CSS pixels; false on a hidden canvas. */
  function aim(x: number, y: number): boolean {
    const rect = domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    pointer.set((x / rect.width) * 2 - 1, -(y / rect.height) * 2 + 1);
    camera.updateMatrixWorld();
    raycaster.setFromCamera(pointer, camera);
    return true;
  }

  function regionAt(event: { clientX: number; clientY: number }): Region | null {
    const rect = domElement.getBoundingClientRect();
    return aim(event.clientX - rect.left, event.clientY - rect.top)
      ? model().pick(raycaster)
      : null;
  }

  const onPointerDown = (event: PointerEvent) => {
    // One pointer makes a tap: a second finger landing must not replace the first one's press.
    // A second pointer makes the gesture a pinch or a two-finger drag, not a tap.
    if (!event.isPrimary) {
      pressed = null;
      return;
    }
    pressed = {
      x: event.clientX,
      y: event.clientY,
      button: event.button,
      pointerType: event.pointerType,
    };
  };

  const onPointerUp = (event: PointerEvent) => {
    if (!event.isPrimary) return;
    const isClick =
      pressed?.button === 0 &&
      Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) <
        slopFor(pressed.pointerType);
    pressed = null;
    // A miss is not a request to forget the region. The stage is mostly
    // empty, and a sulcus is easy to miss; Escape is the deliberate clear.
    if (!isClick) return;
    if (placing?.()) {
      const rect = domElement.getBoundingClientRect();
      if (!aim(event.clientX - rect.left, event.clientY - rect.top)) return;
      const hit = model().intersect?.(raycaster) ?? null;
      if (hit?.point) onPlace?.(hit.point);
      return;
    }
    const id = regionAt(event)?.id;
    if (id) onSelect(id);
  };

  const onPointerMove = (event: PointerEvent) => {
    // A finger has no hover: it is either pressing or absent, and a stale
    // label left behind by the last tap would name a region the reader is no
    // longer pointing at. Held buttons are an orbit, which hover must not cost.
    if (event.pointerType === 'touch' || event.buttons) return;
    pendingPoint = { clientX: event.clientX, clientY: event.clientY };
    if (frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      const { clientX, clientY } = pendingPoint!;
      pendingPoint = null;
      const region = regionAt({ clientX, clientY });
      const rect = domElement.getBoundingClientRect();
      hovering = Boolean(region);
      onHover?.(region, { x: clientX - rect.left, y: clientY - rect.top });
      // OrbitControls writes this inline too, so a stylesheet cannot reach it;
      // `grab` is the resting cursor it is configured with in scene.ts.
      domElement.style.cursor = region ? 'pointer' : 'grab';
    });
  };

  const clearPress = () => {
    clearHover();
    pressed = null;
  };

  const onDblClick = (event: MouseEvent) => {
    if (!onFocusPoint) return;
    const rect = domElement.getBoundingClientRect();
    if (!aim(event.clientX - rect.left, event.clientY - rect.top)) return;
    const hit = model().intersect?.(raycaster) ?? null;
    if (hit?.point) onFocusPoint(hit.point);
  };

  domElement.addEventListener('pointerdown', onPointerDown as EventListener);
  domElement.addEventListener('pointerup', onPointerUp as EventListener);
  domElement.addEventListener('pointercancel', clearPress);
  domElement.addEventListener('pointerleave', clearPress);
  domElement.addEventListener('pointermove', onPointerMove as EventListener);
  domElement.addEventListener('dblclick', onDblClick as EventListener);
  controls?.addEventListener('change', clearHover);

  return {
    dispose() {
      if (frame !== null) cancelAnimationFrame(frame);
      controls?.removeEventListener('change', clearHover);
      domElement.removeEventListener('pointerdown', onPointerDown as EventListener);
      domElement.removeEventListener('pointerup', onPointerUp as EventListener);
      domElement.removeEventListener('pointercancel', clearPress);
      domElement.removeEventListener('pointerleave', clearPress);
      domElement.removeEventListener('pointermove', onPointerMove as EventListener);
      domElement.removeEventListener('dblclick', onDblClick as EventListener);
    },
  };
}
