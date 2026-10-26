<!--
  Restore previous view (clinical.js:230-236, 328): the one trailing action of the location bar, for
  H5's `trailing` snippet. Shown while a deficit is open and the scene from before its excursion is
  held. While any run is in flight it stays, draws as unavailable and says so with aria-disabled, so the focus the click put
  here is not dropped (deviation x2-aria-disabled-while-opening).
-->
<script lang="ts">
  import { t } from '../../lib/core/i18n/index.ts';
  import type { View } from '../../lib/state/view.svelte.ts';
  import type { DeficitsExplorer } from './explorer.svelte.ts';

  let { explorer, view }: { explorer: DeficitsExplorer; view: View } = $props();

  const deficit = $derived(view.explorer === 'deficits' ? view.selectedDeficit : null);
</script>

{#if deficit && explorer.restorable}
  <button
    type="button"
    class="clinical-restore"
    aria-disabled={explorer.opening ? 'true' : undefined}
    onclick={() => explorer.restore(deficit)}
  >
    {t(view.lang, 'clinical').restore}
  </button>
{/if}

<style>
  @layer features {
    /* While a run is in flight the control stays but reads as unavailable, as the region buttons do. */
    .clinical-restore[aria-disabled='true'] {
      color: var(--text-tertiary);
      cursor: default;
      text-decoration: none;
    }
  }
  @layer a11y {
    /* a11y.css:87 */
    @media (forced-colors: active) {
      .clinical-restore {
        color: LinkText;
        text-decoration: underline;
      }
      .clinical-restore[aria-disabled='true'] {
        color: GrayText;
        text-decoration: none;
      }
    }
  }
</style>
