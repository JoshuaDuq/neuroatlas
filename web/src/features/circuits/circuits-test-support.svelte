<!-- Fixture for the Circuits tests: the pieces as I1 composes them in the panel's `<aside>` (own keys, decision 7), with the live region the panel announces through. Not shipped. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { attachAnnouncer } from '../../lib/ui/announcer.svelte.ts';
  import CircuitList from './CircuitList.svelte';
  import CircuitNotes from './CircuitNotes.svelte';
  import CircuitProfile from './CircuitProfile.svelte';
  import CircuitStatus from './CircuitStatus.svelte';
  import CircuitStepper from './CircuitStepper.svelte';
  import RelatedCircuits from './RelatedCircuits.svelte';
  import type { World } from './circuits-test-world.ts';

  let { world }: { world: World } = $props();

  let announcer: HTMLElement;
  onMount(() => attachAnnouncer(announcer));
  const model = $derived(world.explorer);
</script>

<div
  bind:this={announcer}
  role="status"
  aria-live="polite"
  class="visually-hidden"
  id="announcer"
></div>
<aside aria-label="Panels" data-own-keys>
  <div class="bar"><CircuitStepper {model} /></div>
  <CircuitList {model} />
  <div class="detail">
    <CircuitProfile {model} />
    <CircuitStatus {model} />
    <!-- Stands for RegionDetail, which reads the same flag. -->
    <div class="region" data-landmark-selected={model.landmarkSelected}>
      <h2 tabindex="-1">{model.selectedRegion?.id ?? 'No region'}</h2>
    </div>
    <CircuitNotes {model} />
    <RelatedCircuits {model} />
  </div>
</aside>

<style>
  @layer features {
    .bar {
      display: flex;
      height: var(--tab-height);
    }
  }
</style>
