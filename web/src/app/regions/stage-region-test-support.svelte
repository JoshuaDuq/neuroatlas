<!-- Fixture for the stage region tests: the region with a snippet standing in for I3b's stage status. Not shipped. -->
<script lang="ts">
  import StageRegion from './StageRegion.svelte';

  let { region = $bindable() }: { region?: StageRegion } = $props();
</script>

<StageRegion bind:this={region}>
  <p id="stage-status-slot">status</p>
</StageRegion>
