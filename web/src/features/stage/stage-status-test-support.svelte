<!--
  Fixture for the stage status tests: the viewport landmark it is mounted in, the polite region the
  announcer takes over, and a stage dock control that the status hides as the real dock is hidden
  (`visibility: hidden`, stage.css:315). Not shipped.
-->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { Language, LoadStatus } from '../../lib/types/index.ts';
  import { attachAnnouncer } from '../../lib/ui/announcer.svelte.ts';
  import StageStatus from './StageStatus.svelte';

  let {
    status,
    lang = 'en',
    progress,
    failure,
  }: {
    status: LoadStatus;
    lang?: Language;
    progress?: { loaded: number; total: number };
    failure?: { text: string; button?: string; dropLink?: boolean };
  } = $props();

  // As in the page, the live region exists, and is attached, before the app mounts.
  const region = document.body.appendChild(document.createElement('p'));
  region.id = 'announcer';
  region.setAttribute('role', 'status');
  region.setAttribute('aria-live', 'polite');
  region.className = 'visually-hidden';
  const detach = attachAnnouncer(region);
  onDestroy(() => {
    detach();
    region.remove();
  });
</script>

<main id="viewport" tabindex="-1">
  <button id="dock-tool" type="button">Dock tool</button>
  <StageStatus {status} {lang} {progress} {failure} />
</main>

<style>
  @layer features {
    main {
      position: relative;
      height: 100dvh;
      background: var(--scene-background);
    }
    main:has(:global(.stage-status[data-status='error'], .stage-status[data-status='context-lost']))
      #dock-tool {
      visibility: hidden;
    }
  }
</style>
