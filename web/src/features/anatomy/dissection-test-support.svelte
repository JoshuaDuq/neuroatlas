<!--
  Fixture for the dissection bar tests: the one-step history the model keeps (each hide pushes the
  count it replaced, Undo pops it, Restore all is a step of its own) and the two focus targets I1
  provides around the bar, the tree's tab stop and the tab in front. Not shipped.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { Language } from '../../lib/types/index.ts';
  import { FOCUS_TARGETS, registerFocusTarget } from '../../lib/ui/focus.ts';
  import DissectionBar from './DissectionBar.svelte';

  let {
    calls = [],
    lang = 'en',
    count: initialCount,
    history: initialHistory = [],
    treeStop = true,
  }: {
    calls?: string[];
    lang?: Language;
    count: number;
    /** The counts earlier steps replaced; its length is how many steps can be undone. */
    history?: number[];
    /** The tree has a row that holds its tab stop. */
    treeStop?: boolean;
  } = $props();

  let count = $state(untrack(() => initialCount));
  let history = $state<number[]>(untrack(() => [...initialHistory]));
  let stop = $state<HTMLElement>();
  let tab: HTMLElement;

  onMount(() => {
    const unregisterStop = registerFocusTarget(FOCUS_TARGETS.treeStop, () => stop ?? null);
    const unregisterTab = registerFocusTarget(FOCUS_TARGETS.activeTab, () => tab);
    return () => {
      unregisterStop();
      unregisterTab();
    };
  });

  const undo = () => {
    calls.push('undo');
    count = history.pop()!;
  };
  const restore = () => {
    calls.push('restore');
    history.push(count);
    count = 0;
  };
</script>

<button id="before">before</button>
<div id="tree">
  {#if treeStop}<button id="stop" bind:this={stop}>tree stop</button>{/if}
</div>
<DissectionBar
  {lang}
  hiddenCount={count}
  canUndo={history.length > 0}
  onUndo={undo}
  onRestore={restore}
/>
<button id="after">after</button>
<button id="tab" bind:this={tab}>Anatomy</button>
<!-- The same command from outside the bar (the page's Undo key), to see that it takes no focus. -->
<button id="undo-outside" onclick={undo}>undo outside</button>
<button
  id="hide-more"
  onclick={() => {
    history.push(count);
    count += 1;
  }}
>
  hide more
</button>

<style>
  @layer components {
    /* The fixture's own buttons: plain, on the page's colours in both themes. */
    button {
      background: none;
      border: 0;
      display: block;
      min-height: 44px;
      color: var(--text-primary);
    }
  }
</style>
