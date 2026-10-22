/**
 * One tooltip for every element that carries data-tooltip, delegated from the document.
 *
 * A hover waits SHOW_DELAY, so a pointer crossing a toolbar shows nothing; once one has been
 * read, the next within SKIP_WINDOW of it closing appears at once and without its entry.
 * Keyboard focus shows it at once. Escape, a press or a scroll hides it. It sits on the edge of
 * its trigger that has room inside the viewport and grows from that edge (components.css).
 */
export const SHOW_DELAY = 500;
export const SKIP_WINDOW = 300;
const GAP = 8;
const MARGIN = 8;

/**
 * The timing alone, with the clock and timers passed in. `show(trigger, instant)` and
 * `hide(trigger)` draw; `instant` means no entry animation.
 */
export function createTooltipTiming({ show, hide, now, schedule, cancel }) {
  let open = null;
  let waiting = null;
  let timer = null;
  let closedAt = -Infinity;

  const stopWaiting = () => {
    if (timer !== null) cancel(timer);
    timer = null;
    waiting = null;
  };
  const reveal = (trigger, instant) => {
    stopWaiting();
    if (open && open !== trigger) hide(open);
    open = trigger;
    show(trigger, instant);
  };
  const close = () => {
    stopWaiting();
    if (!open) return;
    hide(open);
    open = null;
    closedAt = now();
  };

  return {
    get open() { return open; },
    /** The pointer or keyboard focus reached `trigger`. */
    enter(trigger, { immediate = false } = {}) {
      if (trigger === open || trigger === waiting) return;
      if (immediate || open || now() - closedAt < SKIP_WINDOW) {
        reveal(trigger, true);
        return;
      }
      stopWaiting();
      waiting = trigger;
      timer = schedule(() => reveal(trigger, false), SHOW_DELAY);
    },
    /** The pointer or focus left `trigger`. */
    leave(trigger) {
      if (trigger === waiting) stopWaiting();
      if (trigger === open) close();
    },
    /** Escape, a press or a scroll. */
    dismiss: close,
  };
}

/**
 * Where a tooltip of `size` goes for a trigger at `anchor` (DOMRect-like) in a viewport of
 * `width` × `height`: below it where it fits, otherwise above; centred on it, kept inside the
 * viewport, on whole pixels. `origin` is the trigger's edge, for the growth from it.
 */
export function placeTooltip(anchor, size, { width, height }) {
  const fitsBelow = anchor.bottom + GAP + size.height <= height - MARGIN;
  const fitsAbove = anchor.top - GAP - size.height >= MARGIN;
  const side = fitsBelow || !fitsAbove ? 'bottom' : 'top';
  const top = side === 'bottom' ? anchor.bottom + GAP : anchor.top - GAP - size.height;
  const centre = anchor.left + anchor.width / 2;
  const left = Math.max(MARGIN, Math.min(centre - size.width / 2, width - MARGIN - size.width));
  return {
    side,
    left: Math.round(left),
    top: Math.round(top),
    origin: `${Math.round(centre - left)}px ${side === 'bottom' ? '0' : '100%'}`,
  };
}

/** Start the one tooltip for the page. */
export function startTooltips() {
  const tip = document.createElement('div');
  tip.id = 'tooltip';
  tip.className = 'tooltip';
  tip.setAttribute('role', 'tooltip');
  // The top layer, so a tooltip inside an open dialog is drawn over it.
  tip.popover = 'manual';
  document.body.append(tip);

  // Where the tooltip only repeats the trigger's own name, or a note it is already described by,
  // describing the trigger by it would say it twice.
  const describe = (trigger, on) => {
    const ids = (trigger.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(id => id && id !== tip.id);
    const repeats = [trigger.getAttribute('aria-label'), ...ids.map(id => document.getElementById(id)?.textContent)]
      .includes(trigger.dataset.tooltip);
    if (on && !repeats) ids.push(tip.id);
    if (ids.length) trigger.setAttribute('aria-describedby', ids.join(' '));
    else trigger.removeAttribute('aria-describedby');
  };

  const timing = createTooltipTiming({
    now: () => performance.now(),
    schedule: (callback, delay) => setTimeout(callback, delay),
    cancel: timer => clearTimeout(timer),
    show(trigger, instant) {
      tip.textContent = trigger.dataset.tooltip;
      tip.toggleAttribute('data-instant', instant);
      if (!tip.matches(':popover-open')) tip.showPopover();
      // Layout size, not the box mid-entry, which is scaled.
      const { left, top, origin } = placeTooltip(trigger.getBoundingClientRect(),
        { width: tip.offsetWidth, height: tip.offsetHeight },
        { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight });
      tip.style.left = `${left}px`;
      tip.style.top = `${top}px`;
      tip.style.setProperty('--tooltip-origin', origin);
      describe(trigger, true);
    },
    hide(trigger) {
      describe(trigger, false);
      tip.removeAttribute('data-instant');
      tip.hidePopover();
    },
  });

  const triggerOf = target => (target instanceof Element ? target.closest('[data-tooltip]') : null);
  // A trigger whose own popover is open needs no tooltip over it.
  const wanted = trigger => Boolean(trigger?.dataset.tooltip) && trigger.getAttribute('aria-expanded') !== 'true';

  const listeners = {
    pointerover(event) {
      const trigger = triggerOf(event.target);
      if (event.pointerType !== 'touch' && wanted(trigger)) timing.enter(trigger);
    },
    pointerout(event) {
      const trigger = triggerOf(event.target);
      if (trigger && !trigger.contains(event.relatedTarget)) timing.leave(trigger);
    },
    focusin(event) {
      const trigger = triggerOf(event.target);
      if (wanted(trigger) && event.target.matches(':focus-visible')) timing.enter(trigger, { immediate: true });
    },
    focusout(event) {
      const trigger = triggerOf(event.target);
      if (trigger) timing.leave(trigger);
    },
    keydown(event) {
      if (event.key === 'Escape') timing.dismiss();
    },
    pointerdown: () => timing.dismiss(),
    scroll: () => timing.dismiss(),
  };
  for (const [type, listener] of Object.entries(listeners)) document.addEventListener(type, listener, { capture: true, passive: true });
}
