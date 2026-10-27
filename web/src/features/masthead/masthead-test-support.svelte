<!-- Fixture for the masthead tests: the stores and the page pieces I3b composes around it. Not shipped. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { ThemeChoice } from '../../lib/state/theme.svelte.ts';
  import type { Language } from '../../lib/types/index.ts';
  import { attachAnnouncer } from '../../lib/ui/announcer.svelte.ts';
  import Popover from '../../lib/ui/Popover.svelte';
  import Tooltip from '../../lib/ui/Tooltip.svelte';
  import Masthead from './Masthead.svelte';

  let {
    ready = true,
    fullscreen = false,
    provenanceReady = true,
    calls = [],
  }: {
    ready?: boolean;
    fullscreen?: boolean;
    provenanceReady?: boolean;
    calls?: string[];
  } = $props();

  let lang = $state<Language>('en');
  let themeChoice = $state<ThemeChoice>('system');
  let singleKeys = $state(true);
  let settingsOpen = $state(false);
  let dataOpen = $state(false);
  let region: HTMLElement;

  onMount(() => attachAnnouncer(region));

  $effect(() => {
    document.documentElement.lang = lang;
  });
</script>

<div
  bind:this={region}
  role="status"
  aria-live="polite"
  class="visually-hidden"
  id="announcer"
></div>
<Tooltip />
<Masthead
  {lang}
  {themeChoice}
  {singleKeys}
  {ready}
  {fullscreen}
  {provenanceReady}
  bind:settingsOpen
  onSkipToModel={() => calls.push('skip')}
  onLanguage={(next) => ((lang = next), calls.push(`lang:${next}`))}
  onTheme={(next) => ((themeChoice = next), calls.push(`theme:${next}`))}
  onSingleKeys={(on) => ((singleKeys = on), calls.push(`keys:${on}`))}
  onFullscreen={() => calls.push('fullscreen')}
  onSnapshot={() => calls.push('snapshot')}
  onProvenance={() => calls.push('provenance')}
  onShortcuts={() => calls.push(`shortcuts:${document.activeElement?.getAttribute('aria-label')}`)}
>
  {#snippet data()}
    <div class="data">
      <Popover bind:open={dataOpen}>
        {#snippet trigger({ props })}
          <button {...props} type="button">Atlas and display settings</button>
        {/snippet}
        {#snippet children()}
          <button type="button">Subject</button>
        {/snippet}
      </Popover>
    </div>
  {/snippet}
</Masthead>
<main id="viewport" tabindex="-1"><button type="button">Canvas</button></main>

<style>
  @layer components {
    :global(body) {
      background: var(--surface-base);
      color: var(--text-primary);
    }
    .data button,
    main button {
      min-height: 32px;
      border: 1px solid var(--border-control);
      background: var(--surface-tonal);
      color: var(--text-primary);
    }
  }
</style>
