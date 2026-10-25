<!--
  The status bar (index.html:593-597, ui/chrome/header.js:536-542): the statement that this is
  not clinical anatomy never truncates; the description of what is loaded gives way; then the
  count and the Provenance button. A plain <footer>, no live region (the count changes are
  visual; mode and selection changes announce through the announcer). Phones hide it: the
  statement moves to the sheet grip and Provenance to the ⋯ menu (phone.css:48-49).
  The button exists once the owner supplies `onprovenance` (legacy shipped it hidden until boot).
-->
<script lang="ts">
  import type { Language } from '../../lib/types/index.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import { colophonParts } from '../../lib/core/panels/header.ts';

  interface Props {
    lang: Language;
    anatomy?: { display_name?: string; subject?: string; id?: string; individual: boolean };
    reference?: { label: string };
    /** The count's text (`regionCountText`); empty hides it. */
    regionCount: string;
    onprovenance?: (event: MouseEvent) => void;
  }

  let { lang, anatomy, reference, regionCount, onprovenance }: Props = $props();

  const parts = $derived(colophonParts(lang, { anatomy, reference }));
</script>

<footer id="colophon" class="colophon">
  <p class="colophon-text">
    <span class="colophon-statement">{parts.statement}</span>
    <span class="colophon-description">{parts.description}</span>
  </p>
  <span class="region-count">{regionCount}</span>
  {#if onprovenance}
    <button type="button" class="provenance-opener" aria-haspopup="dialog" onclick={onprovenance}>
      {t(lang, 'footer').provenance}
    </button>
  {/if}
</footer>

<style>
  @layer features {
    /* masthead.css:453-509. A compact status line keeps the dataset and its limits in view. */
    .colophon {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      gap: var(--space-4);
      /* Starts on the panel's column and ends on the stage gutter, as the masthead does. */
      padding: 0 var(--stage-gutter) 0 var(--panel-inset);
      border-top: 1px solid var(--border-subtle);
      background: var(--surface-base);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      color: var(--text-secondary);
      white-space: nowrap;
    }
    .colophon-text {
      display: flex;
      flex: 1 1 auto;
      align-items: center;
      gap: var(--space-3);
      min-width: 0;
      margin: 0;
    }
    /* The statement never gives way; the description does. */
    .colophon-statement {
      flex: none;
      font-weight: 500;
    }
    .colophon-description {
      min-width: 0;
      padding-left: var(--space-3);
      border-left: 1px solid var(--border-subtle);
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .colophon-description:empty,
    .region-count:empty {
      display: none;
    }
    .region-count {
      flex: none;
      font-variant-numeric: tabular-nums;
    }
    .provenance-opener {
      flex: none;
      min-height: 24px;
      /* The words, not the ground, end on the stage gutter. */
      margin-right: calc(-1px - var(--space-2));
      padding: 0 var(--space-2);
      background: none;
      color: var(--text-secondary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      font-weight: 500;
    }
    /* A coarse pointer needs the project's 44px target at any width: the bar grows and the button fills it (deviations/h4-coarse-target.md). */
    @media (pointer: coarse) {
      .provenance-opener {
        /* The bar is 44px here (app/layout.css), and the button fills it. */
        align-self: stretch;
      }
    }
    @media (hover: hover) and (pointer: fine) {
      .provenance-opener:hover {
        background: var(--surface-hover);
        color: var(--text-primary);
      }
    }
    /* phone.css:48-49: the statement is in the sheet grip, Provenance in the ⋯ menu. */
    @media (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      .colophon {
        display: none;
      }
    }
  }
</style>
