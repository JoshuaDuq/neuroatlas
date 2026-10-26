<!--
  What one search result shows (navigator.js:265-388): the name with the query marked, the code or
  alias that explains a match the name does not, the side's letter, and a second line naming the
  group (or, for a row that is not on screen, why). The option is U6's; this is its content.

  The drawn parts are `aria-hidden` and one visually hidden sentence is the option's name, because
  "L" is not what is said and an option has to say its side, its group and what a press will do.
  The sentence starts with the visible name, so a voice command by name finds it (WCAG 2.5.3).
-->
<script lang="ts">
  import type { CatalogRow } from '../../lib/core/catalog/catalog.ts';
  import { atlasSwitchLabel, t } from '../../lib/core/i18n/index.ts';
  import { matchedAlias, matchSegments, UNREVEALABLE } from '../../lib/core/panels/navigator.ts';
  import type { Language } from '../../lib/types/index.ts';

  interface Props {
    row: CatalogRow;
    /** The trimmed query the rows were found with. */
    query: string;
    lang: Language;
    /** The group as the tree names it, which qualifies a name two vocabularies share. */
    place: string;
    selected: boolean;
  }

  let { row, query, lang, place, selected }: Props = $props();

  const copy = $derived(t(lang, 'navigator'));
  const side = $derived(t(lang, 'sides').words[row.region.hemisphere]);
  const alias = $derived(matchedAlias(row.label, query));
  const heard = $derived(alias ? `${row.label.name}, ${alias}` : row.label.name);
  const reason = $derived.by(() => {
    if (row.visible) return null;
    const reasons = t(lang, 'reasons');
    if (row.reason === 'other-detail')
      return reasons.inDetailSet(atlasSwitchLabel(row.region.atlas!, lang));
    const text = (reasons as Record<string, unknown>)[row.reason];
    return typeof text === 'string' ? text : reasons.fallback;
  });
  const spoken = $derived(
    row.visible
      ? `${heard}, ${side}, ${place}`
      : (UNREVEALABLE.has(row.reason) ? copy.rowUnavailableAria : copy.rowHiddenAria)(
          heard,
          side,
          reason!,
        ),
  );
</script>

{#snippet marked(text: string)}
  {#each matchSegments(text, query) as segment}
    {#if segment.match}<mark class="query-match">{segment.text}</mark>{:else}{segment.text}{/if}
  {/each}
{/snippet}

<span class="result" data-selected={selected || undefined} data-hidden={!row.visible || undefined}>
  <span class="line" aria-hidden="true" data-tooltip={row.visible ? undefined : spoken}>
    <span class="title"
      >{@render marked(row.label.name)}{#if alias}<span class="alias"
          >({@render marked(alias)})</span
        >{/if}</span
    >
    <span class="side">{t(lang, 'sides').glyphs[row.region.hemisphere]}</span>
    <span class="second">{row.visible ? place : reason}</span>
  </span>
  <span class="visually-hidden">{spoken}</span>
</span>

<style>
  @layer features {
    .result {
      display: block;
    }
    /* A name and its side on one line, the quieter second line under both (navigator.css:36-59). */
    .line {
      display: grid;
      grid-template-columns: minmax(0, 1fr) max-content;
      align-items: baseline;
      gap: 0 var(--space-3);
    }
    .title {
      grid-column: 1;
      grid-row: 1;
      min-width: 0;
      line-height: var(--lh-ui);
      overflow-wrap: anywhere;
      text-wrap: pretty;
    }
    .alias {
      margin-inline-start: var(--space-1);
      color: var(--text-tertiary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
    }
    .side {
      grid-column: 2;
      grid-row: 1;
      min-width: 2ch;
      color: var(--text-tertiary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      text-align: end;
      font-variant-numeric: tabular-nums;
    }
    .second {
      grid-column: 1 / -1;
      grid-row: 2;
      color: var(--text-secondary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      overflow-wrap: anywhere;
    }
    .result[data-hidden] .title,
    .result[data-hidden] .second {
      color: var(--text-tertiary);
    }
    .result[data-selected] {
      font-weight: 600;
    }
    .result[data-selected] .second,
    .result[data-selected] .alias {
      color: inherit;
    }
    .query-match {
      background: transparent;
      color: var(--accent);
      font-weight: 600;
    }
  }
  @layer a11y {
    /* Forced colours drop the accent and the weight is barely visible: underline the match. */
    @media (forced-colors: active) {
      .query-match {
        color: inherit;
        text-decoration: underline;
        text-underline-offset: 2px;
      }
    }
  }
</style>
