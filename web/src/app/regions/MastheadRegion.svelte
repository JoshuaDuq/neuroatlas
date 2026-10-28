<script lang="ts">
  import { ASSET_BASE } from '../../../build/site.ts';
  import { tractCatalog } from '../../lib/core/diffusion/catalogs.ts';
  import { isIndependentTractReference } from '../../lib/core/diffusion/presentation.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import type { ProvenanceLink } from '../../lib/core/panels/provenance.ts';
  import type { Language } from '../../lib/types/index.ts';
  import { isKeyboardActivation } from '../../lib/ui/instant.ts';
  import DataBar from '../../features/masthead/DataBar.svelte';
  import Masthead from '../../features/masthead/Masthead.svelte';
  import ProvenanceDialog from '../../features/provenance/ProvenanceDialog.svelte';
  import ShortcutsDialog from '../../features/shortcuts/ShortcutsDialog.svelte';
  import { getApp } from '../application.svelte.ts';

  let {
    lang,
    choosing = $bindable(false),
    isFullscreen,
    onFullscreen,
    onSnapshot,
  }: {
    lang: Language;
    /** A data bar field holds a choice still downloading, so the status bar leaves the download to it. */
    choosing?: boolean;
    /** The stage region's, which owns the full-screen state (REGION-12). */
    isFullscreen: () => boolean;
    onFullscreen: () => void;
    onSnapshot: () => void;
  } = $props();

  const app = getApp();
  const world = $derived(app.world);
  const status = $derived(app.session.state.status);

  // The preference is a plain store: the masthead's switch follows this copy of it.
  let singleKeys = $state(app.keyPreference.enabled);
  let settingsOpen = $state(false);

  let shortcutsOpen = $state(false);
  let shortcutsInstant = $state(false);
  let provenanceOpen = $state(false);
  let provenanceInstant = $state(false);

  /** The colophon's Provenance button, and the phone menu's item. */
  export function openProvenance(event: MouseEvent) {
    provenanceInstant = isKeyboardActivation(event);
    provenanceOpen = true;
  }

  // The skip link: the model's canvas, else the stage, which takes focus when no canvas can (header.js:167-170).
  function skipToModel() {
    const canvas = world?.engine.canvas;
    canvas?.focus({ focusVisible: true });
    if (canvas && document.activeElement === canvas) return;
    document.getElementById('viewport')!.focus();
  }

  let masthead = $state<Masthead>();
  // The ⋯ button takes focus back when the menu item that opened a dialog is gone.
  const settingsButton = () => masthead!.settingsButton();

  // The key that opens the shortcuts sheet (ports.ts).
  $effect(() =>
    app.registerPorts({
      toggleShortcuts({ instant }) {
        shortcutsInstant = instant;
        shortcutsOpen = !shortcutsOpen;
      },
      shortcutsOpen: () => shortcutsOpen,
    }),
  );

  /** The tract reference alone: another subject, named by the catalog, with the tracts panel's own links. */
  function reference(referenceAnatomy: string) {
    const catalog = tractCatalog(referenceAnatomy);
    const text = t(lang, 'diffusion');
    const links: ProvenanceLink[] = [
      { href: new URL(catalog.source, location.href).href, text: text.source },
      {
        href: new URL(`${ASSET_BASE}diffusion/${catalog.brain_outline.provenance}`, location.href)
          .href,
        text: text.outlineProvenance,
      },
    ];
    return { label: catalog.name[lang], description: text.outlineLimit, links };
  }
</script>

<Masthead
  bind:this={masthead}
  {lang}
  themeChoice={app.theme.choice}
  {singleKeys}
  ready={status === 'ready' || status === 'switching'}
  fullscreen={isFullscreen()}
  provenanceReady={world !== null}
  settingsDisabled={app.failure !== undefined}
  bind:settingsOpen
  onSkipToModel={skipToModel}
  onLanguage={app.chooseLanguage}
  onTheme={app.theme.choose}
  onSingleKeys={(on) => {
    app.keyPreference.set(on);
    singleKeys = on;
  }}
  {onFullscreen}
  {onSnapshot}
  onProvenance={openProvenance}
  onShortcuts={(event) => {
    shortcutsInstant = isKeyboardActivation(event);
    shortcutsOpen = true;
  }}
>
  {#snippet data()}
    {#if world}
      {@const current = world.view.current}
      {@const { model } = world.engine}
      {@const tractReference = isIndependentTractReference(current)}
      <!-- TODO(I3a): `anatomies` is world.anatomies, the published index (#4 issuecomment-6429895842 item 1). Until then no Subject field is offered and `onAnatomy` is unreachable. -->
      <DataBar
        lang={current.lang}
        status={current.status}
        progress={current.progress}
        atlas={current.atlas}
        surfaceColor={tractReference ? 'tissue' : current.surfaceColor}
        detail={current.detail}
        paint={current.paint}
        atlases={model.manifest.atlases.map(({ id }) => id)}
        detailLevels={model.manifest.detail_levels.map(({ id }) => id)}
        colourings={{
          networks: model.manifest.networks,
          cabNp: model.cabNp,
          territories: model.manifest.arterial_territories,
        }}
        anatomy={model.manifest.anatomy}
        anatomies={[model.manifest.anatomy]}
        reference={tractReference ? reference(current.referenceAnatomy) : null}
        bind:settingsOpen
        bind:choosing
        onAtlas={world.excursions.chooseAtlas}
        onSurfaceColor={world.excursions.chooseSurfaceColor}
        onDetail={world.commands.chooseDetail}
        onAnatomy={world.links.switchAnatomy}
      />
    {/if}
  {/snippet}
</Masthead>

<ShortcutsDialog
  bind:open={shortcutsOpen}
  bind:instant={shortcutsInstant}
  {lang}
  {singleKeys}
  fallbackFocus={settingsButton}
/>
{#if world}
  {@const { model } = world.engine}
  {@const current = world.view.current}
  {@const tractReference = isIndependentTractReference(current)}
  <ProvenanceDialog
    bind:open={provenanceOpen}
    bind:instant={provenanceInstant}
    lang={current.lang}
    manifest={model.manifest}
    manifestUrl="{ASSET_BASE}models/{model.manifest.anatomy.id}/manifest.json"
    indexUrl="{ASSET_BASE}models/anatomies.json"
    domains={model.domains}
    reference={tractReference ? reference(current.referenceAnatomy) : null}
    fallbackFocus={settingsButton}
  />
{/if}
