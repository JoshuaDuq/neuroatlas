import { PHONE_QUERY } from '../render/device.js';
import {
  SIDEWAYS_DETENTS, UPRIGHT_DETENTS, clampDrag, detentHeights, settleDetent, stepDetent,
} from './detents.js';
import { t } from '../i18n/translations.js';

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

  /** The sheet's span along the axis it grows on: height, or width sideways. */
  const isSideways = () => landscapeQuery.matches;
  const available = () => {
    const rect = viewport.getBoundingClientRect();
    return isSideways() ? globalThis.innerWidth : rect.height || globalThis.innerHeight;
  };
  // Upright, peek is wherever the grip ends, so a drag from rest starts where the sheet is.
  const heights = () => detentHeights(available(), isSideways() ? SIDEWAYS_DETENTS : {
    ...UPRIGHT_DETENTS,
    peek: Math.round(grip.getBoundingClientRect().bottom - sheet.getBoundingClientRect().top),
  });

  /*
   * Written as the box's own size rather than an inherited custom property:
   * a property every descendant inherits restyled the whole panel, thousands
   * of tree rows, on every frame of a drag.
   */
  function applySpan(pixels) {
    const span = `${Math.round(pixels)}px`;
    const dragging = Boolean(press?.dragging);
    if (isSideways()) {
      // The viewport does not move during a drag; reading it there would force a layout.
      if (!dragging) sheet.style.top = `${Math.round(viewport.getBoundingClientRect().top)}px`;
      sheet.style.width = span;
      sheet.style.removeProperty('height');
    } else {
      // Settled at peek the stylesheet sizes the sheet to its grip.
      if (detent === 'peek' && !dragging) sheet.style.removeProperty('height');
      else sheet.style.height = span;
      sheet.style.removeProperty('width');
      sheet.style.removeProperty('top');
    }
    report(pixels);
  }

  /**
   * Tell the renderer how much of the canvas is covered, so framing and the
   * viewport chrome agree about where the viewport is.
   *
   * The target span is reported, not the box: mid-transition the box is still
   * moving, and the framing that follows a detent change has to fit where the
   * sheet will land. Upright peek at rest is the exception — it hugs the
   * grip, so its height is only known by measuring. A drag from peek already
   * knows its span.
   */
  function report(pixels) {
    if (!phone) {
      onInsets?.({ top: 0, right: 0, bottom: 0, left: 0 });
      return;
    }
    const span = !isSideways() && detent === 'peek' && !press?.dragging
      ? sheet.getBoundingClientRect().height || pixels
      : pixels;
    onInsets?.(isSideways()
      ? { top: 0, right: 0, bottom: 0, left: span }
      : { top: 0, right: 0, bottom: span, left: 0 });
  }

  function setDetent(next, { notify = true } = {}) {
    detent = next;
    sheet.dataset.detent = next;
    handle.setAttribute('aria-expanded', String(next !== 'peek'));
    handle.setAttribute('aria-label', t(lang, 'sheet')[next === 'peek' ? 'expand' : 'collapse']);
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
    if (!phone || event.button !== 0) return;
    press = {
      id: event.pointerId,
      origin: isSideways() ? event.clientX : event.clientY,
      span: isSideways() ? sheet.getBoundingClientRect().width : sheet.getBoundingClientRect().height,
      // The rests do not move during a drag, so they are measured once.
      heights: heights(),
      dragging: false,
      last: { at: event.timeStamp, span: 0 },
      velocity: 0,
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
    const elapsed = event.timeStamp - press.last.at;
    if (elapsed > 0) press.velocity = (span - press.last.span) / elapsed;
    press.last = { at: event.timeStamp, span };
    applySpan(span);
    if (event.cancelable) event.preventDefault();
  };

  const onPointerUp = event => {
    if (!press || event.pointerId !== press.id) return;
    const dragged = press.dragging;
    const span = press.last.span;
    const velocity = press.velocity;
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

  // The grip is sized by its text, which arrives after setup; peek follows it.
  const observer = globalThis.ResizeObserver ? new ResizeObserver(() => {
    if (phone && detent === 'peek' && !press?.dragging) report(heights().peek);
  }) : null;
  observer?.observe(grip);

  // ---- mode -------------------------------------------------------------

  /** Hand the panel back to the grid. */
  function teardown() {
    grip.hidden = true;
    sheet.style.removeProperty('height');
    sheet.style.removeProperty('width');
    sheet.style.removeProperty('top');
    delete sheet.dataset.detent;
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
    if (phone) setup();
    else teardown();
  }

  query.addEventListener('change', onModeChange);
  landscapeQuery.addEventListener('change', onModeChange);
  const onResize = () => { if (phone) applySpan(heights()[detent]); };
  globalThis.addEventListener('resize', onResize);

  onModeChange();

  return {
    get isPhone() { return phone; },
    get detent() { return detent; },

    /** A tap on the anatomy is a request to read it; at peek the sheet is only a name. */
    revealOnSelect: raise,
    raise,

    update(state, { label, side, clearable } = {}) {
      lang = state.lang;
      const copy = t(state.lang, 'sheet');
      handle.setAttribute('aria-label', copy[detent === 'peek' ? 'expand' : 'collapse']);
      selection.hidden = !label;
      gripRow.dataset.selection = String(Boolean(label));
      selectionClear.hidden = !label || !clearable;
      selectionClear.setAttribute('aria-label', t(state.lang, 'inspector').clearSelection);
      if (label) {
        selectionName.textContent = label;
        selectionSide.textContent = side ?? '';
      }
      disclaimer.textContent = t(state.lang, 'footer').statementAlone;
    },

    dispose() {
      observer?.disconnect();
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
