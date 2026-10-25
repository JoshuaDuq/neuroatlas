/**
 * One tooltip for every element that carries `data-tooltip`, delegated from the document
 * (ported from viewer/ui/tooltip.js). `Tooltip.svelte` draws it.
 *
 * A hover waits SHOW_DELAY, so a pointer crossing a toolbar shows nothing; once one has been
 * read, the next within SKIP_WINDOW of it closing appears at once and without its entry.
 * Keyboard focus shows it at once. Escape, a press or a scroll hides it (WCAG 1.4.13: dismissible).
 * The pointer can cross the gap to the tooltip and read it (hoverable), inside `inGraceArea`.
 * The legacy 150 ms departure delay is replaced by that area (deviations/u5-tooltip-grace-area.md).
 */
export const SHOW_DELAY = 500;
export const SKIP_WINDOW = 300;

export interface TooltipTimingOptions<T> {
  /** Draws the tooltip for `trigger`; `instant` means no entry animation. */
  show(trigger: T, instant: boolean): void;
  hide(trigger: T): void;
  now(): number;
  schedule(callback: () => void, delay: number): unknown;
  cancel(timer: unknown): void;
}

/** The timing alone, with the clock and timers passed in. */
export function createTooltipTiming<T>({
  show,
  hide,
  now,
  schedule,
  cancel,
}: TooltipTimingOptions<T>) {
  let open: T | null = null;
  let waiting: T | null = null;
  let timer: unknown = null;
  let closedAt = -Infinity;

  const stopWaiting = () => {
    if (timer !== null) cancel(timer);
    timer = null;
    waiting = null;
  };
  const reveal = (trigger: T, instant: boolean) => {
    stopWaiting();
    if (open !== null && open !== trigger) hide(open);
    open = trigger;
    show(trigger, instant);
  };
  const close = () => {
    stopWaiting();
    if (open === null) return;
    hide(open);
    open = null;
    closedAt = now();
  };

  return {
    get open() {
      return open;
    },
    /** The pointer or keyboard focus reached `trigger`. */
    enter(trigger: T, { immediate = false } = {}) {
      if (trigger === open || trigger === waiting) return;
      if (immediate || open !== null || now() - closedAt < SKIP_WINDOW) {
        reveal(trigger, true);
        return;
      }
      stopWaiting();
      waiting = trigger;
      timer = schedule(() => reveal(trigger, false), SHOW_DELAY);
    },
    /** The pointer or focus left `trigger` (and, for the pointer, the grace area). */
    leave(trigger: T) {
      if (trigger === waiting) stopWaiting();
      if (trigger === open) close();
    },
    /** Escape, a press or a scroll. */
    dismiss: close,
  };
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Whether a pointer at (`x`, `y`) is still on its way to the tooltip: over the trigger, over the
 * tooltip, or in the box that spans both and so the gap between them (WCAG 1.4.13: hoverable).
 */
export function inGraceArea(x: number, y: number, trigger: Box, tip: Box): boolean {
  return (
    x >= Math.min(trigger.left, tip.left) &&
    x <= Math.max(trigger.right, tip.right) &&
    y >= Math.min(trigger.top, tip.top) &&
    y <= Math.max(trigger.bottom, tip.bottom)
  );
}

/**
 * The ids a trigger is described by with the tooltip added or removed. Where the tooltip only
 * repeats the trigger's own name, or a note it is already described by, describing it by the
 * tooltip would say it twice.
 */
export function describedBy(
  current: string | null,
  tipId: string,
  on: boolean,
  repeats: boolean,
): string | null {
  const ids = (current ?? '').split(/\s+/).filter((id) => id !== '' && id !== tipId);
  if (on && !repeats) ids.push(tipId);
  return ids.length > 0 ? ids.join(' ') : null;
}

export interface TooltipHost {
  /** The id of the tooltip element once it is drawn. */
  tipId: string;
  show(trigger: HTMLElement, instant: boolean): void;
  hide(trigger: HTMLElement): void;
}

/** Starts the delegated listeners. `dismiss` is for the content closing itself (Bits' Escape). */
export function startTooltips({ tipId, show, hide }: TooltipHost) {
  const setDescribedBy = (trigger: HTMLElement, on: boolean) => {
    const current = trigger.getAttribute('aria-describedby');
    const repeats = [
      trigger.getAttribute('aria-label'),
      ...(current ?? '').split(/\s+/).map((id) => document.getElementById(id)?.textContent),
    ].includes(trigger.dataset.tooltip ?? null);
    const next = describedBy(current, tipId, on, repeats);
    if (next === null) trigger.removeAttribute('aria-describedby');
    else trigger.setAttribute('aria-describedby', next);
  };

  const timing = createTooltipTiming<HTMLElement>({
    now: () => performance.now(),
    schedule: (callback, delay) => setTimeout(callback, delay),
    cancel: (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
    show(trigger, instant) {
      show(trigger, instant);
      setDescribedBy(trigger, true);
    },
    hide(trigger) {
      setDescribedBy(trigger, false);
      hide(trigger);
    },
  });

  const tip = () => document.getElementById(tipId);
  const triggerOf = (target: EventTarget | null) =>
    target instanceof Element ? target.closest<HTMLElement>('[data-tooltip]') : null;
  // A trigger whose own popover is open needs no tooltip over it.
  const wanted = (trigger: HTMLElement | null): trigger is HTMLElement =>
    trigger !== null &&
    Boolean(trigger.dataset.tooltip) &&
    trigger.getAttribute('aria-expanded') !== 'true';
  const focused = (trigger: HTMLElement) =>
    document.activeElement === trigger && trigger.matches(':focus-visible');

  // A pointer that has left the trigger keeps the tooltip while it heads for it.
  const retreat = (event: PointerEvent) => {
    const open = timing.open;
    const element = tip();
    if (open === null || element === null || focused(open)) return;
    // Leaving the window (no element entered) ends the visit.
    const heading =
      (event.type === 'pointermove' || event.relatedTarget !== null) &&
      inGraceArea(
        event.clientX,
        event.clientY,
        open.getBoundingClientRect(),
        element.getBoundingClientRect(),
      );
    if (!heading) timing.leave(open);
  };

  const listeners = {
    pointerover(event: PointerEvent) {
      if (event.pointerType === 'touch') return;
      if (tip()?.contains(event.target as Node)) return;
      const trigger = triggerOf(event.target);
      if (wanted(trigger)) timing.enter(trigger);
    },
    pointermove: retreat,
    pointerout(event: PointerEvent) {
      const trigger = triggerOf(event.target);
      if (trigger !== null && trigger !== timing.open) {
        if (!trigger.contains(event.relatedTarget as Node | null)) timing.leave(trigger);
        return;
      }
      retreat(event);
    },
    focusin(event: FocusEvent) {
      const trigger = triggerOf(event.target);
      if (wanted(trigger) && (event.target as Element).matches(':focus-visible')) {
        timing.enter(trigger, { immediate: true });
      }
    },
    focusout(event: FocusEvent) {
      const trigger = triggerOf(event.target);
      if (trigger !== null && !trigger.matches(':hover') && !tip()?.matches(':hover')) {
        timing.leave(trigger);
      }
    },
    keydown(event: KeyboardEvent) {
      if (event.key === 'Escape') timing.dismiss();
    },
    pointerdown: () => timing.dismiss(),
    scroll: () => timing.dismiss(),
  };
  const options = { capture: true, passive: true };
  for (const [type, listener] of Object.entries(listeners)) {
    document.addEventListener(type, listener as EventListener, options);
  }
  return {
    dismiss: timing.dismiss,
    dispose() {
      timing.dismiss();
      for (const [type, listener] of Object.entries(listeners)) {
        document.removeEventListener(type, listener as EventListener, options);
      }
    },
  };
}
