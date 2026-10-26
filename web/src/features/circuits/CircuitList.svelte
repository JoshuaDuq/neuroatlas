<!--
  The Circuits tab's list (viewer/ui/panels/circuits.js:150-165, 328-335, index.html:309-312): the
  guided circuits as rows, each opening a lesson, and the list's scope. A list of buttons (decision
  37 on #4); every row is a Tab stop, and ArrowDown and ArrowUp walk the rows.
  - the open circuit is `aria-current="true"`: a row opens a lesson, it does not toggle
    (deviations/x3-current-circuit.md);
  - the labelled list is a real group of `ul` (deviations/x3-list-structure.md);
  - while a run is in flight a row stays focusable and refuses (deviations/x3-busy-keeps-focus.md).
-->
<script lang="ts">
  import { t } from '../../lib/core/i18n/index.ts';
  import { registerCurrentItem } from '../../lib/core/workspace.ts';
  import type { CircuitExplorer } from './circuits-explorer.svelte.ts';
  import { landmarkTotal } from './circuits-view.ts';
  import { neighbourKeys } from './neighbour-keys.ts';

  let { model }: { model: CircuitExplorer } = $props();

  const copy = $derived(t(model.lang, 'circuits'));
  let listElement = $state<HTMLElement | null>(null);

  $effect(() => {
    if (listElement) return model.attachList(listElement);
  });
  $effect(() => {
    if (listElement) return neighbourKeys(listElement);
  });
  $effect(() =>
    registerCurrentItem(
      () => listElement?.querySelector<HTMLElement>('[aria-current="true"]') ?? null,
    ),
  );
</script>

<div class="browser" hidden={!model.exploring}>
  <div role="group" aria-label={copy.heading} bind:this={listElement}>
    <ul class="rows">
      {#each model.circuits as circuit (circuit.id)}
        {@const current = circuit.id === model.lesson.circuit}
        <li>
          <button
            type="button"
            class="circuit-choice"
            data-circuit={circuit.id}
            aria-current={current ? 'true' : undefined}
            aria-disabled={model.busy ? 'true' : undefined}
            data-selected={String(current)}
            onclick={() => model.openCircuit(circuit.id)}
          >
            <span class="row-name">{circuit.name[model.lang]}</span>
            <span class="group-count" aria-hidden="true">{circuit.steps.length}</span>
            <span class="visually-hidden">, {copy.landmarkCount(circuit.steps.length)}</span>
            <span class="chevron" aria-hidden="true"></span>
          </button>
        </li>
      {/each}
    </ul>
  </div>
  <p class="scope-note">
    {copy.coverage(model.circuits.length, landmarkTotal(model.circuits))}
  </p>
</div>

<style>
  @layer features {
    .rows {
      margin: 0;
      padding: var(--space-2) 0;
      list-style: none;
    }
    .circuit-choice {
      position: relative;
      display: flex;
      align-items: center;
      gap: var(--space-2);
      width: 100%;
      min-height: var(--row-height);
      height: auto;
      margin: 0;
      padding: max(0px, (var(--row-height) - var(--lh-ui)) / 2) var(--panel-inset);
      border: 0;
      border-radius: 0;
      background: transparent;
      color: var(--text-primary);
      font-size: var(--text-ui);
      font-weight: 400;
      line-height: var(--lh-ui);
      text-align: left;
    }
    .circuit-choice:focus-visible {
      outline-offset: -2px;
    }
    .circuit-choice[data-selected='true'] {
      background: var(--accent-wash);
      color: var(--accent);
      font-weight: 600;
    }
    .circuit-choice[aria-disabled='true'] {
      color: var(--text-tertiary);
      cursor: default;
    }
    .row-name {
      flex: 1;
      min-width: 0;
      overflow-wrap: anywhere;
      text-wrap: pretty;
    }
    /* The landmark count stands in the tree's count column; its noun is read, not shown. */
    .group-count {
      flex: none;
      min-width: 2ch;
      margin-left: auto;
      color: var(--text-tertiary);
      font-size: var(--text-caption);
      font-weight: 400;
      line-height: var(--lh-caption);
      font-variant-numeric: tabular-nums;
      text-align: right;
      white-space: nowrap;
    }
    .circuit-choice[data-selected='true'] .group-count {
      color: inherit;
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
    .circuit-choice[aria-current='true'] .chevron {
      color: inherit;
    }
    /* A mouse sees the chevron on hover, focus or selection; touch always. A figure keeps the data edge at rest and gives its place to the chevron. */
    @media (hover: hover) and (pointer: fine) {
      .chevron {
        position: absolute;
        top: 50%;
        right: var(--panel-inset);
        margin-top: -3px;
        opacity: 0;
      }
      .circuit-choice:hover:not([data-selected='true'], [aria-disabled='true']) {
        background: var(--surface-hover);
      }
      .circuit-choice:hover .chevron {
        opacity: 1;
        transition: opacity var(--ui-transition) var(--ease-ui);
      }
      .circuit-choice:focus-visible .chevron,
      .circuit-choice[aria-current='true'] .chevron {
        opacity: 1;
      }
      .circuit-choice:is(:hover, :focus-visible) .group-count {
        visibility: hidden;
      }
    }
    @media (pointer: coarse) {
      .circuit-choice {
        min-height: 44px;
      }
    }
    /* A list's scope: one tertiary line at its foot. */
    .scope-note {
      padding: var(--space-3) var(--panel-inset) var(--space-4);
      border-top: 1px solid var(--border-subtle);
      color: var(--text-tertiary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      font-variant-numeric: tabular-nums;
      text-wrap: pretty;
    }
  }
  @layer a11y {
    @media (forced-colors: active) {
      .circuit-choice[data-selected='true'] {
        outline: 2px solid Highlight;
        outline-offset: -2px;
      }
    }
  }
</style>
