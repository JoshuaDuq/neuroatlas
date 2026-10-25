<!--
  A modal dialog on the native <dialog> (APG Dialog (Modal); decision 0008): `showModal()` gives
  the top layer, an inert background, Escape to close and focus returned to the opener.
  The owner's store holds `open`; only an integration chunk mounts it.
  - `instant`: no entry or exit animation. The owner sets it from its opener's click
    (`isKeyboardActivation`); Escape and the close button set it here.
  - the opener gets focus back on close, else `fallbackFocus` (ui/chrome/shortcuts.js:271-275);
  - `isolateKeys`: the page's own keys (Escape clears the selection, letters change the view)
    stay out of the dialog (panels/provenance.js:175). A dialog whose canvas needs the arrow
    keys (the NiiVue viewer) leaves it off.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { captureInvoker } from './focus.ts';
  import { isKeyboardActivation, setInstant } from './instant.ts';

  interface Props {
    open?: boolean;
    instant?: boolean;
    /** `imaging` is the wide dialog on the stage's dark palette (slice viewers). */
    variant?: 'reference' | 'imaging';
    isolateKeys?: boolean;
    /** Takes focus on close when the opener is gone. */
    fallbackFocus?: () => HTMLElement | null;
    /** The visible name label; receives the id to give its heading. */
    heading: Snippet<[string]>;
    closeLabel: string;
    children: Snippet;
  }

  let {
    open = $bindable(false),
    instant = $bindable(false),
    variant = 'reference',
    isolateKeys = false,
    fallbackFocus,
    heading,
    closeLabel,
    children,
  }: Props = $props();

  const uid = $props.id();
  const headingId = `dialog-heading-${uid}`;
  let dialog: HTMLDialogElement;
  let returnToOpener: (() => boolean) | null = null;

  $effect(() => setInstant(dialog, instant));

  $effect(() => {
    if (open === dialog.open) return;
    if (open) {
      returnToOpener = captureInvoker();
      dialog.showModal();
    } else dialog.close();
  });

  // Fires for Escape, the close button and `open = false` alike.
  function onclose() {
    open = false;
    const returned = returnToOpener?.() ?? false;
    returnToOpener = null;
    if (!returned) fallbackFocus?.()?.focus();
  }

  const oncancel = () => (instant = true);
  const onkeydown = (event: KeyboardEvent) => {
    if (isolateKeys) event.stopPropagation();
  };
  function onclosebutton(event: MouseEvent) {
    instant = isKeyboardActivation(event);
    open = false;
  }
</script>

<dialog
  bind:this={dialog}
  class="dialog"
  data-variant={variant}
  aria-labelledby={headingId}
  {onclose}
  {oncancel}
  {onkeydown}
>
  <header class="dialog-header">
    <div>{@render heading(headingId)}</div>
    <button type="button" class="dialog-close" aria-label={closeLabel} onclick={onclosebutton}>
      <span aria-hidden="true">×</span>
    </button>
  </header>
  {@render children()}
</dialog>

