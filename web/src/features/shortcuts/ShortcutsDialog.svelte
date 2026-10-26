<!--
  The keyboard shortcuts sheet (ui/chrome/shortcuts.js, index.html:679-687): the keys grouped by
  area, then the note on turning single-key shortcuts off. Opened by the settings menu's item and
  by `?` through `open`; mounted only by I3b (decision 0008). Native modal Dialog: trap, Escape,
  inert page, `data-instant` and focus return are U5's. It does not isolate keys (decision 7 on
  #4): `?` must reach the page keymap to close it.
  - the title takes initial focus, not Close (deviations/s5b-initial-focus.md);
  - one <div> per group, not an unnamed <section> (deviations/s5b-group-structure.md);
  - a range's dash is read as "to" (deviations/s5b-shortcut-strings.md).
-->
<script lang="ts">
  import type { Language } from '../../lib/types/index.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import Dialog from '../../lib/ui/Dialog.svelte';

  interface Props {
    open?: boolean;
    instant?: boolean;
    lang: Language;
    /** The reader has not turned single-key shortcuts off (WCAG 2.1.4). */
    singleKeys: boolean;
    /** Takes focus on close when the opener is hidden (the settings menu's item): the ⋯ button. */
    fallbackFocus: () => HTMLElement | null;
  }

  let {
    open = $bindable(false),
    instant = $bindable(false),
    lang,
    singleKeys,
    fallbackFocus,
  }: Props = $props();

  // Opened by `?` with nothing focused, it closes the same way: focus stays on the page
  // (shortcuts.js:109,125). The fallback is for an opener that went away, not for none.
  let openedFromBody = false;
  $effect.pre(() => {
    if (open) openedFromBody = document.activeElement === document.body;
  });

  const copy = $derived(t(lang, 'shortcuts'));

  // Moves to `shortcuts.rangeTo` with the C1 amendment (deviations/s5b-shortcut-strings.md).
  const RANGE_TO: Record<Language, string> = { en: 'to', fr: 'à' };

  /** A dash between two keys is a range, not a key to press (shortcuts.js:12-13). */
  const isRange = (token: string) => /^[–—-]$/.test(token);
  const caps = (keys: string) => keys.split(' ').filter(Boolean);
</script>

<Dialog
  bind:open
  bind:instant
  fallbackFocus={() => (openedFromBody ? null : fallbackFocus())}
  closeLabel={copy.close}
>
  {#snippet heading(id)}
    <!-- Native modal dialogs focus an `autofocus` descendant on open (HTML standard, dialog focusing steps). -->
    <!-- svelte-ignore a11y_autofocus -->
    <h2 {id} class="shortcuts-title" tabindex="-1" autofocus>{copy.title}</h2>
  {/snippet}
  {#each copy.groups as [title, rows]}
    <div class="shortcuts-section">
      <h3 class="shortcuts-group">{title}</h3>
      <dl class="shortcuts-list">
        {#each rows as [keys, description]}
          <dt>
            {#each caps(keys) as token}
              {#if isRange(token)}
                <span class="key-range"
                  ><span aria-hidden="true">{token}</span><span class="visually-hidden"
                    >{RANGE_TO[lang]}</span
                  ></span
                >
              {:else}
                <kbd>{token}</kbd>
              {/if}
            {/each}
          </dt>
          <dd>{description}</dd>
        {/each}
      </dl>
    </div>
  {/each}
  <p class="shortcuts-note">{copy.singleKeysNote(singleKeys)}</p>
</Dialog>

<style>
  @layer features {
    .shortcuts-title {
      margin: 0;
    }
    /* dialogs.css:104-123. A datasheet: key column then description, each row ruled. */
    .shortcuts-group {
      margin: 0;
      padding: var(--space-6) 0 var(--space-2);
      font-size: var(--text-caption);
      font-weight: 600;
      line-height: var(--lh-caption);
      color: var(--text-secondary);
    }
    .shortcuts-section:first-of-type .shortcuts-group {
      padding-top: var(--space-4);
    }
    .shortcuts-list {
      display: grid;
      grid-template-columns: 148px minmax(0, 1fr);
      margin: 0;
      border-top: 1px solid var(--border-subtle);
      font-size: var(--text-ui);
      line-height: var(--lh-ui);
    }
    .shortcuts-list dt,
    .shortcuts-list dd {
      margin: 0;
      padding: var(--space-2) 0;
      border-bottom: 1px solid var(--border-subtle);
    }
    .shortcuts-list dt {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: var(--space-1);
      padding-right: var(--space-4);
    }
    .shortcuts-list dd {
      overflow-wrap: anywhere;
    }
    .shortcuts-note {
      margin: var(--space-4) 0 0;
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      color: var(--text-secondary);
    }
    /* dialogs.css:289-294 */
    @media (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      .shortcuts-list {
        grid-template-columns: minmax(0, 1fr);
      }
      .shortcuts-list dt {
        padding: calc(var(--space-2) - 1px) 0 0;
        border: 0;
      }
      .shortcuts-list dd {
        padding: 0 0 var(--space-2);
      }
    }
  }
</style>
