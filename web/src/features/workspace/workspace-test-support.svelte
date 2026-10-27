<!--
  Fixture for the workspace tests: the session the composing chunk (I1) owns, as a plain reactive
  `world`, and a list and detail that register their current item as A1 and X-chunks will. Not shipped.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { registerCurrentItem, type WorkspaceView } from '../../lib/core/workspace.ts';
  import { attachAnnouncer } from '../../lib/ui/announcer.svelte.ts';
  import Tooltip from '../../lib/ui/Tooltip.svelte';
  import Workspace from './Workspace.svelte';
  import { GROUPS, REGIONS, type World } from './workspace-test-world.ts';

  type Props = {
    world: World;
    calls?: string[];
    /** Receives the workspace instance. */
    holder?: { workspace?: Workspace };
    slots?: 'stepper' | 'trailing' | 'both';
    manyRows?: boolean;
  };
  let { world, calls = [], holder = {}, slots, manyRows = false }: Props = $props();

  let workspace = $state<Workspace>();
  let region: HTMLElement;
  $effect(() => {
    holder.workspace = workspace;
  });
  onMount(() => attachAnnouncer(region));
  onMount(() =>
    registerCurrentItem(() =>
      document.querySelector<HTMLElement>('[data-row][data-selected=true]'),
    ),
  );

  const rows = $derived(manyRows ? Array.from({ length: 80 }, (_, i) => `left:${i + 1}`) : REGIONS);

  function select(id: string) {
    world.selectedRegion = { id };
    world.selection = {
      kind: 'region',
      label: `Region ${id}`,
      side: 'L',
      sideWord: 'left',
      clearable: true,
    };
  }
</script>

<div
  bind:this={region}
  role="status"
  aria-live="polite"
  class="visually-hidden"
  id="announcer"
></div>
<Tooltip />
<aside
  id="workspace-panel"
  aria-label="Atlas panel"
  style="height: 700px; width: min(360px, 100vw)"
>
  <Workspace
    bind:this={workspace}
    lang={world.lang}
    snapshot={world}
    selection={world.selection}
    place={world.place}
    groups={GROUPS}
    notice={world.notice}
    shell={world.shell}
    onMode={(mode) => {
      calls.push(`mode:${mode}`);
      world.explorer = mode;
    }}
    onClear={() => {
      calls.push('clear');
      world.selectedRegion = null;
      world.selection = {};
    }}
    onReturn={() => calls.push('return')}
    onLocate={() => calls.push('locate')}
    onViewChange={(view: WorkspaceView) => calls.push(`view:${view}`)}
    onNoticeAction={(action) => calls.push(`action:${action}`)}
    onDismiss={() => {
      calls.push('dismiss');
      world.notice = null;
    }}
    stepper={slots === 'stepper' || slots === 'both' ? stepper : undefined}
    trailing={slots === 'trailing' || slots === 'both' ? trailing : undefined}
  >
    {#snippet list()}
      <input aria-label="Search regions" />
      <div style="overflow: auto; flex: 1">
        {#each rows as id (id)}
          <button
            type="button"
            class="fx"
            data-row
            data-selected={world.selectedRegion?.id === id}
            onclick={() => select(id)}>{id}</button
          >
        {/each}
      </div>
    {/snippet}
    {#snippet detail()}
      <h2>Region details</h2>
      <button type="button" class="fx">Detail action</button>
    {/snippet}
  </Workspace>
</aside>

{#snippet stepper()}
  <div role="group" aria-label={world.lang === 'fr' ? 'Étapes' : 'Steps'} class="steps">
    <button
      type="button"
      class="fx step"
      aria-label={world.lang === 'fr' ? 'Précédent' : 'Previous'}>‹</button
    >
    <span>2 / 7</span>
    <button type="button" class="fx step" aria-label={world.lang === 'fr' ? 'Suivant' : 'Next'}
      >›</button
    >
  </div>
{/snippet}
{#snippet trailing()}
  <button type="button">Restore previous view</button>
{/snippet}

<style>
  @layer features {
    .steps {
      display: flex;
      align-items: center;
      flex: none;
    }
    .step {
      width: var(--control-height);
      height: var(--control-height);
      border: 0;
    }
    .fx {
      background: var(--surface-tonal);
      color: var(--text-primary);
    }
    /* A list row at the real rows' height. */
    .fx[data-row] {
      min-height: var(--row-height);
    }
  }
</style>
