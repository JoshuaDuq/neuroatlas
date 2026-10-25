<!--
  A status line (clinical.js:334, functions.js:305): role=status, a polite live region. Svelte writes
  its text node only when the text changed, so an identical sentence is never rewritten and never
  spoken twice.
-->
<script lang="ts">
  let { text, class: className = '' }: { text: string; class?: string } = $props();
</script>

<p role="status" class={className}>{text}</p>
