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

  // The colophon's button and the settings menu's commands run without the click: the dialog they open reads it here.
  let keyboardClick = false;

  /** The colophon's Provenance button, and the phone menu's item. */
  export function openProvenance() {
    provenanceInstant = keyboardClick;
    provenanceOpen = true;
  }

  // The skip link: the model's canvas, else the stage, which takes focus when no canvas can (header.js:167-170).
  function skipToModel() {
    const canvas = world?.engine.canvas;
    canvas?.focus({ focusVisible: true });
    if (canvas && document.activeElement === canvas) return;
    document.getElementById('viewport')!.focus();
  }

  // The ⋯ button takes focus back when the menu item that opened a dialog is gone.
  const settingsButton = () =>
    document.querySelector<HTMLElement>(`#masthead [aria-label="${t(lang, 'menu').more}"]`);

  // The data bar's choice is told to the status bar until the download settles.
  $effect.pre(() => {
    if (choosing && status !== 'switching') choosing = false;
  });
  const choose =
    <A extends unknown[]>(command: (...args: A) => unknown) =>
    (...args: A) => {
      choosing = true;
      return command(...args);
    };

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

<svelte:document onclickcapture={(event) => (keyboardClick = isKeyboardActivation(event))} />

<Masthead
  {lang}
  themeChoice={app.theme.choice}
  {singleKeys}
  ready={status === 'ready' || status === 'switching'}
  fullscreen={isFullscreen()}
  provenanceReady={world !== null}
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
  onShortcuts={() => {
    shortcutsInstant = keyboardClick;
    shortcutsOpen = true;
  }}
>
  {#snippet data()}
    {#if world}
      {@const current = world.view.current}
      {@const { model } = world.engine}
      {@const tractReference = isIndependentTractReference(current)}
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
          functionalRegions: model.functionalRegions,
        }}
        anatomy={model.manifest.anatomy}
        anatomies={[model.manifest.anatomy]}
        reference={tractReference ? reference(current.referenceAnatomy) : null}
        bind:settingsOpen
        onAtlas={choose(world.excursions.chooseAtlas)}
        onSurfaceColor={choose(world.excursions.chooseSurfaceColor)}
        onDetail={choose(world.commands.chooseDetail)}
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
