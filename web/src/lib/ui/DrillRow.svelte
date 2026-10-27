<!--
  A list row that opens a detail (clinical.js:31-47): the name and, under it, a secondary line,
  with the one chevron trailing. A real button, so Enter and Space open it.
-->
<script lang="ts">
  let {
    name,
    secondary,
    current = false,
    onclick,
  }: { name: string; secondary?: string; current?: boolean; onclick: () => void } = $props();
</script>

<button
  type="button"
  class="row"
  aria-current={current ? 'true' : undefined}
  data-selected={current ? 'true' : undefined}
  {onclick}
>
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
    .row[aria-current='true'] .chevron {
      color: inherit;
    }
    .row:focus-visible {
      outline-offset: -2px;
    }
    /* A mouse sees the chevron on hover, focus or selection (clinical.css:7-12); touch always. */
    @media (hover: hover) and (pointer: fine) {
      .chevron {
        opacity: 0;
      }
      .row:hover .chevron {
        opacity: 1;
        transition: opacity var(--ui-transition) var(--ease-ui);
      }
      .row:focus-visible .chevron,
      .row[aria-current='true'] .chevron {
        opacity: 1;
      }
      .row:hover:not(:disabled) {
        background: var(--surface-hover);
      }
    }
  }
</style>
