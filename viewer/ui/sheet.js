import { PHONE_QUERY } from '../render/device.js';
import { SIDEWAYS_DETENTS, clampDrag, detentHeights, settleDetent, stepDetent } from './detents.js';
import { t } from '../i18n/translations.js';

const TABS = ['find', 'region', 'cuts', 'display'];

/** Movement that turns a press on the grip into a drag rather than a tap. */
const DRAG_THRESHOLD_PX = 8;

/**
 * The task panel becomes a sheet over a full-bleed canvas on phones.
 *
 * The sheet reports how much of the canvas it covers rather than resizing it.
 * Resizing would reallocate the composer target and both outline passes on every
 * frame of a drag; an inset costs a projection shift.
 *
 * The selection strip is deliberately not a tab. Tapping the model while the
 * cuts panel is open should confirm what was hit without throwing the reader
 * out of the task they were in, so the strip sits above the tabs and is
 * always visible.
 */
export function createSheet({ onInsets, onDetent, onShell, onPanelChange } = {}) {
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
  const panels = [navigator_, ...groups];

  const query = globalThis.matchMedia?.(PHONE_QUERY) ?? { matches: false, addEventListener() {}, removeEventListener() {} };
  const landscapeQuery = globalThis.matchMedia?.('(orientation: landscape)')
    ?? { matches: false, addEventListener() {}, removeEventListener() {} };

  let active = 'find';
  let detent = 'peek';
  let lang = 'en';
  let phone = query.matches;

  const buttons = TABS.map(name => {
    const panel = panels.find(panel => panel.dataset.tab === name);
    panel.id ||= `workspace-panel-${name}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.role = 'tab';
    button.id = `sheet-tab-${name}`;
    button.dataset.tab = name;
    button.setAttribute('aria-controls', panel.id);
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
   * Tell the renderer how much of the canvas is covered, so framing and the
   * viewport chrome agree about where the viewport is.
   *
   * The target span is reported, not the box: mid-transition the box is still
   * moving, and the framing that follows a detent change has to fit where the
   * sheet will land. Upright peek is the exception — it hugs the grip, so its
   * height is only known by measuring.
   */
  function report(pixels) {
    if (!phone) {
      onInsets?.({ top: 0, right: 0, bottom: 0, left: 0 });
      return;
    }
    const span = !isSideways() && detent === 'peek'
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

  function setTab(name) {
    active = name;
    for (const button of buttons) {
      const selected = button.dataset.tab === name;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
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
    onPanelChange?.();
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
  const onTabKeyDown = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1
      : (TABS.indexOf(active) + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
    setTab(TABS[index]);
    if (detent === 'peek') setDetent('half');
    buttons[index].focus();
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
  tabs.addEventListener('keydown', onTabKeyDown);

  // The grip is sized by its text, which arrives after setup; peek follows it.
  const observer = globalThis.ResizeObserver ? new ResizeObserver(() => {
    if (phone && detent === 'peek' && !press?.dragging) report(heights().peek);
  }) : null;
  observer?.observe(grip);

  // ---- mode -------------------------------------------------------------

  /** Hand the rails back to the grid, and the panels to the inspector tabs. */
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
    onShell?.('rails');
  }

  function setup() {
    onShell?.('sheet');
    grip.hidden = false;
    for (const panel of panels) panel.setAttribute('aria-labelledby', `sheet-tab-${panel.dataset.tab}`);
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
    get tab() { return active; },

    /**
     * A tap on the anatomy is a request to read it. At peek the sheet is
     * only a name; open it. If the reader was browsing the tree, switch to
     * the region panel. Leave Cuts and Display alone — they are already
     * working on this view.
     */
    revealOnSelect() {
      if (!phone) return;
      if (active === 'find') setTab('region');
      if (detent === 'peek') setDetent('half');
    },

    /**
     * Open a named panel. A no-op on desktop, where the inspector tabs own
     * the rails; on a phone this is the only writer of sheet visibility.
     */
    show(name) {
      if (!phone || !TABS.includes(name)) return;
      setTab(name);
      if (detent === 'peek') setDetent('half');
    },

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
      observer?.disconnect();
      grip.removeEventListener('pointerdown', onPointerDown);
      globalThis.removeEventListener('pointermove', onPointerMove);
      globalThis.removeEventListener('pointerup', onPointerUp);
      globalThis.removeEventListener('pointercancel', onPointerUp);
      handle.removeEventListener('click', onHandle);
      selection.removeEventListener('click', onSelection);
      tabs.removeEventListener('keydown', onTabKeyDown);
      query.removeEventListener('change', onModeChange);
      landscapeQuery.removeEventListener('change', onModeChange);
      globalThis.removeEventListener('resize', onResize);
      tabs.replaceChildren();
      teardown();
    },
  };
}
