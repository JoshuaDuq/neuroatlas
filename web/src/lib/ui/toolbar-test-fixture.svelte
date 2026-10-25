<!-- A consumer of Toolbar/toolbarButton for Toolbar.svelte.test.ts. Not shipped. -->
<script lang="ts">
  import Toolbar, { toolbarButton } from './Toolbar.svelte';

  let { onpress }: { onpress: (name: string) => void } = $props();
  let held = $state(false);
</script>

<Toolbar label="Tools">
  {#snippet children()}
    {@render toolbarButton({ onclick: () => onpress('snapshot'), children: snapshot })}
    {@render toolbarButton({
      onclick: () => (held = !held),
      pressed: held,
      children: key,
    })}
    {@render toolbarButton({ disabled: true, children: off })}
    {@render toolbarButton({ onclick: () => onpress('more'), label: 'More', children: dots })}
  {/snippet}
</Toolbar>

{#snippet snapshot()}Snapshot{/snippet}
{#snippet key()}Key{/snippet}
{#snippet off()}Disabled tool{/snippet}
{#snippet dots()}…{/snippet}
