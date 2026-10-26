<!--
  Restore previous view (clinical.js:230-236, 328): the one trailing action of the location bar, for
  H5's `trailing` snippet. Shown while a deficit is open and the scene from before its excursion is
  held. While something runs it stays and says so with aria-disabled, so the focus the click put
  here is not dropped (deviation x2-aria-disabled-while-opening).
-->
<script lang="ts">
  import { t } from '../../lib/core/i18n/index.ts';
  import type { View } from '../../lib/state/view.svelte.ts';
  import type { DeficitsExplorer } from './explorer.svelte.ts';

  let {
    explorer,
    view,
    restorable,
  }: {
    explorer: DeficitsExplorer;
    view: View;
    /** Whether the scene from before the first deficit can be put back. */
    restorable: boolean;
  } = $props();

  const deficit = $derived(view.explorer === 'deficits' ? view.selectedDeficit : null);
</script>

{#if deficit && restorable}
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
  @layer a11y {
    /* a11y.css:87 */
    @media (forced-colors: active) {
      .clinical-restore {
        color: LinkText;
        text-decoration: underline;
      }
    }
  }
</style>
