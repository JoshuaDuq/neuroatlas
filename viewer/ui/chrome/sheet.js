import { PHONE_QUERY } from '../../render/device.js';
import {
  SIDEWAYS_DETENTS, UPRIGHT_DETENTS, clampDrag, detentHeights, releaseVelocity, settleDetent, stepDetent,
} from './detents.js';
import { t } from '../../i18n/translations.js';

/** Movement that turns a press on the grip into a drag rather than a tap. */
const DRAG_THRESHOLD_PX = 8;

/**
 * The task panel becomes a sheet over a full-bleed canvas on phones.
 *
 * The sheet reports how much of the canvas it covers rather than resizing it.
 * Resizing would reallocate the composer target and both outline passes on every
 * frame of a drag; an inset costs a projection shift.
 *
 * The workspace owns the mode tabs and the list/detail switch; the sheet owns
 * only how much of the panel is on screen, and the grip, which names the
 * selection beside the handle even at peek.
 */
export function createSheet({ onInsets, onDetent, onShell, onSelection, onClear } = {}) {
  const sheet = document.getElementById('sheet');
  const grip = document.getElementById('sheet-grip');
  const gripRow = grip.querySelector('.sheet-grip-row');
  const handle = document.getElementById('sheet-handle');
  const selection = document.getElementById('sheet-selection');
  const selectionName = document.getElementById('sheet-selection-name');
  const selectionSide = document.getElementById('sheet-selection-side');
  const selectionClear = document.getElementById('sheet-selection-clear');
  const tabs = document.getElementById('sheet-tabs');
  const disclaimer = document.getElementById('sheet-disclaimer');
  const viewport = document.getElementById('viewport');

  const query = globalThis.matchMedia?.(PHONE_QUERY) ?? { matches: false, addEventListener() {}, removeEventListener() {} };
  const landscapeQuery = globalThis.matchMedia?.('(orientation: landscape)')
    ?? { matches: false, addEventListener() {}, removeEventListener() {} };

  let detent = 'peek';
  let lang = 'en';
  let phone = query.matches;
  // The span last written, so a re-measured peek that has not moved writes nothing.
  let applied = null;

  // The device's safe areas (notch, home indicator) are only readable from a box env() sizes.
  // The masthead takes the top one; the stage's other edges are the sheet's to report.
  const probe = document.createElement('div');
  probe.style.cssText = 'position: fixed; visibility: hidden; pointer-events: none; '
    + 'padding: 0 env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.append(probe);
  let safe = { right: 0, bottom: 0, left: 0 };
  const measureSafe = () => {
    const style = getComputedStyle(probe);
    safe = { right: parseFloat(style.paddingRight), bottom: parseFloat(style.paddingBottom), left: parseFloat(style.paddingLeft) };
  };

  /** The sheet's span along the axis it grows on: height, or width sideways. */
  const isSideways = () => landscapeQuery.matches;

  /*
   * Peek hugs the grip in both orientations, so a drag from rest starts where the sheet is.
   * Upright it ends where the grip does, with the home indicator's band it pads only at peek;
   * sideways it is as wide as the one row of tabs, from the sheet's safe-area edge.
   */
  function peekSpan() {
    const box = sheet.getBoundingClientRect();
    if (!isSideways()) {
      const pad = parseFloat(getComputedStyle(grip).paddingBottom);
      return Math.round(grip.getBoundingClientRect().bottom - pad - box.top + safe.bottom);
    }
    const last = tabs.lastElementChild?.getBoundingClientRect();
    const row = last ? last.right + parseFloat(getComputedStyle(tabs).paddingRight) - box.left : 0;
    return Math.ceil(Math.max(SIDEWAYS_DETENTS.peek + safe.left, row + parseFloat(getComputedStyle(sheet).borderRightWidth)));
  }
  const heights = () => (isSideways()
    ? detentHeights(globalThis.innerWidth, { ...SIDEWAYS_DETENTS, peek: peekSpan() })
    : detentHeights(viewport.getBoundingClientRect().height || globalThis.innerHeight,
      { ...UPRIGHT_DETENTS, peek: peekSpan() }));

  /*
   * Written as the box's own size rather than an inherited custom property:
   * a property every descendant inherits restyled the whole panel, thousands
   * of tree rows, on every frame of a drag. Every rest is a length, peek
   * included, so every change of rest is a transition.
   */
  function applySpan(pixels) {
    applied = Math.round(pixels);
    const span = `${applied}px`;
    if (isSideways()) {
      // The viewport does not move during a drag; reading it there would force a layout.
      if (!press?.dragging) sheet.style.top = `${Math.round(viewport.getBoundingClientRect().top)}px`;
      sheet.style.width = span;
      sheet.style.removeProperty('height');
    } else {
      sheet.style.height = span;
      sheet.style.removeProperty('width');
      sheet.style.removeProperty('top');
    }
    report(applied);
  }

  /**
   * Tell the renderer how much of the canvas is covered, so framing and the
   * viewport chrome agree about where the viewport is: the sheet, and the
   * safe areas on the stage's other edges.
   *
   * The target span is reported, not the box: mid-transition the box is still
   * moving, and the framing that follows a detent change has to fit where the
   * sheet will land. `settle` says the sheet is moving there on its own curve
   * rather than under the finger, so the picture can follow it on that curve.
   */
  function report(span) {
    const settle = !press?.dragging;
    if (!phone) {
      onInsets?.({ top: 0, right: 0, bottom: 0, left: 0 }, { settle });
      return;
    }
    onInsets?.(isSideways()
      ? { top: 0, right: safe.right, bottom: safe.bottom, left: span }
      : { top: 0, right: safe.right, bottom: span, left: safe.left }, { settle });
  }

  // Three rests are not expanded-or-not, so the handle is named for what a press does.
  const nameHandle = () => handle.setAttribute('aria-label', t(lang, 'sheet')[detent === 'full' ? 'collapse' : 'expand']);

  function setDetent(next, { notify = true } = {}) {
    detent = next;
    sheet.dataset.detent = next;
    nameHandle();
    applySpan(heights()[next]);
    if (notify) onDetent?.(next);
  }

  /** Content chosen with the sheet at rest should be seen; a raised sheet stays where it was put. */
  function raise() {
    if (phone && detent === 'peek') setDetent('half');
  }

  // ---- dragging ---------------------------------------------------------

  let press = null;

  const onPointerDown = event => {
    // A second finger mid-drag would make the sheet jump to it.
    if (!phone || press || !event.isPrimary || event.button !== 0) return;
    const span = isSideways() ? sheet.getBoundingClientRect().width : sheet.getBoundingClientRect().height;
    press = {
      id: event.pointerId,
      origin: isSideways() ? event.clientX : event.clientY,
      span,
      // The rests do not move during a drag, so they are measured once.
      heights: heights(),
      dragging: false,
      samples: [{ at: event.timeStamp, span }],
    };
  };

  const onPointerMove = event => {
    if (!press || event.pointerId !== press.id) return;
    const point = isSideways() ? event.clientX : event.clientY;
    // Sideways the sheet grows rightward, so a rightward drag grows it;
    // upright it grows upward, so the sign flips.
    const travel = isSideways() ? point - press.origin : press.origin - point;
    if (!press.dragging) {
      if (Math.abs(travel) < DRAG_THRESHOLD_PX) return;
      press.dragging = true;
      sheet.dataset.dragging = 'true';
    }
    const span = clampDrag(press.span + travel, press.heights);
    press.samples.push({ at: event.timeStamp, span });
    if (press.samples.length > 8) press.samples.shift();
    applySpan(span);
    if (event.cancelable) event.preventDefault();
  };

  const onPointerUp = event => {
    if (!press || event.pointerId !== press.id) return;
    const dragged = press.dragging;
    const { samples } = press;
    const span = samples[samples.length - 1].span;
    const velocity = releaseVelocity(samples, event.timeStamp);
    press = null;
    sheet.dataset.dragging = 'false';
    if (!dragged) return;
    // The press ends on a button; without this the release would also switch
    // tabs or toggle the handle.
    const swallow = click => { click.stopPropagation(); click.preventDefault(); };
    grip.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => grip.removeEventListener('click', swallow, { capture: true }), 0);
    setDetent(settleDetent(detent, span, heights(), velocity));
  };

  const onHandle = () => {
    setDetent(detent === 'peek' ? 'half' : stepDetent(detent, detent === 'full' ? -2 : 1));
  };
  const onStrip = () => {
    onSelection?.();
    raise();
  };
  const onTabClick = event => { if (event.target.closest('[role="tab"]')) raise(); };

  /*
   * The press starts on the grip but the finger leaves it at once, so the
   * moves are watched on the window. Capturing the pointer on the grip would
   * keep them here, but it also retargets the release, and the tap that
   * chooses a tab would then land on the grip instead of the tab.
   */
  grip.addEventListener('pointerdown', onPointerDown);
  globalThis.addEventListener('pointermove', onPointerMove);
  globalThis.addEventListener('pointerup', onPointerUp);
  globalThis.addEventListener('pointercancel', onPointerUp);
  handle.addEventListener('click', onHandle);
  selection.addEventListener('click', onStrip);
  // The name and its clear vanish with the selection; the tab in front is always on screen.
  const onClearClick = () => {
    onClear?.();
    tabs.querySelector('[aria-selected="true"]')?.focus();
  };
  selectionClear.addEventListener('click', onClearClick);
  tabs.addEventListener('click', onTabClick);

  // The grip and the tabs are sized by their text, which arrives after setup and changes with the
  // language and the selection; a peek that follows them glides like any other change of rest.
  const observer = globalThis.ResizeObserver ? new ResizeObserver(() => {
    if (!phone || detent !== 'peek' || press?.dragging) return;
    const peek = heights().peek;
    if (peek !== applied) applySpan(peek);
  }) : null;
  observer?.observe(grip);
  for (const tab of tabs.children) observer?.observe(tab);

  // ---- mode -------------------------------------------------------------

  /** Hand the panel back to the grid. */
  function teardown() {
    grip.hidden = true;
    sheet.style.removeProperty('height');
    sheet.style.removeProperty('width');
    sheet.style.removeProperty('top');
    delete sheet.dataset.detent;
    applied = null;
    report(0);
    onShell?.('rails');
  }

  function setup() {
    onShell?.('sheet');
    grip.hidden = false;
    sheet.dataset.dragging = 'false';
    setDetent(detent, { notify: false });
  }

  function onModeChange() {
    phone = query.matches;
    measureSafe();
    if (phone) setup();
    else teardown();
  }

  query.addEventListener('change', onModeChange);
  landscapeQuery.addEventListener('change', onModeChange);
  const onResize = () => {
    measureSafe();
    if (phone) applySpan(heights()[detent]);
  };
  globalThis.addEventListener('resize', onResize);
  // A rotation can move the safe areas after its resize event; the probe's own box says when.
  const safeObserver = globalThis.ResizeObserver ? new ResizeObserver(onResize) : null;
  safeObserver?.observe(probe, { box: 'border-box' });

  onModeChange();

  return {
    get isPhone() { return phone; },
    get detent() { return detent; },

    /** A tap on the anatomy is a request to read it; at peek the sheet is only a name. */
    revealOnSelect: raise,
    raise,

    update(state, { label, side, sideWord, clearable } = {}) {
      lang = state.lang;
      nameHandle();
      selection.hidden = !label;
      gripRow.dataset.selection = String(Boolean(label));
      selectionClear.hidden = !label || !clearable;
      selectionClear.setAttribute('aria-label', t(state.lang, 'inspector').clearSelection);
      if (label) {
        selectionName.textContent = label;
        selectionSide.textContent = side ?? '';
        // The side is drawn as a letter; it is said as a word.
        selection.setAttribute('aria-label', t(state.lang, 'workspace').inspect(sideWord ? `${label}, ${sideWord}` : label));
      }
      disclaimer.textContent = t(state.lang, 'footer').statementAlone;
    },

    dispose() {
      observer?.disconnect();
      safeObserver?.disconnect();
      probe.remove();
      grip.removeEventListener('pointerdown', onPointerDown);
      globalThis.removeEventListener('pointermove', onPointerMove);
      globalThis.removeEventListener('pointerup', onPointerUp);
      globalThis.removeEventListener('pointercancel', onPointerUp);
      handle.removeEventListener('click', onHandle);
      selection.removeEventListener('click', onStrip);
      selectionClear.removeEventListener('click', onClearClick);
      tabs.removeEventListener('click', onTabClick);
      query.removeEventListener('change', onModeChange);
      landscapeQuery.removeEventListener('change', onModeChange);
      globalThis.removeEventListener('resize', onResize);
      teardown();
    },
  };
}
