import type { Vector3 } from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/** Keys that move the camera while the canvas has focus (viewport-chrome.js:45). */
export const CAMERA_KEYS: ReadonlySet<string> = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  '+',
  '=',
  '-',
]);

/** How far the camera must move during a gesture before it has left the preset (viewport-chrome.js:48). */
export const MOVED_EPSILON = 1e-6;

/** A wheel step reports its end before the camera moves on the next frame (viewport-chrome.js:578). */
const GESTURE_GRACE_MS = 250;

export interface HeldView {
  /** The camera still sits where a named view put it. */
  readonly held: boolean;
  /** A named view was framed. */
  hold(): void;
  /** The camera was framed on something other than a preset, or the reader moved it. */
  release(): void;
  dispose(): void;
}

export interface HeldViewOptions {
  controls: Pick<OrbitControls, 'addEventListener' | 'removeEventListener' | 'target'> & {
    object: { position: Vector3 };
  };
  /** The element holding the canvas; its key events release the view. */
  host: Pick<HTMLElement, 'addEventListener' | 'removeEventListener'>;
  /** Called when the held state changes, never when it is set to what it already is. */
  onChange(held: boolean): void;
}

/**
 * Whether the camera still sits on a named view (viewport-chrome.js:546-599). A drag, pinch or wheel
 * that actually moves the camera leaves the preset; a click that selects a region does not.
 */
export function createHeldView({ controls, host, onChange }: HeldViewOptions): HeldView {
  let held = false;
  let watching = false;
  let watchTimer: ReturnType<typeof setTimeout> | undefined;
  let gestureFrom: { position: Vector3; target: Vector3 } | null = null;

  function set(next: boolean) {
    if (held === next) return;
    held = next;
    onChange(held);
  }

  const onGestureStart = () => {
    clearTimeout(watchTimer);
    watching = true;
    gestureFrom = {
      position: controls.object.position.clone(),
      target: controls.target.clone(),
    };
  };
  const onGestureChange = () => {
    if (!watching) return;
    if (
      controls.object.position.distanceTo(gestureFrom!.position) > MOVED_EPSILON ||
      controls.target.distanceTo(gestureFrom!.target) > MOVED_EPSILON
    ) {
      watching = false;
      set(false);
    }
  };
  const onGestureEnd = () => {
    clearTimeout(watchTimer);
    watchTimer = setTimeout(() => {
      watching = false;
    }, GESTURE_GRACE_MS);
  };
  // A key with a modifier is the browser's (zoom) or the page's, not a camera move; the app's own key
  // handler ignores it too (deviations/e7-held-view-modified-keys.md).
  const onCanvasKey = (event: KeyboardEvent) => {
    if ((event.target as Element).tagName !== 'CANVAS' || !CAMERA_KEYS.has(event.key)) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    set(false);
  };
  controls.addEventListener('start', onGestureStart);
  controls.addEventListener('change', onGestureChange);
  controls.addEventListener('end', onGestureEnd);
  host.addEventListener('keydown', onCanvasKey as EventListener);

  return {
    get held() {
      return held;
    },
    hold() {
      watching = false;
      set(true);
    },
    release() {
      set(false);
    },
    dispose() {
      host.removeEventListener('keydown', onCanvasKey as EventListener);
      controls.removeEventListener('start', onGestureStart);
      controls.removeEventListener('change', onGestureChange);
      controls.removeEventListener('end', onGestureEnd);
      clearTimeout(watchTimer);
    },
  };
}
