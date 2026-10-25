<!--
  A non-modal disclosure (APG Disclosure; decisions 0005 and #4 decision 14): the trigger carries
  aria-expanded and aria-controls, the content is ordinary controls in the tab order.
  - one popover is open at a time: opening another closes it;
  - the menu variant leaves focus on the trigger (APG Disclosure; Tab enters the content); the
    stage variant moves it to the pressed control (stage-tools.js:66-69);
  - Escape closes it, is marked handled so the page's Escape does not also clear the selection,
    and returns focus to the trigger; so does a command (`close` in the content snippet);
  - Tab or a press elsewhere closes it and focus stays where the user moved it;
  - a keyboard open or close carries no entry animation (`data-instant`).
  The content is not portaled: it stays right after the trigger, so Tab continues in document
  order (WCAG 2.4.3), and it is drawn inside a fullscreen #viewport.
-->
<script lang="ts" module>
  // The open popover: a second one opening closes it, and a stage popover opening over a stage
  // popover appears without its entry (stage-tools.js:71-74).
  let current: { variant: string; dismiss: () => void } | null = null;

  const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
</script>

<script lang="ts">
  import { Popover } from 'bits-ui';
  import { tick, type Snippet } from 'svelte';
  import { isKeyboardActivation } from './instant.ts';

  interface Props {
    open?: boolean;
    /** `menu` floats under its trigger; `stage` is placed by its owner through `class` and `style`. */
    variant?: 'menu' | 'stage';
    align?: 'start' | 'center' | 'end';
    class?: string;
    style?: string;
    /** Renders the trigger element; spread `props` on it. */
    trigger: Snippet<[{ props: Record<string, unknown> }]>;
    /** `close` shuts the popover and returns focus to the trigger, for a command chosen inside. */
    children: Snippet<[{ close: () => void }]>;
  }

  let {
    open = $bindable(false),
    variant = 'menu',
    align = 'end',
    class: className,
    style,
    trigger,
    children,
  }: Props = $props();

  const uid = $props.id();
  const triggerId = `popover-trigger-${uid}`;
  let wrapper: HTMLElement;
  let content = $state<HTMLElement | null>(null);
  let instant = $state(false);

  // Focus returns to the trigger only on Escape or a command, never when the user moved on.
  async function close({ restoreFocus = false, instantly = false } = {}) {
    instant = instantly;
    open = false;
    if (!restoreFocus) return;
    await tick();
    document.getElementById(triggerId)!.focus({ preventScroll: true });
  }

  $effect(() => {
    if (!open) return;
    const entry = { variant, dismiss: () => close({ instantly: true }) };
    if (current !== null) {
      if (variant === 'stage' && current.variant === 'stage') instant = true;
      current.dismiss();
    }
    current = entry;
    return () => {
      if (current === entry) current = null;
    };
  });

  const own = (node: EventTarget | null) =>
    node instanceof Element && node.closest(`[id="${triggerId}"]`) !== null;

  // The pressed choice, else the first control, so arrows start where the choice is.
  function focusStart(event: Event) {
    event.preventDefault();
    const controls = [...(content?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter(
      (control) => control.checkVisibility() && !(control as HTMLButtonElement).disabled,
    );
    const target =
      controls.find(
        (control) =>
          control.getAttribute('aria-pressed') === 'true' ||
          control.getAttribute('aria-checked') === 'true',
      ) ?? controls[0];
    target?.focus({ preventScroll: true });
  }

  // Closing owns its focus (see `close`); Bits' own return to the trigger would also follow a Tab-out.
  const onCloseAutoFocus = (event: Event) => event.preventDefault();

  function onkeydown(event: KeyboardEvent) {
    // The page uses ↑ ↓ to walk the anatomy tree; inside a popover they stay put (header.js:147-151).
    if (
      !event.defaultPrevented &&
      (event.key === 'ArrowUp' || event.key === 'ArrowDown') &&
      content?.contains(event.target as Node) &&
      (event.target as Element).matches('button, [type="checkbox"]')
    ) {
      event.preventDefault();
      return;
    }
    if (event.key !== 'Escape' || !open) return;
    event.preventDefault();
    close({ restoreFocus: true, instantly: true });
  }

  function onfocusout(event: FocusEvent) {
    const next = event.relatedTarget as Node | null;
    // No related target: the window lost focus (a switch to another window); the popover stays.
    if (open && next !== null && !wrapper.contains(next)) close({ instantly: true });
  }

  // A click with no pointer behind it came from Enter or Space.
  function onclickcapture(event: MouseEvent) {
    if (own(event.target)) instant = isKeyboardActivation(event);
  }
</script>

<span
  bind:this={wrapper}
  role="presentation"
  class="popover-host"
  {onkeydown}
  {onfocusout}
  {onclickcapture}
>
  <Popover.Root bind:open>
    <Popover.Trigger id={triggerId}>
      {#snippet child({ props })}
        {@render trigger({ props })}
      {/snippet}
    </Popover.Trigger>
    {#if variant === 'stage'}
      <Popover.ContentStatic
        bind:ref={content}
        class={['popover', className]}
        data-variant="stage"
        data-instant={instant ? '' : undefined}
        {style}
        trapFocus={false}
        onOpenAutoFocus={focusStart}
        {onCloseAutoFocus}
      >
        {@render children({ close: () => close({ restoreFocus: true, instantly: instant }) })}
      </Popover.ContentStatic>
    {:else}
      <Popover.Content
        bind:ref={content}
        class={['popover', className]}
        data-variant="menu"
        data-instant={instant ? '' : undefined}
        {style}
        side="bottom"
        {align}
        sideOffset={4}
        collisionPadding={8}
        trapFocus={false}
        onOpenAutoFocus={(event) => event.preventDefault()}
        {onCloseAutoFocus}
      >
        {@render children({ close: () => close({ restoreFocus: true, instantly: instant }) })}
      </Popover.Content>
    {/if}
  </Popover.Root>
</span>

<style>
  @layer components {
    .popover-host {
      display: contents;
    }
    /* The content's wrapper is Bits' floating box; the content itself carries the chrome. */
    :global(.popover) {
      overflow-y: auto;
      overscroll-behavior: contain;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-panel);
      background: var(--surface-base);
      color: var(--text-primary);
      box-shadow: var(--shadow-popover);
      transform-origin: var(--bits-popover-content-transform-origin, 50% 0);
      /* Grows from its trigger; closing is immediate (masthead.css:162-169). */
      transition:
        opacity var(--popover-transition) var(--ease-ui),
        transform var(--popover-transition) var(--ease-ui);
    }
    :global(.popover[data-variant='menu']) {
      max-height: calc(100dvh - var(--header-height) - var(--space-3));
      max-width: calc(100vw - var(--space-6));
    }
    /* On the stage: the overlay palette, grown from the dock corner (stage.css:401-428). */
    :global(.popover[data-variant='stage']) {
      z-index: 3;
      padding: var(--space-3) calc(var(--space-1) + var(--space-3));
      border-color: var(--overlay-border);
      background: var(--overlay-plate);
      color: var(--overlay-ink);
      font-size: var(--text-ui);
      text-align: left;
      transform-origin: 0 100%;
    }
    /* Outside presses and pointer commands fade out over --popover-exit (stage.css:419-423). */
    :global(.popover[data-variant='stage'][data-ending-style]) {
      opacity: 0;
      transform: scale(0.97);
      transition-duration: var(--popover-exit);
    }
    :global(.popover[data-instant]) {
      transition: none;
    }
    @starting-style {
      :global(.popover) {
        opacity: 0;
        transform: scale(0.97);
      }
    }
  }

  @layer a11y {
    @media (prefers-reduced-motion: reduce) {
      :global(.popover) {
        transition-property: opacity;
      }
    }
  }
</style>
