<!-- Fixture for the data bar tests: the masthead around it, the live region and the tooltip. Not shipped. -->
<script lang="ts">
  import { onMount, type ComponentProps } from 'svelte';
  import type { ThemeChoice } from '../../lib/state/theme.svelte.ts';
  import type { Language } from '../../lib/types/index.ts';
  import { attachAnnouncer } from '../../lib/ui/announcer.svelte.ts';
  import Tooltip from '../../lib/ui/Tooltip.svelte';
  import DataBar from './DataBar.svelte';
  import Masthead from './Masthead.svelte';

  type Bar = Omit<
    ComponentProps<typeof DataBar>,
    'onAtlas' | 'onSurfaceColor' | 'onDetail' | 'onAnatomy' | 'settingsOpen'
  >;

  let {
    bar,
    calls = [],
    onCommand,
  }: { bar: Bar; calls?: string[]; onCommand?: (command: string) => void } = $props();
  const command = (name: string) => {
    calls.push(name);
    onCommand?.(name);
  };

  let themeChoice = $state<ThemeChoice>('system');
  let singleKeys = $state(true);
  let settingsOpen = $state(false);
  let region: HTMLElement;

  onMount(() => attachAnnouncer(region));
  $effect(() => {
    document.documentElement.lang = bar.lang;
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
  lang={bar.lang}
  {themeChoice}
  {singleKeys}
  ready
  fullscreen={false}
  exitFullscreenLabel="Exit full screen"
  provenanceReady
  bind:settingsOpen
  onSkipToModel={() => {}}
  onLanguage={(next: Language) => calls.push(`lang:${next}`)}
  onTheme={(next) => (themeChoice = next)}
  onSingleKeys={(on) => (singleKeys = on)}
  onFullscreen={() => {}}
  onSnapshot={() => {}}
  onProvenance={() => {}}
  onShortcuts={() => {}}
>
  {#snippet data()}
    <DataBar
      {...bar}
      bind:settingsOpen
      onAtlas={(id) => command(`atlas:${id}`)}
      onSurfaceColor={(colour) => command(`colour:${colour}`)}
      onDetail={(id) => command(`detail:${id}`)}
      onAnatomy={(id) => command(`anatomy:${id}`)}
    />
  {/snippet}
</Masthead>
<main id="viewport" tabindex="-1"><button type="button">Canvas</button></main>

<style>
  @layer components {
    :global(body) {
      background: var(--surface-base);
      color: var(--text-primary);
    }
    main button {
      min-height: 32px;
      border: 1px solid var(--border-control);
      background: var(--surface-tonal);
      color: var(--text-primary);
    }
  }
</style>
