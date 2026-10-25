import { bindRoving } from '../roving.js';

/**
 * Whether the section row folds Reverse side and Linked MRI behind its disclosure: always on a
 * phone (`need` null), elsewhere only when its one line, `need` pixels wide, would not fit `room`.
 */
export function compactSection({ room, need }) {
  return need === null || need > room;
}

/**
 * A popover opening upward above the whole dock, on the dock's start edge whichever tool opened
 * it, kept inside the visible stage. Rectangles are in stage coordinates; `toolbar` is the
 * popover's offset parent (the dock), and the returned `left` is relative to it. A full-width
 * phone popover stops a third of the stage short of the top, so the anatomy it adjusts stays in
 * sight; past that it scrolls.
 */
export function placePopover({ toolbar, visible, width, fill = false, gap = 8, gutter = 16 }) {
  const room = Math.max(0, visible.width - 2 * gutter);
  const span = fill ? room : Math.min(width, room);
  const min = visible.x + gutter;
  const max = Math.max(min, visible.x + visible.width - gutter - span);
  const left = Math.min(Math.max(toolbar.left, min), max);
  const stage = toolbar.top - visible.y;
  const keep = fill ? Math.max(gutter, stage / 3) : gutter;
  return {
    left: Math.round(left - toolbar.left),
    width: Math.round(span),
    maxHeight: Math.max(0, Math.floor(stage - gap - keep)),
  };
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled])';
const visibleIn = node => node.checkVisibility?.() ?? true;

/**
 * The View, Section and Display popovers: one open at a time, Escape and outside clicks close
 * them, and focus returns to the button that opened them. The first opened by a pointer grows
 * from the dock's corner; one replacing another, or opened or closed by a key, is simply there or gone.
 */
export function createStagePopovers(host, { visibleRect, fill }) {
  const pairs = [...host.querySelectorAll('[aria-haspopup="dialog"][aria-controls]')]
    .map(button => ({ button, popover: document.getElementById(button.getAttribute('aria-controls')) }));
  // Each exclusive choice is one Tab stop. The presets rove from viewport-chrome.js, which presses them.
  const groups = pairs.flatMap(({ popover }) => [...popover.querySelectorAll('.segmented:not(#views)')])
    .map(group => bindRoving(group));
  let open = null;

  function place() {
    if (!open) return;
    const rect = visibleRect();
    if (!rect) return;
    const origin = host.getBoundingClientRect();
    const toolbar = open.popover.offsetParent?.getBoundingClientRect();
    if (!toolbar) return;
    open.popover.style.width = '';
    const spot = placePopover({
      toolbar: { left: toolbar.left - origin.left, top: toolbar.top - origin.top },
      visible: rect,
      width: open.popover.offsetWidth,
      fill: fill(),
      // The dock's own gutter, so a popover's edges stand on the dock's.
      gutter: parseFloat(getComputedStyle(host).getPropertyValue('--stage-gutter')),
    });
    // `left` is measured from the dock's outer edge; CSS places it inside the dock's border.
    open.popover.style.left = `${spot.left - open.popover.offsetParent.clientLeft}px`;
    open.popover.style.width = `${spot.width}px`;
    open.popover.style.maxHeight = `${spot.maxHeight}px`;
  }

  function show(pair, { instant = false } = {}) {
    const replacing = Boolean(open);
    hide({ instant: true });
    open = pair;
    pair.popover.toggleAttribute('data-instant', instant || replacing);
    pair.popover.hidden = false;
    pair.button.setAttribute('aria-expanded', 'true');
    place();
    const controls = [...pair.popover.querySelectorAll(FOCUSABLE)].filter(visibleIn);
    const target = controls.find(control => control.getAttribute('aria-pressed') === 'true') ?? controls[0];
    target?.focus({ preventScroll: true });
  }

  function hide({ restore = false, instant = false } = {}) {
    if (!open) return;
    const { button, popover } = open;
    open = null;
    popover.toggleAttribute('data-instant', instant);
    popover.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (restore && visibleIn(button)) button.focus({ preventScroll: true });
  }

  const within = (pair, node) => node && (pair.popover.contains(node) || pair.button.contains(node));
  const controller = new AbortController();
  const { signal } = controller;

  // A click with no pointer behind it (detail 0) came from Enter or Space.
  const byKey = event => event.detail === 0;
  // The tool a pointer is pressing: its click replaces the open popover, so the press leaves it be.
  let pressed = null;
  for (const pair of pairs) {
    pair.button.addEventListener('click', event => {
      pressed = null;
      if (open === pair) hide({ instant: byKey(event) }); else show(pair, { instant: byKey(event) });
    }, { signal });
    for (const node of [pair.button, pair.popover]) {
      node.addEventListener('keydown', event => {
        if (event.key !== 'Escape' || open !== pair) return;
        event.preventDefault();
        hide({ restore: true, instant: true });
      }, { signal });
      // Focus leaving by Tab; a pointer press elsewhere has already closed the popover.
      node.addEventListener('focusout', event => {
        const next = event.relatedTarget;
        if (open === pair && next && !within(pair, next) && !pressed?.button.contains(next)) hide({ instant: true });
      }, { signal });
    }
    pair.popover.addEventListener('click', event => {
      if (event.target.closest('[data-closes-popover], [data-cut-mode], [data-view]')) {
        hide({ restore: true, instant: byKey(event) });
      }
    }, { signal });
    pair.popover.addEventListener('keydown', event => {
      // The segmented groups rove on their own and mark the keys they use.
      if (event.defaultPrevented) return;
      // The page uses ↑ ↓ to walk the anatomy tree; inside a popover they stay put.
      if (['ArrowUp', 'ArrowDown'].includes(event.key) && event.target.matches('button, [type="checkbox"]')) {
        event.preventDefault();
      }
    }, { signal });
  }
  document.addEventListener('pointerdown', event => {
    pressed = pairs.find(pair => pair.button.contains(event.target)) ?? null;
    if (open && !within(open, event.target) && !pressed) hide();
  }, { capture: true, signal });

  return {
    place,
    hide,
    get open() { return open?.popover.id ?? null; },
    dispose() {
      hide();
      controller.abort();
      for (const group of groups) group.dispose();
    },
  };
}
