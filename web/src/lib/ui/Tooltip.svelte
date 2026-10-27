<!--
  The one tooltip (APG Tooltip, WCAG 1.4.13) for every element with `data-tooltip`. Mount it once;
  tooltip.ts delegates hover, focus and Escape from the document and says when to show.
  Bits draws and places the content. Bits' own triggers are not used: the triggers are the
  attribute-carrying elements of other components, which a Bits Root cannot adopt.
-->
<script lang="ts">
  import { Tooltip } from 'bits-ui';
  import { onMount } from 'svelte';
  import { startTooltips } from './tooltip.ts';

  const tipId = 'tooltip';

  let anchor = $state<HTMLElement | null>(null);
  let text = $state('');
  let instant = $state(false);
  let open = $state(false);
  // A modal dialog and a fullscreen element draw only their own descendants over the page.
  let container = $state<HTMLElement>(document.body);
  let tooltips: ReturnType<typeof startTooltips> | undefined;

  onMount(() => {
    tooltips = startTooltips({
      tipId,
      show(trigger, isInstant) {
        container =
          trigger.closest<HTMLElement>('dialog[open]') ??
          (document.fullscreenElement as HTMLElement | null) ??
          document.body;
        anchor = trigger;
        text = trigger.dataset.tooltip ?? '';
        instant = isInstant;
        open = true;
      },
      hide() {
        open = false;
      },
    });
    return tooltips.dispose;
  });
</script>

<Tooltip.Provider delayDuration={500} skipDelayDuration={300}>
  <Tooltip.Root {open} onOpenChange={(next) => !next && tooltips?.dismiss()}>
    <Tooltip.Portal to={container}>
      <!-- Bits renders no role on the content; the APG Tooltip needs it. -->
      <Tooltip.Content
        id={tipId}
        role="tooltip"
        class="tooltip"
        customAnchor={anchor}
        side="bottom"
        sideOffset={8}
        collisionPadding={8}
        data-instant={instant ? '' : undefined}
      >
        {text}
      </Tooltip.Content>
    </Tooltip.Portal>
  </Tooltip.Root>
</Tooltip.Provider>

<style>
  @layer components {
    /* Anything with data-tooltip: the stage's hover chip, in both themes (components.css:507-539). */
    :global(.tooltip) {
      max-width: min(280px, calc(100vw - 2 * var(--space-2)));
      margin: 0;
      padding: var(--space-1) var(--space-2);
      border: 1px solid var(--overlay-border);
      border-radius: var(--radius-control);
      background: var(--overlay-plate);
      color: var(--overlay-ink);
      font-size: var(--text-caption);
      font-weight: 400;
      line-height: var(--lh-caption);
      text-align: left;
      overflow-wrap: break-word;
      pointer-events: auto;
      transform-origin: var(--bits-tooltip-content-transform-origin, 50% 0);
      transition:
        opacity var(--tooltip-transition) var(--ease-ui),
        transform var(--tooltip-transition) var(--ease-ui);
    }
    :global(.tooltip[data-instant]) {
      transition: none;
    }
    @starting-style {
      :global(.tooltip) {
        opacity: 0;
        transform: scale(0.97);
      }
    }
  }

  /* Forced colours keep the border (a11y.css:50). */
  @layer a11y {
    @media (forced-colors: active) {
      :global(.tooltip) {
        border-color: CanvasText;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      :global(.tooltip) {
        transition-property: opacity;
      }
    }
  }
</style>
