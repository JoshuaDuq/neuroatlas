<!--
  The name of the region under the pointer, beside the pointer (viewport-chrome.js:850-866; stage.css:89-101).
  On the chip rather than in a rail: the reader is reading the cut face, and a name that appears at the far
  edge of the screen is a name they have to leave the anatomy to find.

  Not a tooltip: nothing focusable triggers it, it follows the pointer, and the same words reach assistive
  technology through the selection and the tree, so it is `aria-hidden` and has no role. Written straight
  into the DOM from the engine's `hover` event, once per pointer move: text only when it changed, position
  clamped 8 px inside the stage. It goes with any camera move, and Escape dismisses it (WCAG 1.4.13) until
  the pointer is over another region or has left and returned.
-->
<script lang="ts">
  import type { Engine, HoverEvent } from '../../lib/engine/api.ts';
  import { hoverText } from './hover-text.ts';
  import type { HoverSources, HoverView } from './hover-text.ts';

  interface Props {
    engine: Pick<Engine, 'on'>;
    /** What the words are derived from; the chip is re-worded when it changes under a still pointer. */
    view: HoverView;
    sources: HoverSources;
  }

  let { engine, view, sources }: Props = $props();

  /** Distance of the chip from the pointer, and the least it keeps from the stage's edge (viewport-chrome.js:862). */
  const POINTER_OFFSET_PX = 14;
  const EDGE_PX = 8;

  let chip: HTMLElement;
  let last: HoverEvent | null = null;
  // The stage's and the chip's boxes are read from layout: once, not on every pointer move.
  let bounds: DOMRect | null = null;
  let size: { width: number; height: number } | null = null;
  // The region Escape dismissed the chip for.
  let dismissed: string | null = null;

  function show(event: HoverEvent) {
    last = event;
    const { region, position } = event;
    if (dismissed !== null && region?.id !== dismissed) dismissed = null;
    const text = region && position && dismissed === null ? hoverText(region, view, sources) : null;
    if (!text || !position) {
      chip.hidden = true;
      return;
    }
    chip.hidden = false;
    if (chip.textContent !== text) {
      chip.textContent = text;
      size = null;
    }
    place(position);
  }

  function place(position: { x: number; y: number }) {
    bounds ??= chip.parentElement!.getBoundingClientRect();
    size ??= { width: chip.offsetWidth, height: chip.offsetHeight };
    chip.style.left = `${Math.max(EDGE_PX, Math.min(position.x + POINTER_OFFSET_PX, bounds.width - size.width - EDGE_PX))}px`;
    chip.style.top = `${Math.max(EDGE_PX, Math.min(position.y + POINTER_OFFSET_PX, bounds.height - size.height - EDGE_PX))}px`;
  }

  // The chip's and the stage's boxes change with a late webfont, larger text or text spacing as well as
  // with the words, so both are watched (WCAG 1.4.4, 1.4.12): the chip stays inside the stage.
  $effect(() => {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === chip) {
          if (chip.hidden) continue;
          const box = entry.borderBoxSize[0]!;
          size = { width: box.inlineSize, height: box.blockSize };
        } else {
          bounds = null;
        }
      }
      if (!chip.hidden && last?.position) place(last.position);
    });
    observer.observe(chip);
    observer.observe(chip.parentElement!);
    return () => observer.disconnect();
  });

  $effect(() => {
    const stops = [
      engine.on('hover', show),
      // The chip named what was under the pointer before the move; the next pointer move renames it.
      engine.on('camera', () => (chip.hidden = true)),
      engine.on('viewport', () => {
        bounds = null;
        size = null;
      }),
    ];
    return () => stops.forEach((stop) => stop());
  });

  // The selection, the colouring or the language changed under a still pointer.
  $effect(() => {
    void view;
    void sources;
    if (last) show(last);
  });

  $effect(() => {
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || chip.hidden) return;
      // An Escape inside an open dialog closes the dialog; the chip has no claim on it.
      if (event.target instanceof Element && event.target.closest('dialog[open]')) return;
      // The next Escape, with the chip gone, is the page's: the keymap skips an event already handled.
      event.preventDefault();
      dismissed = last!.region!.id;
      chip.hidden = true;
    };
    document.addEventListener('keydown', onKeydown);
    return () => document.removeEventListener('keydown', onKeydown);
  });
</script>

<div id="hover-label" class="chip hover-label" bind:this={chip} hidden></div>

<style>
  @layer features {
    .chip {
      position: absolute;
      z-index: 2;
      padding: var(--space-1) var(--space-2);
      background: var(--overlay-plate);
      border: 1px solid var(--stage-edge);
      border-radius: var(--radius-control);
      color: var(--overlay-ink);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      pointer-events: none;
    }
    .hover-label {
      max-width: min(280px, calc(100% - 16px));
      overflow-wrap: anywhere;
    }
  }

  @layer a11y {
    @media (forced-colors: active) {
      .chip {
        border-color: CanvasText;
      }
    }
  }
</style>
