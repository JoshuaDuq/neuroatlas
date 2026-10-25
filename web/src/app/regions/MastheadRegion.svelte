<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children }: { children?: Snippet } = $props();
</script>

<!-- A slot with no element of its own: H2's masthead renders the banner landmark, `<header id="masthead">`. -->
{@render children?.()}
