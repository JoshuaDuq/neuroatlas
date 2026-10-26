<!--
  The lesson's place and its landmark steps, for the location bar's `stepper` slot (viewer/ui/panels/
  circuits.js:74-100, index.html:335). Previous and Next are separate named buttons in a labelled
  group (APG Carousel's pair); at an end the control leaves rather than greying out, and a fixed
  three-column grid keeps the count still. While a run is in flight a control stays focusable and
  refuses (deviations/x3-busy-keeps-focus.md).
-->
<script lang="ts">
  import { t } from '../../lib/core/i18n/index.ts';
  import { stepperTargets } from '../../lib/core/panels/circuits.ts';
  import IconButton from '../../lib/ui/IconButton.svelte';
  import type { CircuitExplorer, Direction } from './circuits-explorer.svelte.ts';

  let { model }: { model: CircuitExplorer } = $props();

  const copy = $derived(t(model.lang, 'circuits'));
  const total = $derived(model.circuit?.steps.length ?? 0);
  const targets = $derived(stepperTargets(model.lesson.step, total));
  let root = $state<HTMLElement | null>(null);

  $effect(() => {
    if (root) return model.attachStepper(root);
  });
</script>

{#snippet control(direction: Direction, label: string)}
  <IconButton
    icon={direction}
    {label}
    class="stepper-{direction}"
    data-tooltip={label}
    data-step-direction={direction}
    hidden={targets[direction] === null}
    aria-disabled={model.busy ? 'true' : undefined}
    onclick={() => model.openStep(targets[direction]!, direction)}
  />
{/snippet}

{#if model.exploring && model.circuit}
  <div role="group" aria-label={copy.landmarks} class="circuit-stepper" bind:this={root}>
    {@render control('previous', copy.previousLandmark)}
    <p class="progress">
      <span class="visually-hidden">{copy.landmark}{' '}</span>{copy.stepShort(
        model.lesson.step,
        total,
      )}
    </p>
    {@render control('next', copy.nextLandmark)}
  </div>
{/if}

<style>
  @layer features {
    .circuit-stepper {
      flex: none;
      display: grid;
      grid-template-columns: var(--control-height) auto var(--control-height);
      align-items: center;
    }
    .circuit-stepper :global(.stepper-previous) {
      grid-column: 1;
    }
    .progress {
      grid-column: 2;
      margin: 0;
      padding: 0 var(--space-1);
      color: var(--text-secondary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .circuit-stepper :global(.stepper-next) {
      grid-column: 3;
    }
    .circuit-stepper :global(.icon-button) {
      height: var(--control-height);
    }
    .circuit-stepper :global(.icon-button:focus-visible) {
      outline-offset: -2px;
    }
    /* A run in flight turns the control away without taking it from the Tab order. */
    .circuit-stepper :global(.icon-button[aria-disabled='true']) {
      color: color-mix(in srgb, var(--text-tertiary) 55%, transparent);
      cursor: default;
    }
  }
  @layer a11y {
    @media (forced-colors: active) {
      .circuit-stepper :global(.icon-button[aria-disabled='true']) {
        color: GrayText;
      }
    }
  }
</style>
