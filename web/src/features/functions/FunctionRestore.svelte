<!--
  Restore previous view (viewer/ui/panels/functions.js:107-111, 165-169, 323): the scene from before
  this excursion's first function or deficit. Rendered by I1 into the location bar's `trailing`
  slot. While a run is in flight it stays in the page and only says it is unavailable, so the
  control the reader just pressed keeps focus (deviations/x1-restore-focus.md).
-->
<script lang="ts">
  import { t } from '../../lib/core/i18n/index.ts';
  import type { FunctionExplorer } from './functions-explorer.svelte.ts';

  let { model }: { model: FunctionExplorer } = $props();
</script>

{#if model.selected && model.restorable}
  <button
    type="button"
    class="restore"
    aria-disabled={model.opening ? 'true' : undefined}
    onclick={() => model.restore()}
  >
    {t(model.lang, 'clinical').restore}
  </button>
{/if}

<style>
  @layer features {
    .restore {
      align-self: stretch;
      min-height: 100%;
      margin: 0;
      padding: 0 var(--panel-inset) 0 var(--space-2);
      border: 0;
      border-radius: 0;
      background: none;
      color: var(--accent);
      font-size: var(--text-caption);
      font-weight: 400;
      line-height: var(--lh-caption);
      white-space: nowrap;
    }
    .restore:focus-visible {
      outline-offset: -2px;
    }
    .restore[aria-disabled='true'] {
      color: var(--text-tertiary);
      cursor: default;
    }
    @media (hover: hover) and (pointer: fine) {
      .restore:hover:not([aria-disabled='true']) {
        color: var(--accent-hover);
        text-decoration: underline;
        text-underline-offset: 3px;
      }
    }
    @media (pointer: coarse) {
      .restore {
        min-height: 44px;
      }
    }
  }
  @layer a11y {
    @media (forced-colors: active) {
      .restore {
        color: LinkText;
        text-decoration: underline;
      }
      .restore[aria-disabled='true'] {
        color: GrayText;
      }
    }
  }
</style>
