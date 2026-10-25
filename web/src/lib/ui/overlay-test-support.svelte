<!-- Fixture for the overlay tests: the three wrappers as a feature would use them. Not shipped. -->
<script lang="ts">
  import Dialog from './Dialog.svelte';
  import Popover from './Popover.svelte';
  import Tooltip from './Tooltip.svelte';
  import { isKeyboardActivation } from './instant.ts';

  let { isolateKeys = false }: { isolateKeys?: boolean } = $props();

  let dialogOpen = $state(false);
  let dialogInstant = $state(false);
  let settingsOpen = $state(false);
  let dataOpen = $state(false);
  let picked = $state('');
  let fallback: HTMLButtonElement;
</script>

<Tooltip />

<button type="button" data-tooltip="Save a PNG">Snapshot</button>
<button type="button" data-tooltip="Enter full screen">Fullscreen</button>

<Popover bind:open={settingsOpen} label="Settings">
  {#snippet trigger({ props })}
    <button {...props} type="button">Settings</button>
  {/snippet}
  {#snippet children({ close })}
    <button type="button" aria-pressed="false">Dark</button>
    <button type="button" aria-pressed="true">Light</button>
    <button type="button" onclick={() => ((picked = 'provenance'), close())}>Provenance</button>
  {/snippet}
</Popover>

<Popover bind:open={dataOpen} label="Data summary">
  {#snippet trigger({ props })}
    <button {...props} type="button">Data</button>
  {/snippet}
  {#snippet children()}
    <button type="button">Subject</button>
  {/snippet}
</Popover>

<button type="button">After popovers</button>
<button type="button" onclick={() => (dataOpen = true)}>Open data</button>

<button
  type="button"
  onclick={(event) => {
    dialogInstant = isKeyboardActivation(event);
    dialogOpen = true;
  }}>Shortcuts</button
>
<button type="button" bind:this={fallback}>Fallback</button>
<Dialog
  bind:open={dialogOpen}
  bind:instant={dialogInstant}
  {isolateKeys}
  closeLabel="Close"
  fallbackFocus={() => fallback}
>
  {#snippet heading(id)}<h2 {id}>Keyboard shortcuts</h2>{/snippet}
  <p>Press ? to open.</p>
  <button type="button">Inside</button>
  <button type="button" data-tooltip="Explains this control">Hint</button>
</Dialog>

<p id="picked">{picked}</p>

<style>
  @layer components {
    button {
      min-width: 44px;
      min-height: 32px;
      margin: var(--space-2);
      display: inline-block;
      border: 1px solid var(--border-control);
      background: var(--surface-tonal);
      color: var(--text-primary);
    }
  }
</style>