<style>
  @layer components {
    /* dialogs.css:1-101. Centred, so it settles in place; it closes faster than it opens. */
    .dialog {
      --dialog-inset: var(--space-5);
      --dialog-top: var(--dialog-inset);
      width: min(560px, calc(100vw - var(--space-8)));
      min-width: min(320px, 100vw);
      max-height: calc(100dvh - var(--space-8));
      margin: auto;
      padding: var(--dialog-inset);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-panel);
      background: var(--surface-base);
      color: var(--text-primary);
      overflow: auto;
      overscroll-behavior: contain;
      box-shadow: var(--shadow-popover);
      transition:
        opacity var(--popover-exit) var(--ease-ui),
        transform var(--popover-exit) var(--ease-ui),
        overlay var(--popover-exit) allow-discrete,
        display var(--popover-exit) allow-discrete;
    }
    .dialog[data-variant='imaging'] {
      width: min(1180px, 96vw);
      max-height: 94dvh;
    }
    .dialog:not([open]) {
      opacity: 0;
      transform: scale(0.98);
    }
    .dialog[open] {
      transition-duration: var(--dialog-transition);
    }
    @starting-style {
      .dialog[open] {
        opacity: 0;
        transform: scale(0.98);
      }
    }
    .dialog:global([data-instant]),
    .dialog:global([data-instant])::backdrop {
      transition: none;
    }
    .dialog::backdrop {
      background: var(--scrim);
      opacity: 0;
      transition:
        opacity var(--popover-exit) var(--ease-ui),
        overlay var(--popover-exit) allow-discrete,
        display var(--popover-exit) allow-discrete;
    }
    .dialog[data-variant='imaging']::backdrop {
      background: var(--scrim-imaging);
    }
    .dialog[open]::backdrop {
      opacity: 1;
      transition-duration: var(--dialog-transition);
    }
    @starting-style {
      .dialog[open]::backdrop {
        opacity: 0;
      }
    }

    /* Slices are read the way a workstation shows them: the stage's overlay palette in both themes. */
    .dialog[data-variant='imaging'] {
      color-scheme: dark;
      --text-primary: var(--overlay-ink);
      --text-secondary: var(--overlay-ink-muted);
      --text-tertiary: var(--overlay-ink-faint);
      --accent: var(--overlay-accent);
      --accent-hover: var(--overlay-accent-hover);
      --accent-wash: var(--overlay-accent-wash);
      --primary-fill: var(--overlay-primary-fill);
      --primary-fill-hover: var(--overlay-primary-fill-hover);
      --surface-base: var(--overlay-plate);
      --surface-navigation: var(--overlay-track);
      --surface-sunken: var(--scene-background);
      --surface-hover: var(--overlay-plate-hover);
      --surface-raised: var(--overlay-raised);
      --surface-tonal: var(--overlay-track);
      --surface-tonal-hover: var(--overlay-track-hover);
      --border-subtle: var(--overlay-border);
      --border-control: var(--overlay-control-border);
      --thumb-ring: var(--overlay-control-border);
      --danger: var(--overlay-danger);
      border-color: var(--border-subtle);
    }

    /* One sticky ruled header: the title, then the quiet ×; as tall as the masthead. */
    .dialog-header {
      position: sticky;
      top: calc(-1 * var(--dialog-top));
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      min-height: var(--header-height);
      margin: calc(-1 * var(--dialog-top)) calc(-1 * var(--dialog-inset)) 0;
      padding: var(--space-1) var(--dialog-inset);
      border-bottom: 1px solid var(--border-subtle);
      background: var(--surface-base);
    }
    .dialog-header > :first-child {
      min-width: 0;
    }
    .dialog-close {
      flex: none;
      display: grid;
      place-items: center;
      width: var(--control-height);
      height: var(--control-height);
      margin-right: calc((16px - var(--control-height)) / 2);
      padding: 0;
      border: 0;
      border-radius: var(--radius-control);
      background: transparent;
      color: var(--text-secondary);
      font-size: 1.25rem;
      line-height: var(--lh-ui);
    }
    /* Phones put it against the clipped screen edge, so its ring is drawn inside. */
    .dialog-close:focus-visible {
      outline-offset: -2px;
    }
    @media (hover: hover) and (pointer: fine) {
      .dialog-close:hover {
        background: var(--surface-hover);
        color: var(--text-primary);
      }
    }
    @media (pointer: coarse) {
      .dialog-close {
        width: 44px;
        height: 44px;
      }
    }

    /* A phone has no room for a dialog inset from the screen (dialogs.css:255-282). 100dvh, not
       100vh, and contained overscroll keep iOS Safari from scrolling the page behind it. */
    @media (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      .dialog,
      .dialog[data-variant='imaging'] {
        --dialog-inset: var(--space-4);
        --dialog-top: max(var(--dialog-inset), env(safe-area-inset-top));
        --dialog-left: max(var(--dialog-inset), env(safe-area-inset-left));
        --dialog-right: max(var(--dialog-inset), env(safe-area-inset-right));
        width: 100vw;
        max-width: 100vw;
        height: 100dvh;
        max-height: 100dvh;
        margin: 0;
        border: 0;
        border-radius: 0;
        padding: var(--dialog-inset);
        padding-top: var(--dialog-top);
        padding-left: var(--dialog-left);
        padding-right: var(--dialog-right);
        padding-bottom: max(var(--space-4), env(safe-area-inset-bottom));
      }
      .dialog-header {
        top: calc(-1 * var(--dialog-top));
        min-height: calc(var(--header-height) + env(safe-area-inset-top));
        margin-inline: calc(-1 * var(--dialog-left)) calc(-1 * var(--dialog-right));
        padding-top: calc(var(--space-1) + env(safe-area-inset-top));
        padding-inline: var(--dialog-left) var(--dialog-right);
      }
    }
  }

  @layer a11y {
    @media (prefers-reduced-motion: reduce) {
      .dialog {
        transition-property: opacity;
      }
      .dialog:not([open]) {
        transform: none;
      }
    }
  }
</style>
