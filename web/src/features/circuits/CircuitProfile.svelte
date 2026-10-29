<!--
  The open landmark (viewer/ui/panels/circuits.js:167-196, index.html:341): the circuit's name for the
  outline, the step's title (the focus target when a landmark opens), its side and group, its role and
  explanation, and, once the reader has wandered to another region, a way back. The landmark's own
  commands are the region's, which I1 renders below this in `RegionDetail`; `landmarkSelected` on the
  model tells it which of its parts to leave out. Not a landmark region (deviations/x3-no-landmarks.md).
-->
<script lang="ts">
  import { t } from '../../lib/core/i18n/index.ts';
  import type { CircuitExplorer } from './circuits-explorer.svelte.ts';

  let { model }: { model: CircuitExplorer } = $props();

  const lang = $derived(model.lang);
  const copy = $derived(t(lang, 'circuits'));
  const region = $derived(model.selectedRegion);
  let root = $state<HTMLElement | null>(null);

  $effect(() => {
    if (root) return model.attachProfile(root);
  });
</script>

{#if model.exploring && model.circuit && model.step}
  {@const step = model.step}
  <div
    class="circuit-profile"
    data-landmark-selected={model.landmarkSelected}
    aria-busy={model.busy}
    bind:this={root}
  >
    <!-- The location bar names the circuit on screen; the heading keeps it in the outline. -->
    <h2 class="visually-hidden">{model.circuit.name[lang]}</h2>
    <div class="circuit-content">
      <h3 class="circuit-title" data-circuit-title tabindex="-1">{step.name[lang]}</h3>
      {#if model.landmarkSelected && region}
        <dl class="circuit-context">
          <dt class="visually-hidden">{t(lang, 'inspector').hemisphere}</dt>
          <dd>{t(lang, 'sides').capitalized[region.hemisphere] ?? region.hemisphere}</dd>
          <dt class="visually-hidden">{t(lang, 'inspector').group}</dt>
          <dd>{model.group || '—'}</dd>
        </dl>
      {/if}
      <p class="circuit-role">{step.role[lang]}</p>
      <p class="circuit-explanation">{step.explanation[lang]}</p>
      <p class="circuit-note">{copy.clinicalNote}</p>
      {#if !model.landmarkSelected}
        <!-- Back to the prepared view, offered once the reader has left the landmark. -->
        <p class="circuit-note circuit-return">
          {copy.otherSelection}
          <button
            type="button"
            aria-disabled={model.busy ? 'true' : undefined}
            onclick={() => model.openStep(model.lesson.step)}
          >
            {copy.returnToLandmark}
          </button>
        </p>
      {/if}
    </div>
  </div>
{/if}

<style>
  @layer features {
    .circuit-profile {
      scroll-margin-top: var(--space-4);
    }
    /* The landmark: a headline and attached role, with room before the explanation. */
    .circuit-content {
      padding: var(--panel-inset);
      font-size: var(--text-ui);
      line-height: var(--lh-prose);
      overflow-wrap: anywhere;
    }
    /* The landmark's own commands follow its prose at the section gap. */
    [data-landmark-selected='true'] > .circuit-content {
      padding-bottom: var(--space-2);
    }
    .circuit-title {
      font-size: var(--text-headline);
      font-weight: 600;
      letter-spacing: -0.02em;
      line-height: var(--lh-title);
      text-wrap: pretty;
    }
    .circuit-context {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      margin: var(--space-1) 0 0;
      color: var(--text-secondary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
    }
    .circuit-context dd {
      margin: 0;
    }
    .circuit-context dd:last-child::before {
      content: '·' / '';
      margin-inline-end: var(--space-2);
      color: var(--text-tertiary);
    }
    .circuit-role {
      margin-top: var(--space-2);
      color: var(--text-secondary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
    }
    .circuit-explanation {
      margin-top: var(--space-4);
    }
    .circuit-note {
      margin-top: var(--space-3);
      color: var(--text-secondary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
    }
    .circuit-return {
      margin-top: var(--space-3);
    }
    .circuit-return button {
      display: inline;
      min-height: 0;
      padding: 0;
      border: 0;
      background: none;
      color: var(--accent);
      font: inherit;
      font-weight: 500;
      cursor: pointer;
    }
    .circuit-return button[aria-disabled='true'] {
      color: var(--text-tertiary);
      cursor: default;
    }
    @media (hover: hover) and (pointer: fine) {
      .circuit-return button:hover:not([aria-disabled='true']) {
        color: var(--accent-hover);
        text-decoration: underline;
        text-underline-offset: 3px;
      }
    }
    /* A 44px target on touch (WCAG 2.5.8 excepts a link in a sentence at 24px; a coarse pointer asks for 44). */
    @media (pointer: coarse) {
      .circuit-return button {
        display: inline-flex;
        align-items: center;
        min-height: 44px;
      }
    }
  }
</style>
