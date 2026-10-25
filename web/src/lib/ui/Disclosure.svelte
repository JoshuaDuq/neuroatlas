<!--
  APG Disclosure on the native <details>: the summary is the button (Enter and Space toggle,
  `open` is exposed as expanded). `open` is bindable, so the state lives with the caller and
  survives a re-render of the content. One chevron style: leading for an inline disclosure,
  trailing for a section (components.css:291-386).
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    summary,
    children,
    open = $bindable(false),
    variant = 'inline',
  }: {
    summary: string;
    children: Snippet;
    open?: boolean;
    variant?: 'inline' | 'section';
  } = $props();
</script>

<details class={variant} bind:open>
  <summary>{summary}</summary>
  {@render children()}
</details>

<style>
  @layer components {
    summary {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-height: var(--control-height);
      list-style: none;
      cursor: pointer;
      font-size: var(--text-ui);
      font-weight: 500;
      line-height: var(--lh-ui);
      color: var(--text-primary);
    }
    summary::-webkit-details-marker {
      display: none;
    }
    /* The one chevron: two 1.5px strokes of a 6px square, inked at the centre of a 12px slot. */
    summary::before {
      content: '';
      flex: none;
      width: 6px;
      height: 6px;
      margin: 0 3px;
      color: var(--text-tertiary);
      border-right: 1.5px solid currentColor;
      border-bottom: 1.5px solid currentColor;
      transform: rotate(var(--chevron-turn, 0deg)) translateX(-1.6px) rotate(-45deg);
      transition: transform var(--ui-transition) var(--ease-ui);
    }
    details[open] > summary {
      --chevron-turn: 90deg;
    }
    summary:focus-visible {
      outline-offset: -2px;
    }
    /* A 32px line in secondary ink, no rule. */
    .inline > summary {
      min-height: 32px;
      font-weight: 400;
      color: var(--text-secondary);
    }
    /* A section: the heading, with the chevron at the right end (down closed, up open). */
    .section {
      margin-top: var(--space-5);
    }
    .section > summary {
      justify-content: space-between;
      min-height: 0;
      padding-block: var(--space-1);
      font-weight: 600;
    }
    .section[open] > summary {
      margin-bottom: var(--space-1);
    }
    .section > summary::before {
      order: 1;
      --chevron-turn: 90deg;
    }
    .section[open] > summary::before {
      --chevron-turn: -90deg;
    }
    @media (hover: hover) and (pointer: fine) {
      summary:hover {
        color: var(--accent);
      }
    }
    @media (pointer: coarse) {
      .inline > summary,
      .section > summary {
        min-height: 44px;
      }
    }
  }
  @layer a11y {
    @media (prefers-reduced-motion: reduce) {
      summary::before {
        transition: none;
      }
    }
  }
</style>
