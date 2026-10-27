<!--
  The lesson's sequence and background, below the landmark's data (viewer/ui/panels/circuits.js:
  198-226, 100-130): every landmark as a way to it, then four notes (connections and scope, what the
  atlas shows, clinical context, sources). The sequence is an ordered list of buttons: `aria-current=
  "step"` marks the current one, a visually hidden "seen" the visited ones, and a ring, a disc and
  the accent tell ahead, seen and current apart by shape as well as ink; ArrowDown and ArrowUp walk it.
  - the notes stay as the reader left them while the lesson moves on
    (deviations/x3-disclosure-state.md);
  - the sequence is `role="list"`, which Safari drops from a list without markers
    (deviations/x3-list-structure.md).
-->
<script lang="ts">
  import { t } from '../../lib/core/i18n/index.ts';
  import { stepProgress } from '../../lib/core/panels/circuits.ts';
  import Disclosure from '../../lib/ui/Disclosure.svelte';
  import { iconGraphic } from '../../lib/ui/IconButton.svelte';
  import type { CircuitExplorer } from './circuits-explorer.svelte.ts';
  import { neighbourKeys } from './neighbour-keys.ts';

  let { model }: { model: CircuitExplorer } = $props();

  const uid = $props.id();
  const lang = $derived(model.lang);
  const copy = $derived(t(lang, 'circuits'));
  const closed = () => ({ connections: false, mapping: false, clinical: false, sources: false });

  // A note's state is the reader's own, so it is kept while the lesson moves between landmarks and
  // starts closed again with the next lesson.
  let open = $state(closed());
  let shown: string | null = null;
  $effect.pre(() => {
    if (model.lesson.circuit === shown) return;
    shown = model.lesson.circuit;
    open = closed();
  });

  let sequence = $state<HTMLElement | null>(null);
  $effect(() => {
    if (sequence) return neighbourKeys(sequence);
  });
</script>

