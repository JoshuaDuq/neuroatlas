<!-- Fixture for the atlas comparison tests: the real CDMD manifest inside the inspector's own scope, as R1's slot mounts it. Not shipped. -->
<script lang="ts">
  import manifest from '../../../../public/models/cdmd/manifest.json';
  import functionalFile from '../../../../public/models/cdmd/functional-regions.json';
  import type { FunctionalRegions } from '../../lib/core/catalog/functional-regions.ts';
  import type { ComparisonManifest } from '../../lib/core/comparison/catalog.ts';
  import type { Engine } from '../../lib/engine/api.ts';
  import type { Language, Region } from '../../lib/types/index.ts';
  import AtlasComparison from './AtlasComparison.svelte';
  import './inspector.css';

  let {
    engine,
    regionId = null,
    lang = 'en',
    outlineAvailable = true,
    declared = true,
    pairs = false,
  }: {
    engine: Pick<Engine, 'comparison'>;
    regionId?: string | null;
    lang?: Language;
    outlineAvailable?: boolean;
    /** The manifest declares an atlas comparison. */
    declared?: boolean;
    /** It declares all three pairs, as published, not only the first. */
    pairs?: boolean;
  } = $props();

  const regions = manifest.regions as unknown as Region[];
  const published = $derived({
    regions,
    anatomy: manifest.anatomy,
    atlases: manifest.atlases,
    ...(declared && { atlas_comparison: manifest.atlas_comparison }),
    ...(pairs && { atlas_comparisons: manifest.atlas_comparisons }),
  } as unknown as ComparisonManifest);
  const region = $derived(
    regionId ? (regions.find((entry) => entry.id === regionId) ?? null) : null,
  );
</script>

<div class="region-detail">
  <AtlasComparison
    {engine}
    manifest={published}
    manifestUrl="https://example.invalid/models/cdmd/manifest.json"
    {region}
    {lang}
    {outlineAvailable}
    functionalRegions={functionalFile as unknown as FunctionalRegions}
  />
</div>
