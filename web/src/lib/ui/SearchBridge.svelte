<!--
  A quiet link to the other evidence tab's matches for the same words (clinical.js:23-30),
  ruled off from what precedes it.
-->
<script lang="ts">
  let { text, onclick }: { text: string; onclick: () => void } = $props();
</script>

<button type="button" class="search-bridge" {onclick}>
  <span class="label">{text}</span>
  <span class="chevron" aria-hidden="true"></span>
</button>

<style>
  @layer components {
    .search-bridge {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      width: 100%;
      height: auto;
      min-height: var(--row-height);
      margin: 0;
      padding: var(--space-1) var(--panel-inset);
      border: 0;
      border-top: 1px solid var(--border-subtle);
      border-radius: 0;
      background: none;
      color: var(--text-secondary);
      text-align: left;
      font-size: var(--text-ui);
      line-height: var(--lh-ui);
    }
    .label {
      flex: 1;
      min-width: 0;
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
    .search-bridge:focus-visible {
      outline-offset: -2px;
    }
    @media (hover: hover) and (pointer: fine) {
      .search-bridge:hover:not(:disabled) {
        background: var(--surface-hover);
        color: var(--text-primary);
      }
    }
  }
</style>
