<!--
  A list row that opens a detail (clinical.js:31-47): the name and, under it, a secondary line,
  with the one chevron trailing. A real button, so Enter and Space open it.
-->
<script lang="ts">
  let { name, secondary, onclick }: { name: string; secondary?: string; onclick: () => void } =
    $props();
</script>

<button type="button" class="row" {onclick}>
  <span class="text">
    <span class="row-name">{name}</span>
    {#if secondary}<span class="secondary">{secondary}</span>{/if}
  </span>
  <span class="chevron" aria-hidden="true"></span>
</button>

<style>
  @layer components {
    .row {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      width: 100%;
      height: auto;
      min-height: var(--row-height);
      padding: var(--space-1) var(--panel-inset);
      border: 0;
      border-radius: 0;
      background: none;
      color: var(--text-primary);
      text-align: left;
    }
    .text {
      display: grid;
      flex: 1;
      min-width: 0;
    }
    .row-name {
      overflow-wrap: anywhere;
    }
    .secondary {
      color: var(--text-secondary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
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
    .row:focus-visible {
      outline-offset: -2px;
    }
    @media (hover: hover) and (pointer: fine) {
      .row:hover:not(:disabled) {
        background: var(--surface-hover);
      }
    }
  }
</style>
