<!--
  The dissection bar (viewer/ui/panels/dissection.js; index.html:314-322): while parts are hidden,
  the count with Undo and Restore all, ruled off at the foot of the anatomy list. A group, not a
  landmark (decision 36 on #4). The count is not a live region: S1 speaks it once with the
  announcer's sentence. Focus is never left on a button that disabled itself or on a bar that left
  (deviations/a3-focus-fallback.md); Undo is also the target the inspector's Hide asks for.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '../../lib/core/i18n/index.ts';
  import type { Language } from '../../lib/types/index.ts';
  import { FOCUS_TARGETS, registerFocusTarget, requestFocus } from '../../lib/ui/focus.ts';

  interface Props {
    lang: Language;
    /** How many parts are hidden; the bar is there while it is above zero. */
    hiddenCount: number;
    /** The last dissection step can be undone (false after a permalink load). */
    canUndo: boolean;
    onUndo: () => void;
    onRestore: () => void;
  }

  let { lang, hiddenCount, canUndo, onUndo, onRestore }: Props = $props();

  const headingId = $props.id();
  const copy = $derived(t(lang, 'dissection'));

  let group = $state<HTMLElement>();
  let undo = $state<HTMLButtonElement>();
  let restore = $state<HTMLButtonElement>();

  // Before the update that disables the button or removes the bar, while the element can still
  // pass focus on; and only for focus that was in the bar, so no other change takes it.
  $effect.pre(() => {
    const gone = hiddenCount === 0;
    const spent = !canUndo;
    if (!group?.contains(document.activeElement)) return;
    if (gone) {
      requestFocus(FOCUS_TARGETS.treeStop, { fallback: FOCUS_TARGETS.activeTab });
    } else if (spent && document.activeElement === undo) {
      restore!.focus();
    }
  });

  // Undo, or Restore all while Undo is disabled.
  onMount(() =>
    registerFocusTarget(FOCUS_TARGETS.dissectionUndo, () =>
      undo?.disabled ? (restore ?? null) : (undo ?? null),
    ),
  );
</script>

{#if hiddenCount > 0}
  <div class="dissection" role="group" aria-labelledby={headingId} bind:this={group}>
    <h3 id={headingId} class="visually-hidden">{copy.heading}</h3>
    <p class="status">{copy.hiddenCount(hiddenCount)}</p>
    <button type="button" bind:this={undo} disabled={!canUndo} onclick={onUndo}>{copy.undo}</button>
    <button type="button" bind:this={restore} onclick={onRestore}>{copy.restoreAll}</button>
  </div>
{/if}

<style>
  @layer features {
    /* One ruled line as tall as the tab row, wrapping rather than clipping (navigator.css:297-320). */
    .dissection {
      flex: none;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0 var(--space-1);
      min-height: calc(var(--tab-height) + 1px);
      padding: 0 var(--panel-inset);
      border-top: 1px solid var(--border-subtle);
      background: var(--surface-navigation);
    }
    .status {
      flex: 1 1 auto;
      min-width: 0;
      margin: 0;
      font-size: var(--text-ui);
      font-weight: 500;
      line-height: var(--lh-ui);
      font-variant-numeric: tabular-nums;
      overflow-wrap: anywhere;
    }
    button {
      flex: none;
      min-height: var(--control-height);
      padding: 0 var(--space-2);
      border: 0;
      border-radius: var(--radius-control);
      background: none;
      color: var(--text-secondary);
      font-size: var(--text-ui);
      font-weight: 500;
      line-height: var(--lh-ui);
      cursor: pointer;
    }
    button:last-child {
      margin-inline-end: calc(-1 * var(--space-2));
    }
    /* No fill to lose, so a disabled command fades its ink below the secondary step. */
    button:disabled {
      color: color-mix(in srgb, var(--text-tertiary) 55%, transparent);
      cursor: default;
    }
    @media (hover: hover) and (pointer: fine) {
      button:hover:not(:disabled) {
        background: var(--surface-hover);
        color: var(--text-primary);
      }
    }
    @media (pointer: coarse) {
      button {
        min-height: 44px;
      }
    }
  }
</style>