{#if model.exploring && model.circuit && model.step}
  {@const circuit = model.circuit}
  {@const step = model.step}
  <div class="circuit-notes" aria-busy={model.busy}>
    <div class="landmarks">
      <h3 id="{uid}-landmarks" class="landmarks-heading">{copy.landmarks}</h3>
      <ol class="steps" role="list" aria-labelledby="{uid}-landmarks" bind:this={sequence}>
        {#each circuit.steps as landmark, index (landmark.id)}
          {@const progress = stepProgress(index, model.lesson)}
          <li>
            <button
              type="button"
              class="circuit-step"
              data-progress={progress}
              data-selected={String(progress === 'current')}
              aria-current={progress === 'current' ? 'step' : undefined}
              aria-disabled={model.busy ? 'true' : undefined}
              onclick={() => model.openStep(index)}
            >
              <span class="circuit-step-number">{index + 1}</span>
              <span class="row-name">{landmark.name[lang]}</span>
              {#if progress === 'visited'}
                <span class="visually-hidden">, {copy.visited}</span>
              {/if}
            </button>
          </li>
        {/each}
      </ol>
    </div>

    <div class="note">
      <Disclosure summary={copy.connections} variant="section" bind:open={open.connections}>
        <div class="body">
          <p>{circuit.summary[lang]}</p>
          <p class="route">{circuit.route[lang]}</p>
          <p>{circuit.scope[lang]}</p>
          <p class="small">{copy.schematic}</p>
        </div>
      </Disclosure>
    </div>
    <div class="note">
      <Disclosure summary={copy.mapping} variant="section" bind:open={open.mapping}>
        <div class="body">
          <p>{step.mapping[lang]}</p>
          <p class="small">{copy.mriNote}</p>
        </div>
      </Disclosure>
    </div>
    <div class="note">
      <Disclosure summary={copy.clinical} variant="section" bind:open={open.clinical}>
        <div class="body">
          <p>{circuit.clinical[lang]}</p>
          <button
            type="button"
            class="command"
            aria-disabled={model.busy ? 'true' : undefined}
            onclick={() => model.openDeficit(circuit.deficit)}
          >
            {copy.clinicalLink}
          </button>
          <p class="small">{copy.clinicalNote}</p>
        </div>
      </Disclosure>
    </div>
    <div class="note">
      <Disclosure summary={copy.evidence} variant="section" bind:open={open.sources}>
        <div class="body">
          {#each circuit.references as id (id)}
            {@const reference = model.reference(id)}
            <p class="source">
              <a href={reference.url} target="_blank" rel="noreferrer"
                >{reference.title}<span class="visually-hidden">{` ${t(lang, 'link').newTab}`}</span
                >{@render iconGraphic('external-link')}</a
              >
              <span>{reference.citation}</span>
            </p>
          {/each}
          <p class="small">{copy.revised}: {model.revised}</p>
        </div>
      </Disclosure>
    </div>
  </div>
{/if}

<style>
  @layer features {
    .circuit-notes {
      margin-bottom: var(--space-6);
      font-size: var(--text-ui);
      line-height: var(--lh-prose);
    }
    .landmarks-heading {
      padding: var(--space-5) var(--panel-inset) var(--space-1);
      font-size: var(--text-ui);
      font-weight: 600;
      line-height: var(--lh-ui);
    }
    .steps {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .circuit-step {
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
    .circuit-step:focus-visible {
      outline-offset: -2px;
    }
    .circuit-step[data-selected='true'] {
      background: var(--accent-wash);
      color: var(--accent);
      font-weight: 600;
    }
    .circuit-step[aria-disabled='true'] {
      cursor: default;
    }
    .row-name {
      flex: 1;
      min-width: 0;
      overflow-wrap: anywhere;
      text-wrap: pretty;
    }
    /* Ahead is an open ring, seen a filled disc, the current one the selection: shape tells them apart, not ink alone. */
    .circuit-step-number {
      flex: none;
      display: grid;
      place-content: center;
      width: 20px;
      height: 20px;
      border: 1px solid var(--border-subtle);
      border-radius: 50%;
      color: var(--text-secondary);
      font-size: var(--text-caption);
      font-weight: 500;
      line-height: var(--lh-caption);
      font-variant-numeric: tabular-nums;
    }
    .circuit-step[data-progress='visited'] .circuit-step-number {
      border-color: var(--surface-tonal);
      background: var(--surface-tonal);
      color: var(--text-secondary);
    }
    .circuit-step[aria-current='step'] .circuit-step-number {
      border-color: var(--accent);
      color: var(--accent);
      font-weight: 600;
    }
    @media (hover: hover) and (pointer: fine) {
      .circuit-step:hover:not([data-selected='true'], [aria-disabled='true']) {
        background: var(--surface-hover);
      }
    }

    .note {
      margin-inline: var(--panel-inset);
      padding-block: var(--space-1);
      border-bottom: 1px solid var(--border-subtle);
    }
    .note :global(details.section) {
      margin-top: 0;
    }
    .note :global(details.section[open]) {
      padding-bottom: var(--space-3);
    }
    .note :global(details > summary) {
      min-height: var(--row-height);
    }
    .body > :global(* + *) {
      margin-top: var(--space-2);
    }
    .small {
      color: var(--text-secondary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
    }
    .route {
      color: var(--text-primary);
      font-weight: 500;
    }
    /* The way into the deficit is a command in the button ranks, not a line of link text. */
    .command {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: var(--control-height);
      padding: var(--space-1) var(--space-3);
      border: 1px solid transparent;
      border-radius: var(--radius-control);
      background: var(--surface-tonal);
      color: var(--text-primary);
      font-size: var(--text-ui);
      font-weight: 500;
      line-height: var(--lh-ui);
      white-space: normal;
      cursor: pointer;
    }
    .command[aria-disabled='true'] {
      color: var(--text-tertiary);
      cursor: default;
    }
    .source {
      padding-top: var(--space-2);
      color: var(--text-tertiary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
    }
    .source a {
      font-weight: 500;
      overflow-wrap: anywhere;
    }
    .source a :global(.control-icon) {
      margin-left: var(--space-1);
      vertical-align: -1px;
    }
    .source > span:not(.visually-hidden) {
      display: block;
      margin-top: var(--space-1);
    }
    @media (hover: hover) and (pointer: fine) {
      .command:hover:not([aria-disabled='true']) {
        background: var(--surface-tonal-hover);
      }
    }
    @media (pointer: coarse) {
      .circuit-step,
      .command {
        min-height: 44px;
      }
      .note :global(details > summary) {
        min-height: 44px;
      }
    }
  }
  @layer a11y {
    @media (forced-colors: active) {
      .circuit-step-number {
        forced-color-adjust: none;
        border-color: CanvasText;
        color: CanvasText;
        background: Canvas;
      }
      .circuit-step[data-progress='visited'] .circuit-step-number {
        background: CanvasText;
        color: Canvas;
      }
      .circuit-step[aria-current='step'] .circuit-step-number {
        border-color: Highlight;
        box-shadow: inset 0 0 0 1px Highlight;
        color: CanvasText;
      }
      .circuit-step[data-selected='true'] {
        outline: 2px solid Highlight;
        outline-offset: -2px;
      }
    }
  }
</style>
