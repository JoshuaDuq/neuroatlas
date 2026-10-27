<!--
  The detail view's location bar, "‹ Mode › Place" (viewer/ui/chrome/workspace.js:173-182,
  index.html:324-337, layout.css:58-122). An APG breadcrumb: a labelled nav holding an ordered list.
  The first item is a Back button (the list/detail view is not a URL, so it is not a link); the
  last is the place, a button that shows it in the list, so it keeps aria-current="location" while
  shown (deviations/h5-breadcrumb-current.md). `stepper` (X3) and `trailing` (S3's restore) are
  the slots to the right.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { t } from '../../lib/core/i18n/index.ts';
  import type { Crumb } from '../../lib/core/workspace.ts';
  import type { Language } from '../../lib/types/index.ts';

  type Props = {
    lang: Language;
    /** From `locationCrumbs`: the mode, then its place when it has one. */
    crumbs: readonly Crumb[];
    onBack: () => void;
    onGroup: () => void;
    back?: HTMLButtonElement | null;
    stepper?: Snippet;
    trailing?: Snippet;
  };

  let {
    lang,
    crumbs,
    onBack,
    onGroup,
    back = $bindable(null),
    stepper,
    trailing,
  }: Props = $props();

  const copy = $derived(t(lang, 'workspace'));
  const list = $derived(crumbs[0]);
  const group = $derived(crumbs[1]);
</script>

<div class="detail-location">
  <nav class="detail-path" aria-label={copy.path}>
    <ol>
      <li>
        <button
          type="button"
          class="detail-back"
          aria-label={copy.back(list.label)}
          bind:this={back}
          onclick={onBack}
        >
          <span class="chevron back-chevron" aria-hidden="true"></span>
          <span class="detail-back-label">{list.label}</span>
        </button>
      </li>
      {#if group}
        <li>
          <span class="chevron" aria-hidden="true"></span>
          <button
            type="button"
            class="detail-crumb"
            aria-current="location"
            aria-label={copy.showInList(group.label)}
            data-tooltip={copy.showInList(group.label)}
            onclick={onGroup}
          >
            {group.label}
          </button>
        </li>
      {/if}
    </ol>
  </nav>
  {#if stepper}
    <div class="detail-stepper">{@render stepper()}</div>
  {/if}
  {#if trailing}
    <div class="detail-trailing">{@render trailing()}</div>
  {/if}
</div>

<style>
  @layer features {
    /*
     * One line at tab height: the way back, then the place it names, then the circuit stepper
     * and one quiet text action in the trailing slot. The place gives way to an ellipsis
     * before the way back does.
     */
    .detail-location {
      display: flex;
      align-items: center;
      flex: none;
      height: var(--tab-height);
      /* The rule is drawn inside, so the way back and the crumb keep the bar's full 44px as their target. */
      box-shadow: inset 0 -1px var(--border-subtle);
      background: var(--surface-navigation);
    }
    .detail-path {
      flex: 1;
      align-self: stretch;
      min-width: 0;
    }
    ol {
      display: flex;
      height: 100%;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    li {
      display: flex;
      align-items: center;
      min-width: 0;
    }
    li:has(+ li) {
      flex: none;
    }
    /* The one chevron: two 1.5px strokes of a 6px square, inked at the centre of a 12px slot. */
    .chevron {
      flex: none;
      width: 6px;
      height: 6px;
      margin: 0 3px;
      color: var(--text-tertiary);
      border-right: 1.5px solid currentColor;
      border-bottom: 1.5px solid currentColor;
      transform: rotate(var(--chevron-turn, 0deg)) translateX(-1.6px) rotate(-45deg);
    }
    .back-chevron {
      --chevron-turn: 180deg;
    }
    .detail-back,
    .detail-crumb {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-width: 0;
      height: 100%;
      padding: 0 var(--space-2);
      border: 0;
      border-radius: 0;
      background: none;
      color: var(--text-secondary);
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    .detail-back:focus-visible,
    .detail-crumb:focus-visible,
    .detail-trailing :global(button:focus-visible) {
      outline-offset: -2px;
    }
    /* Breadcrumbs share the panel's content column. */
    .detail-back {
      padding-left: var(--panel-inset);
    }
    .detail-crumb {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--text-primary);
      font-weight: 600;
    }
    .detail-back-label {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .detail-stepper {
      display: contents;
    }
    .detail-trailing {
      display: flex;
      flex: none;
      align-self: stretch;
    }
    .detail-trailing > :global(button) {
      height: 100%;
      padding: 0 var(--panel-inset) 0 var(--space-2);
      border: 0;
      border-radius: 0;
      background: none;
      color: var(--accent);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      white-space: nowrap;
    }
    @media (hover: hover) and (pointer: fine) {
      .detail-back:hover,
      .detail-crumb:hover {
        background: none;
        color: var(--accent);
      }
      .detail-trailing > :global(button:hover) {
        color: var(--accent-hover);
        text-decoration: underline;
        text-underline-offset: 3px;
      }
    }
  }
  @layer a11y {
    /* Forced colours drop shadows: the rule returns as an edge. */
    @media (forced-colors: active) {
      .detail-location {
        border-bottom: 1px solid CanvasText;
      }
    }
  }
</style>
