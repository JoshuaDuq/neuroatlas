import { PHONE_QUERY } from '../render/device.js';
import { SIDEWAYS_DETENTS, clampDrag, detentHeights, settleDetent, stepDetent } from './detents.js';
import { t } from '../i18n/translations.js';

const TABS = ['find', 'region', 'cuts', 'display'];

/** Movement that turns a press on the grip into a drag rather than a tap. */
const DRAG_THRESHOLD_PX = 8;

/**
 * The phone shell: the two rails as one sheet over a full-bleed canvas.
 *
 * Above the phone breakpoint this does nothing at all — the wrapper is
 * display:contents there and the rails are grid items exactly as before, so
 * the desktop layout never runs a line of this code.
 *
 * The sheet reports how much of the canvas it covers rather than resizing it.
 * Resizing would reallocate the composer target, the occlusion pass and both
 * outline passes on every frame of a drag; an inset costs a projection shift.
 *
 * The selection strip is deliberately not a tab. Tapping the model while the
 * cuts panel is open should confirm what was hit without throwing the reader
 * out of the task they were in, so the strip sits above the tabs and is
 * always visible.
 */
export function createSheet({ onInsets, onDetent } = {}) {
  const sheet = document.getElementById('sheet');
  const grip = document.getElementById('sheet-grip');
  const handle = document.getElementById('sheet-handle');
  const selection = document.getElementById('sheet-selection');
  const selectionName = document.getElementById('sheet-selection-name');
  const selectionSide = document.getElementById('sheet-selection-side');
  const tabs = document.getElementById('sheet-tabs');
  const disclaimer = document.getElementById('sheet-disclaimer');
  const navigator_ = document.getElementById('navigator');
  const inspector = document.getElementById('inspector');
  const viewport = document.getElementById('viewport');
  const groups = [...document.querySelectorAll('.tab-group')];

  const query = globalThis.matchMedia?.(PHONE_QUERY) ?? { matches: false, addEventListener() {}, removeEventListener() {} };
  const landscapeQuery = globalThis.matchMedia?.('(orientation: landscape)')
    ?? { matches: false, addEventListener() {}, removeEventListener() {} };

  let active = 'find';
  let detent = 'peek';
  let lang = 'en';
  let phone = query.matches;

  const buttons = TABS.map(name => {
    const button = document.createElement('button');
    button.type = 'button';
    button.role = 'tab';
    button.dataset.tab = name;
    button.setAttribute('aria-selected', String(name === active));
    button.addEventListener('click', () => {
      setTab(name);
      // Choosing a panel with the sheet at rest should open it; a reader who
      // has already raised it is left where they put it.
      if (detent === 'peek') setDetent('half');
    });
    tabs.append(button);
    return button;
  });

  /** The sheet's span along the axis it grows on: height, or width sideways. */
  const isSideways = () => landscapeQuery.matches;
  const available = () => {
    const rect = viewport.getBoundingClientRect();
    return isSideways() ? globalThis.innerWidth : rect.height || globalThis.innerHeight;
  };
  const heights = () => detentHeights(available(), isSideways() ? SIDEWAYS_DETENTS : {});

  function applySpan(pixels) {
    const property = isSideways() ? '--sheet-width' : '--sheet-height';
    const other = isSideways() ? '--sheet-height' : '--sheet-width';
    sheet.style.setProperty(property, `${Math.round(pixels)}px`);
    sheet.style.removeProperty(other);
    if (isSideways()) sheet.style.setProperty('--sheet-top', `${Math.round(viewport.getBoundingClientRect().top)}px`);
    report(pixels);
  }

  /**
   * Tell the renderer how much of the canvas is covered, so framing, the
   * reticle and the viewport chrome all agree about where the viewport is.
   */
  function report(pixels) {
    if (!phone) {
      onInsets?.({ top: 0, right: 0, bottom: 0, left: 0 });
      return;
    }
    onInsets?.(isSideways()
      ? { top: 0, right: 0, bottom: 0, left: pixels }
      : { top: 0, right: 0, bottom: pixels, left: 0 });
  }

  function setDetent(next, { notify = true } = {}) {
    detent = next;
    sheet.dataset.detent = next;
    handle.setAttribute('aria-expanded', String(next !== 'peek'));
    handle.setAttribute('aria-label', t(lang, 'sheet')[next === 'peek' ? 'expand' : 'collapse']);
    applySpan(heights()[next]);
    if (notify) onDetent?.(next);
  }

  function setTab(name) {
    active = name;
    for (const button of buttons) {
      button.setAttribute('aria-selected', String(button.dataset.tab === name));
    }
    navigator_.hidden = name !== 'find';
    inspector.hidden = name === 'find';
    for (const group of groups) group.hidden = group.dataset.tab !== name;
    // Whichever group leads the panel has nothing above it to rule off.
    const panel = name === 'find' ? navigator_ : inspector.querySelector('.rail-body');
    for (const node of document.querySelectorAll('.sheet-panel-first')) {
      node.classList.remove('sheet-panel-first');
    }
    panel?.classList.add('sheet-panel-first');
  }

  // ---- dragging ---------------------------------------------------------

  let press = null;

  const onPointerDown = event => {
    if (!phone || event.button !== 0) return;
    press = {
      id: event.pointerId,
      origin: isSideways() ? event.clientX : event.clientY,
      span: isSideways() ? sheet.getBoundingClientRect().width : sheet.getBoundingClientRect().height,
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
    const span = clampDrag(press.span + travel, heights());
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
  const onSelection = () => {
    setTab('region');
    if (detent === 'peek') setDetent('half');
  };

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
  selection.addEventListener('click', onSelection);

  // ---- mode -------------------------------------------------------------

  /** Hand the rails back to the grid, exactly as they were. */
  function teardown() {
    grip.hidden = true;
    navigator_.hidden = false;
    inspector.hidden = false;
    for (const group of groups) group.hidden = false;
    for (const node of document.querySelectorAll('.sheet-panel-first')) {
      node.classList.remove('sheet-panel-first');
    }
    sheet.style.removeProperty('--sheet-height');
    sheet.style.removeProperty('--sheet-width');
    sheet.style.removeProperty('--sheet-top');
    delete sheet.dataset.detent;
    report(0);
  }

  function setup() {
    grip.hidden = false;
    sheet.dataset.dragging = 'false';
    setTab(active);
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

    update(state, { label, side } = {}) {
      lang = state.lang;
      const copy = t(state.lang, 'sheet');
      for (const button of buttons) button.textContent = copy.tabs[button.dataset.tab];
      tabs.setAttribute('aria-label', copy.tabsAria);
      handle.setAttribute('aria-label', copy[detent === 'peek' ? 'expand' : 'collapse']);
      selection.hidden = !label;
      if (label) {
        selectionName.textContent = label;
        selectionSide.textContent = side ?? '';
      }
      disclaimer.textContent = copy.disclaimer;
    },

    dispose() {
      grip.removeEventListener('pointerdown', onPointerDown);
      globalThis.removeEventListener('pointermove', onPointerMove);
      globalThis.removeEventListener('pointerup', onPointerUp);
      globalThis.removeEventListener('pointercancel', onPointerUp);
      handle.removeEventListener('click', onHandle);
      selection.removeEventListener('click', onSelection);
      query.removeEventListener('change', onModeChange);
      landscapeQuery.removeEventListener('change', onModeChange);
      globalThis.removeEventListener('resize', onResize);
      tabs.replaceChildren();
      teardown();
    },
  };
}
