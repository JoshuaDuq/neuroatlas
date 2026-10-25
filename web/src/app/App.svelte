<script lang="ts">
  import './layout.css';
  import { decodeState } from '../lib/core/state/url-state.ts';
  import { startLanguage } from '../lib/state/language.svelte.ts';
  import { PREF_KEYS, readPref } from '../lib/state/prefs.ts';
  import type { Language, SessionState } from '../lib/types/index.ts';
  import MastheadRegion from './regions/MastheadRegion.svelte';
  import PanelsRegion from './regions/PanelsRegion.svelte';
  import StageRegion from './regions/StageRegion.svelte';
  import StatusRegion from './regions/StatusRegion.svelte';

  // Until the integration chunks supply the session and the language store, the shell starts
  // loading, in the language the head script of index.html already put on <html>.
  let {
    status = 'loading',
    lang = startLanguage(decodeState(location.hash).state.lang, readPref(PREF_KEYS.language)),
  }: { status?: SessionState['status']; lang?: Language } = $props();

  // `#app` is the mount point and the grid, so the legacy `#app[data-status]` selectors keep working.
  $effect(() => {
    document.getElementById('app')!.dataset.status = status;
  });
</script>

<MastheadRegion />
<PanelsRegion {lang} />
<StageRegion />
<StatusRegion />
