<script lang="ts" module>
  export interface SearchOption {
    value: string;
    /** A disabled option explains itself and does nothing; arrows skip it. */
    disabled?: boolean;
  }

  export interface SearchGroup {
    /** Omitted for an ungrouped list. */
    heading?: string;
    options: SearchOption[];
  }

  /**
   * The next option an arrow key can arm (navigator.js:44-54). Disabled options explain
   * themselves and do nothing, so the key moves past them; past the ends the armed one stays.
   */
  export function nextEnabledIndex(disabled: boolean[], index: number, delta: number): number {
    if (disabled.length === 0 || delta === 0) return index;
    for (let step = 1; step <= disabled.length; step += 1) {
      const next = index + delta * step;
      if (next < 0 || next >= disabled.length) return index;
      if (!disabled[next]) return next;
    }
    return index;
  }
</script>

<script lang="ts">
  import { tick, type Snippet } from 'svelte';
  import { createDebouncedAnnouncer } from './announcer.svelte.ts';

  interface Props {
    /** The field's text. */
    query: string;
    groups: SearchGroup[];
    /** The field's accessible name. */
    label: string;
    placeholder: string;
    /** The listbox's accessible name. */
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

  const flat = $derived(groups.flatMap((group) => group.options));
  // A list with nothing to arm is collapsed: the field is then not a combobox with a popup in view.
  const expanded = $derived(flat.length > 0);
  /** The armed option: Enter chooses it. It survives Enter, Tab and blur, as in the legacy panel. */
  let armed = $state<string | null>(null);
  const optionId = (value: string) => `${uid}-option-${flat.findIndex((o) => o.value === value)}`;

  const announcer = createDebouncedAnnouncer();
  $effect(() => () => announcer.dispose());
  $effect(() => {
    // A cleared search may say its count again (decision 37 on #4).
    if (query.trim() === '') announcer.reset();
    else announcer.say(status);
  });

  /** Arms `value` and brings it into view: at the top when results change, else the nearest edge. */
  async function arm(value: string | null, block: ScrollLogicalPosition) {
    armed = value;
    if (value === null) return;
    await tick();
    document.getElementById(optionId(value))?.scrollIntoView({ block });
  }

  // Every render arms the first enabled option, so Enter works from the first keystroke (navigator.js:452-461).
  $effect(() => {
    void arm(flat.find((o) => !o.disabled)?.value ?? null, 'start');
  });

  function move(delta: number) {
    const current = flat.findIndex((o) => o.value === armed);
    const index = nextEnabledIndex(
      flat.map((o) => o.disabled === true),
      current,
      delta,
    );
    // With every option disabled nothing is armed and nothing can be (navigator.js:642).
    if (index !== current) void arm(flat[index].value, 'nearest');
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.isComposing) return;
    if (event.key === 'Escape' && query !== '') {
      // Marked handled: the page's own Escape would otherwise go on to clear the selection.
      event.preventDefault();
      query = '';
    } else if (!expanded || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      move(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Enter' && armed !== null) {
      event.preventDefault();
      onselect(armed);
    }
  }

  function clear() {
    query = '';
    input?.focus();
  }
</script>

<!--
  APG combobox, list autocomplete with manual selection, built by hand on U2's primitives
  (decision 34 on #4): Bits' escape layer handles every Escape on the page while its list is open,
  and the inline list has to stay up beside dialogs. Focus stays in the field; the armed option is
  pointed at with `aria-activedescendant`. Escape is handled only in the field.
-->
<div class="search">
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
    <input
      bind:this={input}
      type="search"
      role="combobox"
      aria-label={label}
      aria-autocomplete="list"
      aria-expanded={expanded}
      aria-controls={listId}
      aria-activedescendant={expanded && armed !== null ? optionId(armed) : undefined}
      autocomplete="off"
      spellcheck="false"
      {placeholder}
      bind:value={query}
      {onkeydown}
    />
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
  <div id={listId} role="listbox" aria-label={listLabel} class="search-list" hidden={!expanded}>
    {#each groups as group, index (group.heading ?? index)}
      {#if group.heading !== undefined}
        <div role="group" aria-labelledby="{uid}-group-{index}">
          <div id="{uid}-group-{index}" class="search-group-heading">{group.heading}</div>
          {#each group.options as item (item.value)}
            {@render row(item)}
          {/each}
        </div>
      {:else}
        {#each group.options as item (item.value)}
          {@render row(item)}
        {/each}
      {/if}
    {/each}
  </div>
  {@render notes?.()}
</div>

{#snippet row(item: SearchOption)}
  <!-- Keyboard use is the field's; a pointer chooses with a click and leaves focus in the field. -->
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_interactive_supports_focus -->
  <div
    id={optionId(item.value)}
    role="option"
    class="search-option"
    aria-selected={armed === item.value}
    aria-disabled={item.disabled ? 'true' : undefined}
    data-active={armed === item.value ? 'true' : undefined}
    onpointerdown={(event) => event.preventDefault()}
    onclick={() => !item.disabled && onselect(item.value)}
  >
    {@render option(item)}
  </div>
{/snippet}

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
    .search-list {
      margin: 0;
      padding: 0;
    }
    /* The armed option takes the tree's keyboard ring (navigator.css:30). */
    .search-option[data-active='true'] {
      outline: 2px solid var(--accent);
      outline-offset: -2px;
    }
    .search-option[aria-disabled='true'] {
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
    /* The phone layout (PHONE_QUERY; phone.css:14, 26, 46). */
    @media (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      .search-clear {
        width: 36px;
        height: 36px;
      }
      .search-shortcut {
        display: none;
      }
    }
    /* Touch (phone.css:319-320, 334): a 44px clear button, with room for it in the field. */
    @media (pointer: coarse) {
      .search-clear {
        width: 44px;
        height: 44px;
        right: 0;
      }
      input[type='search'] {
        padding-right: 44px;
      }
      .search-shortcut {
        display: none;
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
