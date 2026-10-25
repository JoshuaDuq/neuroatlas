<!--
  APG Disclosure: a button with `aria-expanded` and `aria-controls` that shows or hides a region.
  Enter and Space toggle. Bits Collapsible behind the Planum seam. The chevron turns, except
  under reduced motion, where it points the new way at once (a11y.css:10-11).
-->
<script lang="ts">
  import { Collapsible } from 'bits-ui';
  import type { Snippet } from 'svelte';
  import { iconGraphic } from './IconButton.svelte';

  type Props = {
    open?: boolean;
    /** The trigger's text, which names the disclosure. */
    title: string;
    children: Snippet;
    class?: string;
  };

  let { open = $bindable(false), title, children, class: className }: Props = $props();
</script>

<Collapsible.Root bind:open class={['collapsible', className]}>
  <Collapsible.Trigger class="collapsible-trigger">
    <span class="collapsible-chevron">{@render iconGraphic('chevron-right')}</span>
    <span>{title}</span>
  </Collapsible.Trigger>
  <Collapsible.Content class="collapsible-content">
    {@render children()}
  </Collapsible.Content>
</Collapsible.Root>

<style>
  @layer components {
    :global(.collapsible-trigger) {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      width: 100%;
      min-height: var(--control-height);
      padding: 0 var(--space-1);
      border: 0;
      border-radius: var(--radius-control);
      background: none;
      color: var(--text-primary);
      font-size: var(--text-ui);
      font-weight: 600;
      line-height: var(--lh-ui);
      text-align: start;
      cursor: pointer;
    }
    :global(.collapsible-chevron) {
      display: inline-flex;
      flex: none;
      color: var(--text-secondary);
      transition: transform var(--ui-transition) var(--ease-ui);
    }
    :global(.collapsible-trigger[data-state='open'] .collapsible-chevron) {
      transform: rotate(90deg);
    }
    @media (hover: hover) and (pointer: fine) {
      :global(.collapsible-trigger:hover) {
        background: var(--surface-hover);
      }
    }
    @media (pointer: coarse) {
      :global(.collapsible-trigger) {
        min-height: 44px;
      }
    }
  }

  @layer a11y {
    @media (prefers-reduced-motion: reduce) {
      :global(.collapsible-chevron) {
        transition: none;
      }
    }
  }
</style>
