<script lang="ts" module>
  export interface SearchOption {
    value: string;
    /** The option's text, also what a screen reader speaks when it is armed. */
    label: string;
    /** A disabled option explains itself and does nothing; arrows skip it. */
    disabled?: boolean;
  }

  export interface SearchGroup {
    /** Omitted for an ungrouped list. */
    heading?: string;
    options: SearchOption[];
  }
</script>

<script lang="ts">
  import { Combobox } from 'bits-ui';
  import { tick, type Snippet } from 'svelte';
  import { createDebouncedAnnouncer } from './announcer.svelte.ts';

  interface Props {
    /** The field's text. */
    query: string;
    groups: SearchGroup[];
    /** The field's accessible name. */
    label: string;
    placeholder: string;
    /** The listbox's accessible name (axe `aria-input-field-name`; decision 0001). */
    listLabel: string;
    clearLabel: string;
    /** The sentence to say about the results: said 500 ms after typing pauses, and only if new. */
    status: string;
    /** Shows the `/` hint; false when single-key shortcuts are off. */
    showShortcut: boolean;
    onselect: (value: string) => void;
    /** What an option shows. */
    option: Snippet<[SearchOption]>;
    /** Sentences and their buttons. They sit after the listbox, which holds only options (navigator.js:412). */
    notes?: Snippet;
  }

  let {
    query = $bindable(),
    groups,
    label,
    placeholder,
    listLabel,
    clearLabel,
    status,
    showShortcut,
    onselect,
    option,
    notes,
  }: Props = $props();

  const uid = $props.id();
  const listId = `${uid}-list`;
  let input = $state<HTMLInputElement | null>(null);
  let list = $state<HTMLElement | null>(null);

  // A list with nothing to arm is collapsed: the field is then not a combobox with a popup in view.
  const expanded = $derived(groups.some((group) => group.options.length > 0));

  const announcer = createDebouncedAnnouncer();
  $effect(() => () => announcer.dispose());
  $effect(() => {
    // A cleared search may say its count again (decision 37 on #4).
    if (query.trim() === '') announcer.reset();
    else announcer.say(status);
  });

  /** The armed option, brought into view: at the top when results change, else the nearest edge. */
  async function reveal(block: ScrollLogicalPosition) {
    await tick();
    list?.querySelector('[data-highlighted]')?.scrollIntoView({ block });
  }
  $effect(() => {
    void groups;
    void reveal('start');
  });

  function onkeydown(event: KeyboardEvent) {
    // Marked handled: the page's own Escape would otherwise go on to clear the selection.
    if (event.key === 'Escape' && query !== '' && !event.isComposing) {
      event.preventDefault();
      query = '';
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      void reveal('nearest');
    }
  }

  function clear() {
    query = '';
    input?.focus();
  }
</script>

<!--
  Bits Combobox (APG combobox, list autocomplete with manual selection). The field's text is
  `query`, not Bits' own input value, so choosing an option leaves the search as typed. The
  popup is the inline `ContentStatic`, always open while it has options.
-->
<div class="search">
  <Combobox.Root
    type="single"
    bind:value={() => '', (value) => value && onselect(value)}
    bind:open={() => expanded, () => {}}
  >
    <div class="search-box">
      <svg
        class="search-affordance"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <Combobox.Input
        bind:ref={input}
        aria-label={label}
        aria-controls={listId}
        {onkeydown}
        oninput={(event) => (query = event.currentTarget.value)}
      >
        {#snippet child({ props })}
          <input
            {...props}
            type="search"
            autocomplete="off"
            spellcheck="false"
            {placeholder}
            value={query}
          />
        {/snippet}
      </Combobox.Input>
      {#if query !== ''}
        <button type="button" class="search-clear" aria-label={clearLabel} onclick={clear}>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      {:else if showShortcut}
        <kbd class="search-shortcut" aria-hidden="true">/</kbd>
      {/if}
    </div>
    <Combobox.ContentStatic id={listId} aria-label={listLabel} bind:ref={list} class="search-list">
      {#each groups as group, index (group.heading ?? index)}
        {#if group.heading !== undefined}
          <Combobox.Group>
            <Combobox.GroupHeading class="search-group-heading">
              {group.heading}
            </Combobox.GroupHeading>
            {#each group.options as item (item.value)}
              <Combobox.Item
                value={item.value}
                label={item.label}
                disabled={item.disabled}
                class="search-option"
              >
                {@render option(item)}
              </Combobox.Item>
            {/each}
          </Combobox.Group>
        {:else}
          {#each group.options as item (item.value)}
            <Combobox.Item
              value={item.value}
              label={item.label}
              disabled={item.disabled}
              class="search-option"
            >
              {@render option(item)}
            </Combobox.Item>
          {/each}
        {/if}
      {/each}
    </Combobox.ContentStatic>
  </Combobox.Root>
  {@render notes?.()}
</div>

<style>
  @layer components {
    .search-box {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
    }
    .search-affordance {
      position: absolute;
      left: 10px;
      width: 14px;
      height: 14px;
      color: var(--text-tertiary);
      pointer-events: none;
    }
    input[type='search'] {
      width: 100%;
      padding-left: 32px;
      padding-right: 36px;
      transition: border-color var(--ui-transition) var(--ease-ui);
    }
    input[type='search']::placeholder {
      color: var(--text-tertiary);
      opacity: 1;
    }
    /* One clear control: the native one is hidden (decision 38 on #4). */
    input[type='search']::-webkit-search-cancel-button {
      appearance: none;
      display: none;
    }
    input[type='search']:not(:focus) {
      background-color: var(--surface-navigation);
    }
    input[type='search']:focus {
      border-color: var(--accent);
    }
    .search-clear {
      position: absolute;
      inset-block: 0;
      right: var(--space-1);
      margin-block: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      padding: 0;
      background: transparent;
      color: var(--text-tertiary);
    }
    .search-shortcut {
      position: absolute;
      right: var(--space-2);
      pointer-events: none;
    }
    :global(:root[data-single-keys='off']) .search-shortcut {
      display: none;
    }
    .search :global(.search-list) {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    /* The armed option takes the tree's keyboard ring (navigator.css:30). */
    .search :global(.search-option[data-highlighted]) {
      outline: 2px solid var(--accent);
      outline-offset: -2px;
    }
    .search :global(.search-option[aria-disabled='true']) {
      cursor: default;
    }
    @media (hover: hover) and (pointer: fine) {
      input[type='search']:hover:not(:disabled) {
        border-color: var(--text-secondary);
      }
      .search-clear:hover:not(:disabled) {
        color: var(--text-primary);
        background: var(--surface-hover);
      }
    }
    @media (pointer: coarse) {
      .search-clear {
        width: 44px;
        height: 44px;
        right: 0;
      }
    }
  }
  @layer a11y {
    @media (forced-colors: active) {
      input[type='search']:focus-visible {
        outline-color: Highlight;
      }
    }
  }
</style>
