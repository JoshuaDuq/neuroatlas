<!-- Fixture for the MRI navigator tests: the explorer's opener and the ⋯ fallback as the integration composes them. Not shipped. -->
<script lang="ts">
  import type { Engine, Vec3 } from '../../lib/engine/api.ts';
  import type { Language } from '../../lib/types/index.ts';
  import { isKeyboardActivation } from '../../lib/ui/instant.ts';
  import MriNavigator from './MriNavigator.svelte';

  let {
    engine,
    lang,
    singleKeys = true,
    minimum = 40,
    getPoint = () => null,
    onPoint = () => {},
  }: {
    engine: Pick<Engine, 'tracts'>;
    lang: Language;
    singleKeys?: boolean;
    minimum?: number;
    getPoint?: () => Vec3 | null;
    onPoint?: (point: Vec3) => void;
  } = $props();

  let open = $state(false);
  let instant = $state(false);
  let more: HTMLButtonElement;
</script>

<button
  type="button"
  onclick={(event) => {
    instant = isKeyboardActivation(event);
    open = true;
  }}>MRI with tracts</button
>
<button type="button" bind:this={more}>More</button>
<MriNavigator
  bind:open
  bind:instant
  {engine}
  anatomy="cdmd"
  {lang}
  {minimum}
  {singleKeys}
  {getPoint}
  {onPoint}
  fallbackFocus={() => more}
/>
