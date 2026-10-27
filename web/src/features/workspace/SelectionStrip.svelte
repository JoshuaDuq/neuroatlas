<!--
  The selection strip (viewer/ui/chrome/workspace.js:183-187, 255-260, index.html:216-225,
  layout.css:23-50): a button naming the selection, which opens its detail, and a clear. The
  workspace decides when it is shown. The name starts with the visible words and says the side as a
  word, as the phone strip's does (deviations/h5-strip-name-side.md, k20-strip-label-in-name.md).
-->
<script lang="ts">
  import { tick } from 'svelte';
  import { t } from '../../lib/core/i18n/index.ts';
  import { selectionName, type ContextSelection } from '../../lib/core/workspace.ts';
  import type { Language } from '../../lib/types/index.ts';
  import { FOCUS_TARGETS, rescueFocus } from '../../lib/ui/focus.ts';
  import IconButton, { iconGraphic } from '../../lib/ui/IconButton.svelte';

  type Props = {
    lang: Language;
    selection: ContextSelection;
    /** From `stripVisible` and the shell. The strip stays in the page when hidden, so it can be the opener Back returns to. */
    visible: boolean;
    onOpen: () => void;
    onClear: () => void;
    button?: HTMLButtonElement | null;
  };

  let { lang, selection, visible, onOpen, onClear, button = $bindable(null) }: Props = $props();

  const clearLabel = $derived(t(lang, 'inspector').clearSelection);
  // The side is drawn as a letter and said as a word.
  const label = $derived(selection.label ?? '');
  const name = $derived(selectionName(selection));

  // The strip and its clear vanish with the context, so focus goes to the tab in front.
  async function clear() {
    onClear();
    await tick();
    rescueFocus(FOCUS_TARGETS.activeTab);
  }
</script>

<div class="workspace-selection-row" hidden={!visible}>
  <button
    type="button"
    class="workspace-selection"
    aria-label={name}
    bind:this={button}
    onclick={onOpen}
  >
    <span class="selection-name">{label}</span>
    <span class="selection-side">{selection.side ?? ''}</span>
    {@render iconGraphic('chevron-right')}
  </button>
  {#if selection.clearable}
    <IconButton
      class="selection-clear"
      icon="close"
      label={clearLabel}
      data-tooltip={clearLabel}
      onclick={clear}
    />
  {/if}
</div>

<style>
  @layer features {
    .workspace-selection-row {
      display: flex;
      flex: none;
      border-bottom: 1px solid var(--border-subtle);
      background: var(--surface-navigation);
    }
    .workspace-selection {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      flex: 1;
      min-width: 0;
      height: var(--tab-height);
      padding: 0 var(--space-2) 0 var(--panel-inset);
      border: 0;
      border-radius: 0;
      background: transparent;
      color: var(--text-primary);
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    .workspace-selection:focus-visible,
    .workspace-selection-row :global(.selection-clear:focus-visible) {
      outline-offset: -2px;
    }
    .workspace-selection-row :global(.selection-clear) {
      width: var(--tab-height);
      height: var(--tab-height);
      border-radius: 0;
      color: var(--text-tertiary);
    }
    @media (hover: hover) and (pointer: fine) {
      .workspace-selection:hover {
        background: var(--surface-hover);
      }
    }
    .selection-name {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 600;
    }
    /* The side reads as part of the name, in the same sans as hemisphere words elsewhere. */
    .selection-side {
      flex: none;
      color: var(--text-secondary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      font-weight: 400;
    }
    .workspace-selection :global(svg) {
      flex: none;
      margin-left: auto;
      color: var(--text-tertiary);
    }
  }
</style>
