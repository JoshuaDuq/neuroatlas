import { bindRoving } from './roving.js';

/**
 * How the dock lays out in `room` pixels: the presets inline only when the tools fit with them
 * (otherwise View ▾ holds them, never a clipped strip), and the section bar whole only when its
 * first row fits on one line. `needs` is null on a phone, which always takes the compact dock.
 */
export function dockArrangement({ room, needs }) {
  if (!needs) return { menu: true, compact: true };
  return { menu: needs.tools > room, compact: needs.section > room };
}

/**
 * A popover opening upward from its button, above the whole dock, kept inside the visible stage.
 * Rectangles are in stage coordinates; `toolbar` is the popover's offset parent (the dock),
 * and the returned `left` is relative to it. A full-width phone popover stops a third of the
 * stage short of the top, so the anatomy it adjusts stays in sight; past that it scrolls.
 */
export function placePopover({ anchor, toolbar, visible, width, fill = false, gap = 8, gutter = 16 }) {
  const room = Math.max(0, visible.width - 2 * gutter);
  const span = fill ? room : Math.min(width, room);
  const min = visible.x + gutter;
  const max = Math.max(min, visible.x + visible.width - gutter - span);
  const left = Math.min(Math.max(anchor.left, min), max);
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
 * The Section and Display popovers: one open at a time, Escape and outside
 * clicks close them, and focus returns to the button that opened them.
 */
export function createStagePopovers(host, { visibleRect, fill }) {
  const pairs = [...host.querySelectorAll('[aria-haspopup="dialog"][aria-controls]')]
    .map(button => ({ button, popover: document.getElementById(button.getAttribute('aria-controls')) }));
  // Each exclusive choice is one Tab stop. The presets rove from viewport-chrome.js wherever they sit.
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
    const anchor = open.button.getBoundingClientRect();
    open.popover.style.width = '';
    const spot = placePopover({
      anchor: { left: anchor.left - origin.left },
      toolbar: { left: toolbar.left - origin.left, top: toolbar.top - origin.top },
      visible: rect,
      width: open.popover.offsetWidth,
      fill: fill(),
    });
    open.popover.style.left = `${spot.left}px`;
    open.popover.style.width = `${spot.width}px`;
    open.popover.style.maxHeight = `${spot.maxHeight}px`;
  }

  function show(pair) {
    hide();
    open = pair;
    pair.popover.hidden = false;
    pair.button.setAttribute('aria-expanded', 'true');
    place();
    const target = pair.popover.querySelector('[aria-pressed="true"]')
      ?? [...pair.popover.querySelectorAll(FOCUSABLE)].find(visibleIn);
    target?.focus({ preventScroll: true });
  }

  function hide({ restore = false } = {}) {
    if (!open) return;
    const { button, popover } = open;
    open = null;
    popover.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (restore && visibleIn(button)) button.focus({ preventScroll: true });
  }

  const within = (pair, node) => node && (pair.popover.contains(node) || pair.button.contains(node));
  const controller = new AbortController();
  const { signal } = controller;

  for (const pair of pairs) {
    pair.button.addEventListener('click', () => (open === pair ? hide() : show(pair)), { signal });
    for (const node of [pair.button, pair.popover]) {
      node.addEventListener('keydown', event => {
        if (event.key !== 'Escape' || open !== pair) return;
        event.preventDefault();
        hide({ restore: true });
      }, { signal });
      node.addEventListener('focusout', event => {
        if (open === pair && event.relatedTarget && !within(pair, event.relatedTarget)) hide();
      }, { signal });
    }
    pair.popover.addEventListener('click', event => {
      if (event.target.closest('[data-closes-popover], [data-cut-mode], [data-view]')) hide({ restore: true });
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
    if (open && !within(open, event.target)) hide();
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
