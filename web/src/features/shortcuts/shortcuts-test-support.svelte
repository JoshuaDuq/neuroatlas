<!-- Fixture for the shortcuts tests: an opener, the dialog and the ⋯ fallback as I3b composes them. Not shipped. -->
<script lang="ts">
  import type { Language } from '../../lib/types/index.ts';
  import { SHORTCUT_KEYS } from '../../lib/controller/keymap.ts';
  import { isKeyboardActivation } from '../../lib/ui/instant.ts';
  import ShortcutsDialog from './ShortcutsDialog.svelte';

  let {
    lang,
    singleKeys = true,
    withOpener = true,
  }: { lang: Language; singleKeys?: boolean; withOpener?: boolean } = $props();

  let open = $state(false);
  let instant = $state(false);
  let more: HTMLButtonElement;

  // `?` as the page keymap sends it: an instant toggle (keymap.ts, `shortcuts`).
  function onkeydown(event: KeyboardEvent) {
    if (event.key !== SHORTCUT_KEYS.shortcuts) return;
    event.preventDefault();
    instant = true;
    open = !open;
  }
</script>

<svelte:window {onkeydown} />
{#if withOpener}
  <button
    type="button"
    class="opener"
    onclick={(event) => {
      instant = isKeyboardActivation(event);
      open = true;
    }}>Keyboard shortcuts</button
  >
{/if}
<button type="button" bind:this={more}>More</button>
<ShortcutsDialog bind:open bind:instant {lang} {singleKeys} fallbackFocus={() => more} />
