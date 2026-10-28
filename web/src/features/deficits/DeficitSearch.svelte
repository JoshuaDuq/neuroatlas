<!--
  The deficit search field (index.html:279-295): a native search input with a visible label
  (WCAG 3.3.2, decision 37 on #4), a `/` hint, and one clear control (the browser's own is hidden, decision 38 on
  #4). Not a combobox: the list under it is plain buttons. Escape with text clears it and keeps
  focus; with none it is left to the page's Escape cascade.
-->
<script lang="ts">
  import type { DeficitsExplorer } from './explorer.svelte.ts';

  let {
    explorer,
    query,
    label,
    clearLabel,
    showShortcut,
    controls,
    onquery,
  }: {
    explorer: DeficitsExplorer;
    query: string;
    label: string;
    clearLabel: string;
    showShortcut: boolean;
    /** The id of the list the field filters. */
    controls: string;
    onquery: (value: string) => void;
  } = $props();

  const uid = $props.id();
  let input = $state<HTMLInputElement>();
  $effect(() => {
    explorer.refs.search = input ?? null;
    return () => (explorer.refs.search = null);
  });

  function onkeydown(event: KeyboardEvent) {
    if (event.isComposing || event.key !== 'Escape' || query === '') return;
    // Marked handled: the page's own Escape would otherwise go on to clear the selection.
    event.preventDefault();
    onquery('');
  }

  function clear() {
    onquery('');
    input?.focus();
  }
</script>

<label class="search-label" for="{uid}-field">{label}</label>
<div class="search-box">
  <svg
    class="affordance"
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
    id="{uid}-field"
    type="search"
    autocomplete="off"
    spellcheck="false"
    aria-controls={controls}
    value={query}
    oninput={(event) => onquery(event.currentTarget.value)}
    {onkeydown}
  />
  {#if query.trim() !== ''}
    <button type="button" class="clear" aria-label={clearLabel} onclick={clear}>
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
    <kbd class="shortcut" aria-hidden="true">/</kbd>
  {/if}
</div>

<style>
  @layer features {
    .search-label {
      margin-bottom: var(--space-2);
    }
    .search-box {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
    }
    .affordance {
      position: absolute;
      left: 10px;
      color: var(--text-tertiary);
      pointer-events: none;
    }
    .clear {
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
      border: 0;
      background: transparent;
      color: var(--text-tertiary);
      cursor: pointer;
    }
    .shortcut {
      position: absolute;
      right: 6px;
      padding: 0 6px;
      pointer-events: none;
    }
    :global(:root[data-single-keys='off']) .shortcut {
      display: none;
    }
    @media (hover: hover) and (pointer: fine) {
      .clear:hover {
        color: var(--text-primary);
        background: var(--surface-hover);
      }
    }
    @media (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      .clear {
        width: 36px;
        height: 36px;
      }
      .shortcut {
        display: none;
      }
    }
    /* Touch (phone.css:319-320, 334): a 44px clear button, with room for it in the field. */
    @media (pointer: coarse) {
      .clear {
        width: 44px;
        height: 44px;
        right: 0;
      }
      input {
        padding-right: 44px;
      }
      .shortcut {
        display: none;
      }
    }
  }
  @layer a11y {
    @media (forced-colors: active) {
      input:focus-visible {
        outline-color: Highlight;
        border-color: Highlight;
      }
    }
  }
</style>
