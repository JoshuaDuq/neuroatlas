<script lang="ts">
  import './layout.css';
  import { getApp } from './application.svelte.ts';
  import { decodeState } from '../lib/core/state/url-state.ts';
  import { startLanguage } from '../lib/state/language.svelte.ts';
  import { PREF_KEYS, readPref } from '../lib/state/prefs.ts';
  import type { Language, SessionState } from '../lib/types/index.ts';
  import Tooltip from '../lib/ui/Tooltip.svelte';
  import StageStatus from '../features/stage/StageStatus.svelte';
  import MastheadRegion from './regions/MastheadRegion.svelte';
  import PanelsRegion from './regions/PanelsRegion.svelte';
  import StageRegion from './regions/StageRegion.svelte';
  import StatusRegion from './regions/StatusRegion.svelte';

  // The status and language follow the app (`shellOptions`); a bare shell starts loading, in the
  // language the head script of index.html already put on <html>.
  let {
    status = 'loading',
    lang = startLanguage(decodeState(location.hash).state.lang, readPref(PREF_KEYS.language)),
  }: {
    status?: SessionState['status'];
    lang?: Language;
  } = $props();

  const app = getApp();

  let stage = $state<StageRegion>();
  let masthead = $state<MastheadRegion>();
  let choosing = $state(false);

  // `#app` is the mount point and the grid, so the legacy `#app[data-status]` selectors keep working.
  $effect(() => {
    document.getElementById('app')!.dataset.status = status;
  });
</script>

<!-- One tooltip for every `data-tooltip` on the page. -->
<Tooltip />
<MastheadRegion
  bind:this={masthead}
  bind:choosing
  {lang}
  isFullscreen={() => stage?.isFullscreen() ?? false}
  onFullscreen={() => stage!.toggleFullscreen()}
  onSnapshot={() => void stage!.saveImage()}
/>
<PanelsRegion {lang} />
<StageRegion bind:this={stage}>
  <StageStatus
    {status}
    {lang}
    progress={app.session.state.progress ?? undefined}
    failure={app.failure}
  />
</StageRegion>
<StatusRegion {lang} {choosing} onProvenance={(event) => masthead!.openProvenance(event)} />
