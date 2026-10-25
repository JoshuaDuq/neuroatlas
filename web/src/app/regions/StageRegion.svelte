<script lang="ts">
  /** The landmark itself, for the skip link's fallback focus. */
  let { element = $bindable() }: { element?: HTMLElement } = $props();
</script>

<!-- The main landmark. tabindex -1 lets "Skip to model" land here when no canvas can take focus. I2 fills it. -->
<main id="viewport" tabindex="-1" bind:this={element}></main>
