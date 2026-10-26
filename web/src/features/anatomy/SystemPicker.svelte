<!--
  The picker of one internal system (viewer/ui/panels/internal-anatomy.js:39-55; index.html:252-255):
  a native select beside its visible label. A2 shows it under the scope while the list is of the
  internal anatomy and no search is open, so it does not decide that itself. The select always shows
  the system the display holds: a choice that fails or is overtaken is put back
  (deviations/a3-system-value-sync.md).
-->
<script lang="ts">
  import { tick } from 'svelte';
  import { t } from '../../lib/core/i18n/index.ts';
  import type { Language, Region } from '../../lib/types/index.ts';
  import Select from '../../lib/ui/Select.svelte';
  import { systemOptions } from './system-options.ts';

  interface Props {
    lang: Language;
    /** The detail level the list is of. */
    detail: string;
    /** The manifest's regions. */
    regions: readonly Region[];
    /** Group names two vocabularies use at once, counted over the whole brain (`sharedGroupNames`). */
    shared: ReadonlySet<string>;
    /** The system the display holds; null for all of them. */
    value: string | null;
    /** An atlas or detail level is loading: its systems are about to change. */
    switching: boolean;
    /** A system, or null for all of them, was chosen. A rejection is the caller's to report. */
    onChoose: (system: string | null) => void | Promise<void>;
  }

  let { lang, detail, regions, shared, value, switching, onChoose }: Props = $props();

  const id = $props.id();
  const copy = $derived(t(lang, 'navigator'));
  const options = $derived([
    { value: '', label: copy.allSystems },
    ...systemOptions(regions, detail, lang, shared),
  ]);

  let root: HTMLElement;

  async function choose(system: string) {
    await onChoose(system || null);
    // Whatever the command did, the select ends on the display's own value.
    await tick();
    root.querySelector('select')!.value = value ?? '';
  }
</script>

<div class="system-picker" bind:this={root}>
  <label for={id}>{copy.system}</label>
  <Select {id} {options} value={value ?? ''} disabled={switching} onchange={choose} />
</div>

<style>
  @layer features {
    /* The label beside its field (navigator.css:242-248). */
    .system-picker {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      align-items: center;
      gap: var(--space-3);
    }
    label {
      font-size: var(--text-ui);
      font-weight: 500;
    }
  }
</style>
