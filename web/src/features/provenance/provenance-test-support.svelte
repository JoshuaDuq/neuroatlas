<!-- Fixture for the Provenance tests: the colophon's opener, the dialog and the ⋯ fallback as I3b composes them. Not shipped. -->
<script lang="ts">
  import type { ComponentProps } from 'svelte';
  import { isKeyboardActivation } from '../../lib/ui/instant.ts';
  import Colophon from '../colophon/Colophon.svelte';
  import ProvenanceDialog from './ProvenanceDialog.svelte';

  let {
    lang,
    ...dialog
  }: Omit<ComponentProps<typeof ProvenanceDialog>, 'open' | 'instant' | 'fallbackFocus'> = $props();

  let open = $state(false);
  let instant = $state(false);
  let more: HTMLButtonElement;
</script>

<Colophon
  {lang}
  regionCount="12 visible regions"
  anatomy={{ display_name: '“Bert”', individual: true }}
  onprovenance={(event) => {
    instant = isKeyboardActivation(event);
    open = true;
  }}
/>
<button type="button" bind:this={more}>More</button>
<ProvenanceDialog bind:open bind:instant {lang} fallbackFocus={() => more} {...dialog} />
