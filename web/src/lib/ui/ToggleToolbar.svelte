<!--
  An action, or a choice too expensive to apply by arrowing past it: view presets, cut mode,
  paint picks. APG Toolbar of `aria-pressed` toggle buttons (decision 0003, deviation
  u3-segmented-controls): one Tab stop, arrows/Home/End move focus only, Enter and Space press.
  The parent owns what is pressed; this holds no state. Roving is Toolbar.svelte's (roving.ts):
  the Tab stop is the focused button, else the pressed one, else the first enabled one; the
  vertical arrows move like the horizontal ones. Plain buttons with an explicit `aria-pressed`.
-->
<script lang="ts" generics="Value extends string">
  import { iconGraphic } from './IconButton.svelte';
  import type { IconName } from './icons.ts';
  import { roving } from './Toolbar.svelte';

  interface Item {
    value: Value;
    label: string;
    /** The accessible name, when the drawn text is an abbreviation. */
    name?: string;
    icon?: IconName;
    disabled?: boolean;
  }

  type Naming = { label: string; labelledby?: never } | { labelledby: string; label?: never };

  type Props = Naming & {
    items: readonly Item[];
    /** The pressed item, or null when none is (a held view preset ends). */
    pressed: Value | null;
    onpress: (value: Value) => void;
    class?: string;
  };

  let { items, pressed, onpress, label, labelledby, class: className }: Props = $props();
</script>

<div
  role="toolbar"
  {@attach roving}
  aria-label={label}
  aria-labelledby={labelledby}
  class={['segmented', 'toggle-toolbar', className]}
>
  {#each items as item (item.value)}
    <button
      type="button"
      aria-pressed={pressed === item.value}
      aria-label={item.name}
      disabled={item.disabled}
      onclick={() => onpress(item.value)}
    >
      {#if item.icon}{@render iconGraphic(item.icon)}{/if}
      <span class="control-label">{item.label}</span>
    </button>
  {/each}
</div>

<style>
  @layer components {
    /* The same track as ChoiceGroup's (components.css:212-237). */
    :global(.segmented.toggle-toolbar) {
      display: flex;
      align-items: stretch;
      gap: 2px;
      padding: 2px;
      border-radius: var(--radius-control);
      background: var(--surface-tonal);
    }
    :global(.segmented.toggle-toolbar button) {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      height: calc(var(--control-height) - 4px);
      min-width: 24px;
      padding: 0 var(--space-3);
      margin: 0;
      border: 0;
      border-radius: var(--radius-small);
      background: transparent;
      color: var(--text-secondary);
      font-size: var(--text-ui);
      font-weight: 500;
      line-height: var(--lh-ui);
      white-space: nowrap;
      cursor: pointer;
      transition:
        background-color var(--ui-transition) var(--ease-ui),
        color var(--ui-transition) var(--ease-ui);
    }
    :global(.segmented.toggle-toolbar .control-label) {
      min-width: 0;
    }
    :global(.segmented.toggle-toolbar .control-icon) {
      flex: none;
    }
    :global(.segmented.toggle-toolbar button:disabled) {
      color: var(--text-tertiary);
      cursor: default;
    }
    @media (hover: hover) and (pointer: fine) {
      :global(.segmented.toggle-toolbar button:hover:not(:disabled, [aria-pressed='true'])) {
        background: var(--surface-tonal-hover);
        color: var(--text-primary);
      }
    }
    :global(.segmented.toggle-toolbar button[aria-pressed='true']) {
      background: var(--surface-raised);
      color: var(--text-primary);
      font-weight: 600;
      box-shadow: inset 0 0 0 1px var(--thumb-ring);
    }
    :global(.segmented.toggle-toolbar button:focus-visible) {
      outline-offset: -2px;
    }
    @media (pointer: coarse) {
      :global(.segmented.toggle-toolbar button) {
        min-height: 44px;
      }
    }
  }

  @layer a11y {
    @media (prefers-contrast: more) {
      :global(.segmented.toggle-toolbar) {
        box-shadow: inset 0 0 0 1px var(--border-control);
      }
    }
    @media (forced-colors: active) {
      :global(.segmented.toggle-toolbar button[aria-pressed='true']) {
        outline: 2px solid Highlight;
        outline-offset: -2px;
      }
    }
  }
</style>
