<!--
  The provenance sheet (ui/panels/provenance.js, index.html:689-697): what the loaded anatomy's
  own published records say about where it came from, as term/definition rows, then the intended
  use. A tract reference is another subject: it shows its own rows instead. Opened by the shell
  (the colophon's button, the phone menu's item) through `open`; mounted only by I3b (decision
  0008). Native modal Dialog: trap, Escape, inert page, `data-instant` and focus return are U5's.
  - initial focus is the title, not Close (deviations/h4-initial-focus.md);
  - published data is English whatever the UI language: it carries `lang="en"`
    (deviations/h4-lang-of-parts.md);
  - a re-render that removes the focused link moves focus to the title, not to the page
    (deviations/h4-rerender-focus.md).
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import type { Language, Manifest } from '../../lib/types/index.ts';
  import type { NeuropsychDomains } from '../../lib/core/catalog/neuropsych-domains.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import {
    provenanceRows,
    referenceRows,
    type ProvenanceItem,
    type ProvenanceLink,
    type ProvenanceRow,
  } from '../../lib/core/panels/provenance.ts';
  import Dialog from '../../lib/ui/Dialog.svelte';
  import { iconGraphic } from '../../lib/ui/IconButton.svelte';

  interface Props {
    open?: boolean;
    instant?: boolean;
    lang: Language;
    manifest: Partial<Manifest>;
    manifestUrl: string;
    indexUrl: string;
    domains: NeuropsychDomains | null;
    /** The tract reference shown instead of the anatomy, with the links of its own sources. */
    reference: { label: string; links: readonly ProvenanceLink[] } | null;
    /** Takes focus on close when the opener is hidden (the phone menu's item): the ⋯ button. */
    fallbackFocus: () => HTMLElement | null;
  }

  let {
    open = $bindable(false),
    instant = $bindable(false),
    lang,
    manifest,
    manifestUrl,
    indexUrl,
    domains,
    reference,
    fallbackFocus,
  }: Props = $props();

  const rowsIn = (language: Language): ProvenanceRow[] =>
    reference
      ? referenceRows(reference, language)
      : provenanceRows(manifest, { lang: language, manifestUrl, indexUrl, domains });
  const rows = $derived(rowsIn(lang));
  const copy = $derived(t(lang, 'footer'));

  // Rows have the same shape in every language, and a value the sheet does not translate is
  // identical in both: that value is the published English.
  // A tract reference's label arrives in the interface language already, so it is never marked.
  const english = $derived(lang === 'en' || reference ? null : rowsIn('en'));
  const dataLang = (
    text: string | null | undefined,
    row: number,
    item: number,
    field: 'text' | 'note',
  ) => (english && text && english[row]?.items[item]?.[field] === text ? 'en' : undefined);

  let title: HTMLElement;
  $effect(() => {
    void rows;
    // The focused link is gone: its node was replaced by the new rows.
    if (untrack(() => open) && !title.closest('dialog')!.contains(document.activeElement)) {
      title.focus();
    }
  });
</script>

{#snippet note(item: ProvenanceItem, row: number, index: number)}
  {#if item.note}
    <p class="provenance-note" lang={dataLang(item.note, row, index, 'note')}>{item.note}</p>
  {/if}
{/snippet}

{#snippet link(item: ProvenanceItem)}
  {#if item.link}
    <a
      class={['provenance-link', item.link.mono && 'code']}
      href={item.link.href}
      target="_blank"
      rel="noreferrer"
      >{item.link.text}<span class="visually-hidden">{` ${t(lang, 'link').newTab}`}</span
      >{@render iconGraphic('external-link')}</a
    >
  {/if}
{/snippet}

<Dialog bind:open bind:instant {fallbackFocus} isolateKeys closeLabel={copy.close}>
  {#snippet heading(id)}
    <!-- Native modal dialogs focus an `autofocus` descendant on open (HTML standard, dialog focusing steps). -->
    <!-- svelte-ignore a11y_autofocus -->
    <h2 {id} class="provenance-title" tabindex="-1" autofocus bind:this={title}>
      {copy.provenance}
    </h2>
  {/snippet}
  <dl class="provenance-facts">
    {#each rows as row, rowIndex}
      <dt>{row.label}</dt>
      <dd>
        {#each row.items as item, itemIndex}
          <div class="provenance-item">
            <!-- A bare link is the item's name; beside a name it is the citation under it. -->
            {#if item.text}
              <p
                class={['provenance-value', item.mono && 'code']}
                lang={dataLang(item.text, rowIndex, itemIndex, 'text')}
              >
                {item.text}
              </p>
              {@render note(item, rowIndex, itemIndex)}
              {@render link(item)}
            {:else}
              {@render link(item)}
              {@render note(item, rowIndex, itemIndex)}
            {/if}
          </div>
        {/each}
      </dd>
    {/each}
  </dl>
  <p class="provenance-use">{copy.intendedUse}</p>
</Dialog>

<style>
  @layer features {
    .provenance-title {
      margin: 0;
    }
    /* dialogs.css:112-133 */
    .provenance-facts {
      display: grid;
      grid-template-columns: 148px minmax(0, 1fr);
      margin: 0;
      font-size: var(--text-ui);
      line-height: var(--lh-ui);
    }
    .provenance-facts dt,
    .provenance-facts dd {
      margin: 0;
      padding: var(--space-2) 0;
      border-bottom: 1px solid var(--border-subtle);
    }
    .provenance-facts dt {
      padding-right: var(--space-4);
      overflow-wrap: anywhere;
      color: var(--text-secondary);
    }
    .provenance-facts dd {
      display: grid;
      gap: var(--space-3);
      min-width: 0;
    }
    .provenance-item {
      display: grid;
      justify-items: start;
      min-width: 0;
    }
    .provenance-value,
    .provenance-note {
      margin: 0;
    }
    .provenance-value {
      overflow-wrap: anywhere;
    }
    .provenance-note {
      overflow-wrap: anywhere;
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      color: var(--text-secondary);
    }
    .provenance-link {
      overflow-wrap: anywhere;
      /* A focused link scrolls clear of the sticky header (WCAG 2.4.11). */
      scroll-margin-top: calc(var(--header-height) + env(safe-area-inset-top) + var(--space-2));
    }
    .provenance-link :global(.control-icon) {
      margin-left: var(--space-1);
      vertical-align: -1px;
    }
    .provenance-use {
      margin: var(--space-4) 0 0;
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      color: var(--text-secondary);
    }
    /* dialogs.css:289-294 */
    @media (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      .provenance-facts {
        grid-template-columns: minmax(0, 1fr);
      }
      .provenance-facts dt {
        padding: calc(var(--space-2) - 1px) 0 0;
        border: 0;
      }
      .provenance-facts dd {
        padding: 0 0 var(--space-2);
      }
    }
  }
</style>
