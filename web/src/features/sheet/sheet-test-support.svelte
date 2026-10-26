<!--
  Fixture for the sheet tests: the page grid the composing chunk (I1/I2) builds, with the real Workspace
  in the sheet, a stage host, and the callbacks recorded. Not shipped.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { registerCurrentItem, type WorkspaceView } from '../../lib/core/workspace.ts';
  import { createMedia } from '../../lib/state/media.svelte.ts';
  import { attachAnnouncer } from '../../lib/ui/announcer.svelte.ts';
  import Workspace from '../workspace/Workspace.svelte';
  import { GROUPS, REGIONS, type World } from '../workspace/workspace-test-world.ts';
  import Sheet from './Sheet.svelte';
  import type { Recorded } from './sheet-test-support.ts';

  type Props = {
    world: World;
    stage: { sheetFull: boolean };
    recorded: Recorded;
    holder?: { sheet?: Sheet };
  };

  let { world, stage, recorded, holder = {} }: Props = $props();

  const media = createMedia();
  let announcer: HTMLElement;
  let viewport: HTMLElement;
  let sheet = $state<Sheet>();
  let view = $state<WorkspaceView>('list');

  $effect(() => {
    holder.sheet = sheet;
  });
  onMount(() => attachAnnouncer(announcer));
  onMount(() =>
    registerCurrentItem(() =>
      document.querySelector<HTMLElement>('[data-row][data-selected=true]'),
    ),
  );

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

<div bind:this={announcer} role="status" aria-live="polite" class="visually-hidden"></div>
<div id="app">
  <header style="height: 52px">Masthead</header>
  <main id="viewport" bind:this={viewport}></main>
  <Sheet
    bind:this={sheet}
    lang={world.lang}
    {media}
    {stage}
    {view}
    selection={world.selection}
    viewport={() => viewport}
    onInsets={(insets, { settle }) => recorded.insets.push({ insets, settle })}
    onDetent={(detent) => recorded.detents.push(detent)}
    onSelection={() => {
      recorded.calls.push('selection');
      select('left:1');
    }}
    onClear={() => {
      recorded.calls.push('clear');
      world.selectedRegion = null;
      world.selection = {};
    }}
  >
    <aside id="workspace-panel" aria-label="Atlas panel">
      <Workspace
        lang={world.lang}
        snapshot={world}
        selection={world.selection}
        place={world.place}
        groups={GROUPS}
        notice={world.notice}
        shell={media.phone ? 'sheet' : 'rails'}
        onMode={(mode) => {
          recorded.calls.push(`mode:${mode}`);
          world.explorer = mode;
        }}
        onClear={() => {
          recorded.calls.push('clear');
          world.selectedRegion = null;
          world.selection = {};
        }}
        onReturn={() => recorded.calls.push('return')}
        onLocate={() => recorded.calls.push('locate')}
        onViewChange={(next) => (view = next)}
        onNoticeAction={(action) => recorded.calls.push(`action:${action}`)}
        onDismiss={() => {
          recorded.calls.push('dismiss');
          world.notice = null;
        }}
      >
        {#snippet list()}
          <input aria-label="Search regions" />
          <div style="overflow: auto; flex: 1">
            {#each REGIONS as id (id)}
              <button
                type="button"
                data-row
                data-selected={world.selectedRegion?.id === id}
                onclick={() => select(id)}>{id}</button
              >
            {/each}
          </div>
        {/snippet}
        {#snippet detail()}
          <h2>Region details</h2>
          <button type="button">Detail action</button>
        {/snippet}
      </Workspace>
    </aside>
  </Sheet>
</div>

<style>
  @layer features {
    /* The features' own rows are not under test; these inherit the page's ink so axe judges the sheet. */
    button[data-row],
    :global(#navigator button, #inspector button) {
      background: none;
      border: 0;
      color: inherit;
      display: block;
      min-height: 44px;
      min-width: 44px;
    }
  }
</style>
