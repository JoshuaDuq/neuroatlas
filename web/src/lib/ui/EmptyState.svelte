<!--
  An empty list (clinical.js:506, functions.js:447, navigator.js:415-430): a title that names the
  query, a sentence that says where the other matches are, and an optional link-styled action.
-->
<script lang="ts">
  let {
    title,
    message,
    actionLabel,
    onaction,
  }: { title?: string; message: string; actionLabel?: string; onaction?: () => void } = $props();
</script>

{#if title}<p class="empty-title">{title}</p>{/if}
<div class="empty">
  <p>{message}</p>
  {#if actionLabel}<button type="button" onclick={onaction}>{actionLabel}</button>{/if}
</div>

<style>
  @layer components {
    .empty {
      padding: var(--space-4) var(--panel-inset);
      color: var(--text-secondary);
      font-size: var(--text-ui);
      line-height: var(--lh-ui);
    }
    .empty-title + .empty {
      padding-top: var(--space-1);
    }
    .empty-title {
      padding: var(--space-5) var(--panel-inset) 0;
      font-size: var(--text-title);
      font-weight: 600;
      line-height: var(--lh-title);
      overflow-wrap: anywhere;
    }
    /* The sentence says where the other matches are; the action sits under it as link text. */
    .empty button {
      display: block;
      width: fit-content;
      height: auto;
      margin: var(--space-2) 0 0;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: none;
      color: var(--accent);
      text-align: left;
    }
    @media (hover: hover) and (pointer: fine) {
      .empty button:hover:not(:disabled) {
        background: none;
        color: var(--accent-hover);
        text-decoration: underline;
        text-underline-offset: 3px;
      }
    }
    @media (pointer: coarse) {
      .empty button {
        min-height: 44px;
      }
    }
  }
</style>
