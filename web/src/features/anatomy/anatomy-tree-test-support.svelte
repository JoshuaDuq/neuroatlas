<!-- Fixture for the anatomy tree tests: a small catalog and the stores I1 composes around the tree. Not shipped. -->
<script lang="ts">
  import type { CatalogGroup } from '../../lib/core/catalog/catalog.ts';
  import { GROUPS } from './anatomy-tree-test-support.ts';
  import { onMount, untrack } from 'svelte';
  import type { Language } from '../../lib/types/index.ts';
  import { attachAnnouncer } from '../../lib/ui/announcer.svelte.ts';
  import AnatomyTree from './AnatomyTree.svelte';
  import TreeHeader from './TreeHeader.svelte';

  let {
    calls = [],
    lang = 'en',
    groups = GROUPS,
    selected: initialSelected = null,
    open = [],
    hide = [],
  }: {
    calls?: string[];
    lang?: Language;
    groups?: CatalogGroup[];
    selected?: string | null;
    open?: string[];
    hide?: string[];
  } = $props();

  let expanded = $state(new Set<string>(untrack(() => open)));
  let hidden = $state(new Set<string>(untrack(() => hide)));
  let selectedId = $state<string | null>(untrack(() => initialSelected));
  let tree: ReturnType<typeof AnatomyTree>;
  let region: HTMLElement;

  onMount(() => attachAnnouncer(region));
</script>

<div bind:this={region} role="status" aria-live="polite" aria-atomic="true" id="announcer"></div>
<button id="before">before</button>
<!-- The panel's head carries the inset the toggle's negative margin reaches into. -->
<div class="head">
  <TreeHeader {lang} {groups} {expanded} onExpandedChange={(next) => (expanded = next)} />
</div>
<AnatomyTree
  bind:this={tree}
  {lang}
  {groups}
  hiddenRegions={hidden}
  {expanded}
  onExpandedChange={(next) => (expanded = next)}
  {selectedId}
  onSelect={(id) => {
    calls.push(`select ${id}`);
    selectedId = id;
  }}
  onReveal={(reason, id) => calls.push(`reveal ${reason} ${id}`)}
  onHide={(ids) => {
    calls.push(`hide ${ids.join(',')}`);
    hidden = new Set([...hidden, ...ids]);
  }}
  onShow={(ids) => {
    calls.push(`show ${ids.join(',')}`);
    hidden = new Set([...hidden].filter((id) => !ids.includes(id)));
  }}
/>
<button id="after">after</button>
<button id="pick-cingulate" onclick={() => (selectedId = 'd:left:3')}>pick cingulate</button>
<!-- A press must not take focus: S5a's walk keys run from wherever focus already is. -->
<button id="walk-down" onmousedown={(e) => e.preventDefault()} onclick={() => tree.moveFocus(1)}>
  walk down
</button>
<button id="walk-up" onmousedown={(e) => e.preventDefault()} onclick={() => tree.moveFocus(-1)}>
  walk up
</button>

<style>
  @layer components {
    /* The fixture's own buttons: plain, on the page's colours in both themes. */
    button {
      background: none;
      border: 0;
    }
    .head {
      padding-inline: var(--panel-inset);
    }
  }
</style>
