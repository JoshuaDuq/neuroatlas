<!--
  A link in a profile or a region's detail (clinical.css:118-145): a primary-ink row on the text
  column whose name underlines on hover, with an optional colour mark and a second line.
-->
<script lang="ts">
  import Swatch from '../../lib/ui/Swatch.svelte';

  let {
    name,
    secondary,
    colour,
    onclick,
  }: { name: string; secondary?: string; colour?: string; onclick: () => void } = $props();
</script>

<button type="button" class="link-row" {onclick}>
  {#if colour}<span class="mark"><Swatch {colour} /></span>{/if}
  <span class="text">
    <span class="name">{name}</span>
    {#if secondary}<span class="secondary">{secondary}</span>{/if}
  </span>
  <span class="chevron" aria-hidden="true"></span>
</button>

<style>
  @layer features {
    .link-row {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      width: 100%;
      height: auto;
      min-height: var(--row-height);
      margin: 0;
      padding: var(--space-1) 0;
      border: 0;
      border-radius: 0;
      background: none;
      color: var(--text-primary);
      text-align: left;
      font-weight: 400;
      cursor: pointer;
    }
    .link-row:focus-visible {
      outline-offset: 0;
    }
    .mark {
      flex: none;
      align-self: flex-start;
      margin: calc((var(--lh-ui) - 10px) / 2) 1px 0;
    }
    .mark :global(.network-swatch) {
      margin-top: 0;
    }
    .text {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      min-width: 0;
    }
    .name {
      font-weight: 500;
      line-height: var(--lh-ui);
      overflow-wrap: anywhere;
    }
    .secondary {
      color: var(--text-secondary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      font-variant-numeric: tabular-nums;
      overflow-wrap: anywhere;
    }
    .chevron {
      flex: none;
      width: 6px;
      height: 6px;
      margin: 0 3px;
      color: var(--text-tertiary);
      border-right: 1.5px solid currentColor;
      border-bottom: 1.5px solid currentColor;
      transform: translateX(-1.6px) rotate(-45deg);
    }
    /* A mouse sees the chevron on hover or focus; touch always (clinical.css:6-11). */
    @media (hover: hover) and (pointer: fine) {
      .chevron {
        opacity: 0;
      }
      .link-row:hover .chevron {
        opacity: 1;
        transition: opacity var(--ui-transition) var(--ease-ui);
      }
      .link-row:focus-visible .chevron {
        opacity: 1;
      }
      .link-row:hover .name {
        color: var(--accent-hover);
        text-decoration: underline;
        text-underline-offset: 3px;
      }
    }
    @media (pointer: coarse) {
      .link-row {
        min-height: 44px;
      }
    }
  }
</style>
