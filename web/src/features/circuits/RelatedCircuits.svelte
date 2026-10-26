<!--
  The guided circuits that pass through the selected region (viewer/ui/panels/circuits.js:229-257,
  index.html:423), for `RegionDetail`'s `relatedCircuits` slot: one row per landmark, outside the
  Circuits tab only. A row opens that lesson at that landmark, in the Circuits tab. Not a landmark
  region (deviations/x3-no-landmarks.md). The visible words "Name 2 of 5" are the start of the row's
  name, which a hidden "Landmark" completes (WCAG 2.5.3, deviations/x3-label-in-name.md).
-->
<script lang="ts">
  import { t } from '../../lib/core/i18n/index.ts';
  import type { CircuitExplorer } from './circuits-explorer.svelte.ts';

  let { model }: { model: CircuitExplorer } = $props();

  const uid = $props.id();
  const copy = $derived(t(model.lang, 'circuits'));
</script>

{#if model.related.length}
  <div class="related">
    <h3 id="{uid}-heading" class="related-heading">{copy.inCircuits}</h3>
    <ul class="links" aria-labelledby="{uid}-heading">
      {#each model.related as { circuit, index } (`${circuit.id}:${index}`)}
        <li>
          <button
            type="button"
            class="circuit-link"
            data-landmark-circuit={circuit.id}
            data-landmark-step={index}
            aria-disabled={model.busy ? 'true' : undefined}
            onclick={() => model.openLandmark(circuit.id, index)}
          >
            <span class="link-name">{circuit.name[model.lang]}</span>
            <span class="link-step">{copy.stepShort(index, circuit.steps.length)}</span>
            <span class="visually-hidden">, {copy.landmark}</span>
            <span class="chevron" aria-hidden="true"></span>
          </button>
        </li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  @layer features {
    .related {
      margin-block: var(--space-6);
      padding-inline: var(--panel-inset);
    }
    .related-heading {
      font-size: var(--text-ui);
      font-weight: 600;
      line-height: var(--lh-ui);
    }
    .links {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .circuit-link {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      width: 100%;
      min-height: var(--row-height);
      height: auto;
      margin: 0;
      padding: var(--space-2) 0;
      border: 0;
      border-radius: 0;
      background: none;
      color: var(--text-primary);
      font-size: var(--text-ui);
      font-weight: 400;
      line-height: var(--lh-ui);
      text-align: left;
    }
    .circuit-link:focus-visible {
      outline-offset: -2px;
    }
    .circuit-link[aria-disabled='true'] {
      color: var(--text-tertiary);
      cursor: default;
    }
    .link-name {
      flex: 1 1 auto;
      min-width: 0;
      font-weight: 500;
      overflow-wrap: anywhere;
    }
    .link-step {
      flex: none;
      color: var(--text-tertiary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .chevron {
      flex: none;
      width: 6px;
      height: 6px;
      margin: 0 3px;
      color: var(--text-tertiary);
      border-right: 1.5px solid currentColor;
      border-bottom: 1.5px solid currentColor;
      transform: translateX(-1.6px) rotate(-45deg);
    }
    @media (hover: hover) and (pointer: fine) {
      .circuit-link:hover:not([aria-disabled='true']) {
        color: var(--accent-hover);
      }
      .circuit-link:hover:not([aria-disabled='true']) .link-name {
        text-decoration: underline;
        text-underline-offset: 3px;
      }
    }
    @media (pointer: coarse) {
      .circuit-link {
        min-height: 44px;
      }
    }
  }
</style>
