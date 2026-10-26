<!--
  Find a region (navigator.js:390-461, 704-732): U6's combobox over the catalog's ranked matches,
  with the sentences that say what else there is, after the list. Matches that another atlas or cut
  atlas draws are reported with a button that switches to it, not dropped. Choosing a result
  empties the query, so the tree returns around it, then selects the region or reveals it.
-->
<script lang="ts">
  import type { CatalogGroup, CatalogRow } from '../../lib/core/catalog/catalog.ts';
  import { cutAtlasesOf, type HiddenReason } from '../../lib/core/catalog/visibility.ts';
  import { count } from '../../lib/core/format.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import {
    groupDisplayName,
    matchesElsewhere,
    sharedGroupNames,
    UNREVEALABLE,
  } from '../../lib/core/panels/navigator.ts';
  import type { Language } from '../../lib/types/index.ts';
  import EmptyState from '../../lib/ui/EmptyState.svelte';
  import SearchCombobox, { type SearchGroup } from '../../lib/ui/SearchCombobox.svelte';
  import SearchResults from './SearchResults.svelte';

  interface Surface {
    id: string;
    label: string;
  }

  interface Props {
    lang: Language;
    query: string;
    /** The catalog's ranked matches for a query under the current display, capped, with the real total. */
    search: (query: string) => { rows: CatalogRow[]; total: number };
    /** The tree's groups: a group name two vocabularies share says which one it is. */
    groups: readonly CatalogGroup[];
    selectedId: string | null;
    atlases: readonly Surface[];
    atlas: string;
    cutAtlases: readonly Surface[];
    cutAtlas: string;
    /** A region that is on screen was chosen. */
    onSelect: (id: string) => void;
    /** A region that is not on screen was chosen: undo what hides it, then select it. */
    onReveal: (reason: HiddenReason, id: string) => void;
    /** A rejection is the caller's to report: it is not caught here. */
    onAtlas: (id: string) => void | Promise<void>;
    onCutAtlas: (id: string) => void | Promise<void>;
  }

  let {
    lang,
    query = $bindable(),
    search,
    groups,
    selectedId,
    atlases,
    atlas,
    cutAtlases,
    cutAtlas,
    onSelect,
    onReveal,
    onAtlas,
    onCutAtlas,
  }: Props = $props();

  interface Note {
    /** What found nothing: the heading of the first sentence, when nothing is listed. */
    title?: string;
    text: string;
    action?: { label: string; run: () => void | Promise<void> };
  }

  const copy = $derived(t(lang, 'navigator'));
  const trimmed = $derived(query.trim());
  const found = $derived(trimmed ? search(trimmed) : { rows: [], total: 0 });
  // A row hidden by an atlas mismatch is elsewhere, not absent; switching a surface atlas and
  // switching the cut labels are different controls, so they are reported apart.
  const here = $derived(
    found.rows.filter((row) => row.reason !== 'other-atlas' && row.reason !== 'other-cut-atlas'),
  );
  const shared = $derived(sharedGroupNames(groups));
  const place = (row: CatalogRow) => groupDisplayName(row.label.group, row.region, shared, lang);

  const sentences = $derived.by((): Note[] => {
    const atlasNames = t(lang, 'atlases') as Record<string, string | undefined>;
    const named = ({ id, label }: Surface) => atlasNames[id] ?? label;
    // Nothing is being searched for: the notes are not shown (navigator.js:745-755).
    if (!trimmed) return [];
    const result: Note[] = [];
    const capped = found.total - found.rows.length;
    // The hint is for a search that found nothing anywhere; matches elsewhere are the next step.
    if (here.length === 0 && found.rows.length === 0) result.push({ text: copy.noMatchHint });
    if (capped > 0) {
      result.push({ text: copy.showingCapped(here.length, count(found.total, 'match', lang)) });
    }
    for (const { atlas: other, rows } of matchesElsewhere(
      found.rows.filter((row) => row.reason === 'other-atlas'),
      atlases,
      atlas,
      (region) => [region.atlas],
    )) {
      result.push({
        text: copy.matchesInOther(count(rows.length, 'match', lang), named(other)),
        action: { label: copy.switchAtlas, run: () => onAtlas(other.id) },
      });
    }
    for (const { atlas: other, rows } of matchesElsewhere(
      found.rows.filter((row) => row.reason === 'other-cut-atlas'),
      cutAtlases,
      cutAtlas,
      cutAtlasesOf,
    )) {
      result.push({
        text: copy.matchesInOtherCut(count(rows.length, 'match', lang), named(other)),
        action: { label: copy.switchCutAtlas, run: () => onCutAtlas(other.id) },
      });
    }
    if (here.length === 0) result[0].title = copy.noMatch(trimmed);
    return result;
  });

  // Said once typing pauses: the count, or what was not found and where to look instead.
  const status = $derived(
    [
      here.length > 0 && found.total === found.rows.length
        ? `${count(here.length, 'match', lang)}.`
        : null,
      ...sentences.flatMap((note) => [note.title ? `${note.title}.` : null, note.text.trim()]),
    ]
      .filter((sentence) => sentence !== null)
      .join(' '),
  );

  const groupsOfOptions = $derived<SearchGroup[]>([
    {
      options: here.map((row) => ({
        value: row.region.id,
        disabled: !row.visible && UNREVEALABLE.has(row.reason),
        current: row.region.id === selectedId,
      })),
    },
  ]);

  let root: HTMLElement;
  const field = () => root.querySelector<HTMLInputElement>('input[role="combobox"]')!;

  /** Moves focus to the field, and selects its text for a new search (the `/` key). */
  export function focusSearch({ select = true }: { select?: boolean } = {}) {
    field().focus();
    if (select) field().select();
  }

  /** U6 never offers a disabled row, so a row that cannot be revealed is not chosen here. */
  function choose(id: string) {
    const row = here.find((entry) => entry.region.id === id)!;
    // A chosen hit belongs in the tree beside its neighbours; the query would keep the list in front of it.
    query = '';
    if (row.visible) onSelect(id);
    else onReveal(row.reason, id);
  }

  /** A button here goes when the list is rebuilt, so focus goes back to the field first. */
  function run(action: () => void | Promise<void>) {
    focusSearch({ select: false });
    return action();
  }
</script>

<div class="anatomy-search" bind:this={root}>
  <SearchCombobox
    bind:query
    groups={groupsOfOptions}
    label={copy.searchPlaceholder}
    placeholder={copy.searchPlaceholder}
    listLabel={copy.searchResults}
    clearLabel={copy.clearSearch}
    {status}
    showShortcut
    onselect={choose}
  >
    {#snippet option({ value })}
      {@const row = here.find((entry) => entry.region.id === value)!}
      <SearchResults
        {row}
        query={trimmed}
        {lang}
        place={place(row)}
        selected={row.region.id === selectedId}
      />
    {/snippet}
    {#snippet notes()}
      {#each sentences as note (note.text)}
        <EmptyState
          title={note.title}
          message={note.text.trim()}
          actionLabel={note.action?.label}
          onaction={note.action && (() => run(note.action!.run))}
        />
      {/each}
    {/snippet}
  </SearchCombobox>
</div>

<style>
  @layer features {
    /* The field, list and notes are the explorer's own flow, so the field can stay pinned above them. */
    .anatomy-search,
    .anatomy-search > :global(.search) {
      display: contents;
    }
  }
</style>
