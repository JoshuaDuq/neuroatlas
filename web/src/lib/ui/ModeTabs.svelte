<!--
  The task tabs (viewer/ui/chrome/workspace.js:69-118). APG Tabs with MANUAL activation
  (decision 0004): arrows and Home/End move focus (wrapping), Enter, Space or a click choose,
  because choosing Tracts can swap the whole scene. One tablist; the panel is labelled by the
  selected tab. Vertical arrows are not swallowed here (decision 19 on #4): the global keymap
  (S5a) ignores them while focus is in a tab. Bits Tabs behind the Planum seam.
-->
<script lang="ts" generics="Value extends string">
  import { Tabs } from 'bits-ui';
  import type { Snippet } from 'svelte';

  interface Tab {
    value: Value;
    label: string;
  }

  type Props = {
    tabs: readonly Tab[];
    value: Value;
    /** The tablist's accessible name. */
    label: string;
    /** Content of the selected tab's panel. Unselected panels stay empty and hidden. */
    panel?: Snippet<[Value]>;
    class?: string;
  };

  let { tabs, value = $bindable(), label, panel, class: className }: Props = $props();
</script>

<Tabs.Root
  bind:value={() => value, (next) => (value = next as Value)}
  activationMode="manual"
  loop
  orientation="horizontal"
>
  <Tabs.List aria-label={label} class={['rail-tabs', className]}>
    {#each tabs as tab (tab.value)}
      <Tabs.Trigger value={tab.value}>
        {tab.label}
        <!-- A hidden bold copy holds the width, as legacy's ::after content did; an equivalent implementation. -->
        <span class="tab-width" aria-hidden="true">{tab.label}</span>
      </Tabs.Trigger>
    {/each}
  </Tabs.List>
  {#each tabs as tab (tab.value)}
    <Tabs.Content value={tab.value}>
      {#if panel && tab.value === value}{@render panel(tab.value)}{/if}
    </Tabs.Content>
  {/each}
</Tabs.Root>

<style>
  @layer components {
    /* components.css:384-487, the part shared by every tab row; H5 adds its workspace-bar rules. */
    :global(.rail-tabs) {
      display: flex;
      gap: 0;
      padding: 0 var(--space-3);
      border-bottom: 1px solid var(--border-subtle);
      background: var(--surface-base);
    }
    :global(.rail-tabs [role='tab']) {
      position: relative;
      display: flex;
      flex: 1 1 auto;
      min-width: 0;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: var(--tab-height);
      height: auto;
      margin-bottom: -1px;
      padding: var(--space-2) var(--space-1);
      border: 0;
      border-radius: 0;
      background: none;
      color: var(--text-secondary);
      white-space: normal;
      overflow-wrap: anywhere;
      font-size: var(--text-ui);
      font-weight: 500;
      line-height: var(--lh-ui);
      text-align: center;
      cursor: pointer;
      transition: none;
    }
    /* The bold label's width is held, so choosing a mode moves nothing. */
    :global(.rail-tabs .tab-width) {
      height: 0;
      overflow: hidden;
      visibility: hidden;
      font-weight: 600;
    }
    @media (hover: hover) and (pointer: fine) {
      :global(.rail-tabs [role='tab']:hover:not(:disabled, [aria-selected='true'])) {
        background: var(--surface-hover);
        color: var(--text-primary);
      }
    }
    :global(.rail-tabs [role='tab']:focus-visible) {
      outline-offset: -2px;
    }
    :global(.rail-tabs [role='tab'][aria-selected='true']) {
      background: transparent;
      color: var(--accent);
      font-weight: 600;
    }
    :global(.rail-tabs [role='tab'][aria-selected='true']::before) {
      content: '';
      position: absolute;
      inset: auto 0 0;
      height: 2px;
      background: var(--accent);
    }
    @media (min-width: 801px) and (max-width: 1000px), (max-width: 360px) {
      :global(.rail-tabs [role='tab']) {
        padding-inline: var(--space-1);
        font-size: var(--text-caption);
      }
    }
  }

  @layer a11y {
    /* Fills and shadows are dropped here, so the selected tab needs a system-colour edge (a11y.css:78). */
    @media (forced-colors: active) {
      :global(.rail-tabs [role='tab'][aria-selected='true']) {
        border-bottom: 2px solid Highlight;
      }
    }
  }
</style>
