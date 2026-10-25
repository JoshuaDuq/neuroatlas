import type { FramingClearance, Rect, Size } from '../engine/api.ts';
import { FRAME_FILL } from '../engine/render/camera-views.ts';
import { clearFraming } from '../engine/render/effective-viewport.ts';
import { PREF_KEYS, defaultStorage, readPref, writePref } from './prefs.ts';

export type Edge = 'top' | 'right' | 'bottom' | 'left';

/** How the dock and the scale bar share the stage's bottom line (viewport-chrome.js:188-195). */
export type ChromeMode = 'wide' | 'tight' | 'stacked';

/** Both margins plus the least gap allowed between the dock and the scale bar (viewport-chrome.js:21). */
const CHROME_GUTTERS_PX = 48;

/** Space kept between a marking and the anatomy, so its halo never sits on tissue (viewport-chrome.js:24). */
const MARKING_GAP_PX = 8;

/** Room the top orientation letter and its gap take from a hint that would reach it (viewport-chrome.js:27). */
const TOP_LETTER_ROOM_PX = 20;

/** The dock's own height plus this must stay under half the stage for the bottom letter to read as the bottom (viewport-chrome.js:203). */
const DOCK_TALL_MARGIN_PX = 64;

const RETIRED = 'retired';

const sameSize = (a: Size, b: Size) => a.width === b.width && a.height === b.height;

/**
 * Where the stage's own chrome sits: the rectangle the reader can see, the dock, the colour keys, the
 * phone sheet, and what follows from them (viewport-chrome.js:137-267, 707-728). Components read the
 * values; the engine pulls `framing()` once per framing, so it is a plain function and holds no reactive
 * read. The camera and hover events never come through here.
 */
