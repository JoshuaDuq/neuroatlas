<script lang="ts">
  import { tractCatalog } from '../../lib/core/diffusion/catalogs.ts';
  import { isIndependentTractReference } from '../../lib/core/diffusion/presentation.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import type { Language } from '../../lib/types/index.ts';
  import Colophon from '../../features/colophon/Colophon.svelte';
  import { regionCountText } from '../../features/colophon/region-count.ts';
  import { getApp } from '../application.svelte.ts';

  let {
    lang,
    choosing,
    onProvenance,
  }: {
    lang: Language;
    /** A data bar field holds a choice still downloading (the masthead region's). */
    choosing: boolean;
    /** The masthead region's `openProvenance`, which owns the dialog. */
    onProvenance: () => void;
  } = $props();

  const world = $derived(getApp().world);
</script>

{#if world}
  {@const current = world.view.current}
  {@const tractReference = isIndependentTractReference(current)}
  {@const tracts = current.explorer === 'diffusion'}
  <Colophon
    lang={current.lang}
    anatomy={world.engine.model.manifest.anatomy}
    reference={tractReference
      ? { label: tractCatalog(current.referenceAnatomy).name[current.lang] }
      : undefined}
    regionCount={regionCountText(current.lang, {
      tracts: tracts
        ? t(current.lang, 'diffusion').bundleCollection(
            tractCatalog(current.referenceAnatomy).bundles.length,
          )
        : null,
      status: current.status,
      progress: current.progress,
      visibleCount: world.catalog.visibleCount,
      choosing,
    })}
    onprovenance={onProvenance}
  />
{:else}
  <!-- Before the engine the bar states what this is and nothing about what is loaded. -->
  <Colophon {lang} regionCount="" />
{/if}
