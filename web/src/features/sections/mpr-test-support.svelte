<!-- Fixture for the Linked MRI dialog tests: an opener that loads the scan then shows the dialog (S3's openLinkedMri), and a fallback stop. Not shipped. -->
<script lang="ts">
  import type { FakeEngine } from '../../lib/engine/fake.ts';
  import type { EngineSync } from '../../lib/state/engine-sync.svelte.ts';
  import type { Language, ManifestAnatomy } from '../../lib/types/index.ts';
  import '../../styles/index.css';
  import { isKeyboardActivation } from '../../lib/ui/instant.ts';
  import MprDialog from './MprDialog.svelte';
  import type { MprDialogController } from './mpr-dialog.svelte.ts';

  let {
    engine,
    engineState,
    mpr,
    live,
    anatomy,
    agreementName = null,
  }: {
    engine: FakeEngine;
    engineState: EngineSync;
    mpr: MprDialogController;
    /** Reactive, so a test can change the language. */
    live: { lang: Language };
    anatomy: Pick<ManifestAnatomy, 'subject' | 'individual'>;
    agreementName?: string | null;
  } = $props();

  let more: HTMLButtonElement;
</script>

<button
  type="button"
  onclick={async (event) => {
    const instant = isKeyboardActivation(event);
    await engine.sections.load();
    mpr.show({ instant });
  }}>Linked MRI</button
>
<button type="button" bind:this={more}>More</button>
<MprDialog
  {mpr}
  {engine}
  {engineState}
  lang={live.lang}
  {anatomy}
  {agreementName}
  fallbackFocus={() => more}
/>
