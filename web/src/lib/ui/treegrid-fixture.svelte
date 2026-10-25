<script lang="ts">
  // Test fixture: a small anatomy-like tree with a select button and an eye button per row.
  // `wide` adds a second action column: precentral's eye is disabled, only cingulate has a side
  // button, the other side cells are empty.
  import { untrack } from 'svelte';
  import Treegrid from './Treegrid.svelte';
  import type { TreegridNode } from './treegrid.ts';

  let {
    log,
    initialSelected = null,
    wide = false,
  }: { log: string[]; initialSelected?: string | null; wide?: boolean } = $props();
  const leaf = (id: string, label: string): TreegridNode<null> => ({ id, label, data: null });
  const nodes: TreegridNode<null>[] = [
    {
      id: 'frontal',
      label: 'Frontal',
      data: null,
      selectable: false,
      children: [leaf('precentral', 'Precentral'), leaf('postcentral', 'Postcentral')],
    },
    leaf('insula', 'Insula'),
    {
      id: 'limbic',
      label: 'Limbic',
      data: null,
      selectable: false,
      children: [leaf('cingulate', 'Cingulate')],
    },
  ];
  let expanded = $state(new Set<string>());
  let hidden = $state(new Set<string>());
  let selected = $state<string | null>(untrack(() => initialSelected));
  const flip = (id: string) => {
    const next = new Set(hidden);
    if (!next.delete(id)) next.add(id);
    hidden = next;
  };
</script>

<button id="before">before</button>
<Treegrid
  label="Anatomy"
  {nodes}
  bind:expanded
  selectedId={selected}
  actions={wide ? ['eye', 'side'] : ['eye']}
  rowLabel={(node) =>
    node.children ? `${node.label}, ${node.children.length} regions` : node.label}
  onactivate={(node) => {
    selected = node.id;
    log.push(`activate ${node.id}`);
  }}
  rowKeys={{ v: (node) => flip(node.id) }}
>
  {#snippet primary(node, state)}
    <button type="button" onclick={() => log.push(`select ${node.id}`)}>{node.label}</button>
    {#if node.children}
      <button
        type="button"
        class="toggle"
        aria-label={`Expand ${node.label}`}
        onclick={state.toggle}
      >
        {state.expanded ? '-' : '+'}
      </button>
    {/if}
  {/snippet}
  {#snippet action(node, id)}
    {#if id === 'eye'}
      <!-- Re-created when the state flips, as a rebuilt visibility control is. -->
      {#key hidden.has(node.id)}
        <button
          type="button"
          aria-label={`Toggle ${node.label}`}
          disabled={wide && node.id === 'precentral'}
          onclick={() => flip(node.id)}
        >
          {hidden.has(node.id) ? 'off' : 'on'}
        </button>
      {/key}
    {:else if node.id === 'cingulate'}
      <button type="button" aria-label="Side Cingulate">side</button>
    {/if}
  {/snippet}
</Treegrid>
<button id="after">after</button>
<button id="select-insula" onclick={() => (selected = 'insula')}>select insula</button>
<button id="collapse-all" onclick={() => (expanded = new Set())}>collapse all</button>
