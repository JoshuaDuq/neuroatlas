<!--
  What the tab is doing or could not do (viewer/ui/panels/circuits.js:142-147, index.html:342): "Opening
  landmark…" while a run is in flight, the failure's sentence after it. A polite live region that is in
  the page before it has anything to say and takes no room while empty (deviations/x3-status-always-
  mounted.md); Svelte writes its text only when the text changed, so an identical sentence is never
  spoken twice. A new language is a new element, so a switch does not say the sentence again.
-->
<script lang="ts">
  import type { CircuitExplorer } from './circuits-explorer.svelte.ts';

  let { model }: { model: CircuitExplorer } = $props();

  let root = $state<HTMLElement | null>(null);
  $effect(() => {
    if (root) return model.attachStatus(root);
  });
</script>

{#key model.lang}
  <p class="circuit-status" role="status" data-error={String(model.failed)} bind:this={root}>
    {model.status}
  </p>
{/key}

<style>
  @layer features {
    .circuit-status {
      padding-inline: var(--panel-inset);
      font-size: var(--text-ui);
      line-height: var(--lh-prose);
    }
    .circuit-status:not(:empty) {
      margin-top: var(--space-2);
    }
    .circuit-status[data-error='true'] {
      color: var(--danger);
    }
  }
</style>