export function createStageLayout({
  storage = defaultStorage(),
}: { storage?: Storage | null } = {}) {
  let visibleRect = $state.raw<Rect | null>(null);
  let hostSize = $state.raw<Size | null>(null);
  let dock = $state.raw<Size>({ width: 0, height: 0 });
  let keyInset = $state.raw({ top: 0, right: 0 });
  let keySize = $state.raw<Size>({ width: 0, height: 0 });
  let sheetFull = $state(false);
  let sectionNeed = $state(0);
  let gutter = $state(0);
  let scaleBarWidth = $state(0);
  let hintRetired = $state(readPref(PREF_KEYS.stageHint, storage) === RETIRED);

  // Elements the framing measures where they are drawn.
  let dockElement: HTMLElement | null = null;
  let orientation: HTMLElement | null = null;
  let scaleBar: HTMLElement | null = null;
  let keyFitter: (() => void) | null = null;

  const chrome = $derived.by((): ChromeMode => {
    if (!visibleRect?.width) return 'wide';
    const needed = dock.width + scaleBarWidth + CHROME_GUTTERS_PX;
    if (needed <= visibleRect.width) return 'wide';
    // Raised beside the bottom letter, a bar reaching the middle would read as part of it.
    return scaleBarWidth > visibleRect.width / 2 - CHROME_GUTTERS_PX ? 'stacked' : 'tight';
  });

  const dockTall = $derived(
    Boolean(visibleRect?.height) && dock.height + DOCK_TALL_MARGIN_PX > visibleRect!.height / 2,
  );

  /** The room one line of a hint has before it would reach the top letter or a key, or null before the stage has a size. */
  const hintRoom = $derived.by(() => {
    if (!visibleRect?.width) return null;
    return keyInset.top
      ? visibleRect.width - 3 * gutter - keySize.width
      : (visibleRect.width - keyInset.right) / 2 - gutter - TOP_LETTER_ROOM_PX;
  });

  /** How far up from the visible bottom the dock reaches; zero while a raised phone sheet hides it. */
  function dockReach(): number {
    if (sheetFull) return 0;
    if (dockElement) {
      // The observer may not have run since the dock last changed.
      const measured = Math.round(dockElement.offsetHeight);
      if (measured !== dock.height) dock = { ...dock, height: measured };
    }
    return dock.height + gutter;
  }

  /**
   * The room the orientation letters and the scale bar take at each edge of the stage over the dock,
   * measured where they are drawn. Boxes are read even while a popover hides the markings: framing runs
   * as a preset closes the View popover, and the markings return with the picture.
   */
  function markingClearance(reach: number) {
    const clear = { top: 0, bottom: 0, left: 0, right: 0 };
    if (!visibleRect || !orientation || orientation.hidden || sheetFull) return clear;
    // Measured from the framing rectangle (the visible stage less any colour key's band) as it is
    // drawn: on a phone it glides with a settling sheet, and the markings glide with it.
    const frame = orientation.getBoundingClientRect();
    const floor = frame.bottom - reach;
    const box = (edge: Edge) =>
      orientation!.querySelector<HTMLElement>(`[data-edge="${edge}"]`)!.getBoundingClientRect();
    const above = (b: DOMRect) => Math.max(0, b.bottom - frame.top + MARKING_GAP_PX);
    const below = (b: DOMRect) => Math.max(0, floor - b.top + MARKING_GAP_PX);
    clear.top = above(box('top'));
    if (!dockTall) clear.bottom = below(box('bottom'));
    clear.left = Math.max(0, box('left').right - frame.left + MARKING_GAP_PX);
    clear.right = Math.max(0, frame.right - box('right').left + MARKING_GAP_PX);
    if (scaleBar && !scaleBar.hidden) {
      const b = scaleBar.getBoundingClientRect();
      if ((b.top + b.bottom) / 2 < (frame.top + floor) / 2)
        clear.top = Math.max(clear.top, above(b));
      else clear.bottom = Math.max(clear.bottom, below(b));
    }
    return clear;
  }

  function setDock(size: Size) {
    if (!sameSize(dock, size)) dock = size;
  }

  return {
    get visibleRect() {
      return visibleRect;
    },
    get hostSize() {
      return hostSize;
    },
    get dock() {
      return dock;
    },
    get keyInset() {
      return keyInset;
    },
    get keySize() {
      return keySize;
    },
    get chrome() {
      return chrome;
    },
    get dockTall() {
      return dockTall;
    },
    get hintRoom() {
      return hintRoom;
    },
    get gutter() {
      return gutter;
    },
    /** A raised phone sheet (H6): the dock is under it, so framing leaves no room for either. */
    get sheetFull() {
      return sheetFull;
    },
    set sheetFull(full: boolean) {
      sheetFull = full;
    },
    /** The section row's natural width with every control beside the slider (G4); 0 while there is no section bar. */
    get sectionNeed() {
      return sectionNeed;
    },
    set sectionNeed(width: number) {
      sectionNeed = width;
    },
    get hintRetired() {
      return hintRetired;
    },

    /**
     * The rectangle the reader can see, from the engine's `viewport` event. A stage with no size, or a
     * rectangle already held, changes nothing (viewport-chrome.js:707-713).
     */
    setViewport(rect: Rect, size: Size) {
      if (!size.width || !size.height) return;
      if (
        visibleRect &&
        visibleRect.x === rect.x &&
        visibleRect.y === rect.y &&
        visibleRect.width === rect.width &&
        visibleRect.height === rect.height &&
        hostSize &&
        sameSize(hostSize, size)
      ) {
        return;
      }
      visibleRect = rect;
      hostSize = size;
    },

    /** The stage gutter in pixels, read from the host's `--stage-gutter` (it differs on a phone). */
    setGutter(pixels: number) {
      gutter = pixels;
    },

    setDock,

    /** Watches the dock's border box for as long as it is mounted; returns the function that stops. */
    observeDock(element: HTMLElement): () => void {
      dockElement = element;
      const observer = new ResizeObserver(([entry]) => {
        const box = entry!.borderBoxSize[0]!;
        setDock({ width: Math.round(box.inlineSize), height: Math.round(box.blockSize) });
      });
      observer.observe(element);
      return () => {
        observer.disconnect();
        if (dockElement === element) dockElement = null;
      };
    },

    /** The band the colour keys take off the framing rectangle (G3), and the size of the keys' host. */
    setKeys(inset: { top: number; right: number }, size: Size) {
      keyInset = inset;
      keySize = size;
    },

    /** G3's fitting of the keys, run at the start of every framing so it sees the keys as they now are (viewport-chrome.js:265). */
    setKeyFitter(fit: () => void): () => void {
      keyFitter = fit;
      return () => {
        if (keyFitter === fit) keyFitter = null;
      };
    },

    /** The scale bar's width in pixels, rule and label, or 0 while it is hidden. */
    setScaleBarWidth(width: number) {
      scaleBarWidth = width;
    },

    /** The orientation letters' frame, measured by `framing()`. */
    registerOrientation(element: HTMLElement | null) {
      orientation = element;
    },

    registerScaleBar(element: HTMLElement | null) {
      scaleBar = element;
    },

    /**
     * The insets and scale the camera frames with, keeping the anatomy clear of the dock, the colour keys
     * and the markings (viewport-chrome.js:263-270). Register it with `engine.camera.setFramingSource`.
     */
    framing: (): FramingClearance => {
      const reach = dockReach();
      keyFitter?.();
      if (!visibleRect?.height) {
        return { inset: { ...keyInset, bottom: reach }, scale: { horizontal: 1, vertical: 1 } };
      }
      const room = {
        width: visibleRect.width - keyInset.right,
        height: visibleRect.height - keyInset.top,
      };
      const { inset, scale } = clearFraming(room, reach, markingClearance(reach), FRAME_FILL);
      return { inset: { ...keyInset, bottom: inset }, scale };
    },

    /** The reader has rotated, zoomed or clicked the model once: the drag-and-scroll hint stays retired for good. */
    retireHint() {
      if (hintRetired) return;
      hintRetired = true;
      writePref(PREF_KEYS.stageHint, RETIRED, storage);
    },
  };
}

export type StageLayout = ReturnType<typeof createStageLayout>;
