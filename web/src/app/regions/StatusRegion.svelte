<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children }: { children?: Snippet } = $props();
</script>

<!-- A slot with no element of its own: H4's colophon renders the contentinfo landmark, `<footer id="colophon">`. -->
{@render children?.()}
