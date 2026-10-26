<!--
  Fixture for the system picker tests: the display's one internal system, which the command either
  takes or does not (a failed spinal cord load, a command overtaken by a later one). Not shipped.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import type { Language, Region } from '../../lib/types/index.ts';
  import SystemPicker from './SystemPicker.svelte';

  let {
    calls = [],
    lang = 'en',
    detail = 'aseg',
    regions,
    shared = new Set<string>(),
    value: initial = null,
    switching = false,
    accepts = true,
  }: {
    calls?: string[];
    lang?: Language;
    detail?: string;
    regions: readonly Region[];
    shared?: ReadonlySet<string>;
    value?: string | null;
    switching?: boolean;
    /** The command changes the display; false when it fails or is overtaken. */
    accepts?: boolean;
  } = $props();

  let value = $state(untrack(() => initial));
</script>

<SystemPicker
  {lang}
  {detail}
  {regions}
  {shared}
  {value}
  {switching}
  onChoose={(system) => {
    calls.push(String(system));
    if (accepts) value = system;
  }}
/>
<button id="set-limbic" onclick={() => (value = 'Limbic')}>display shows Limbic</button>

<style>
  @layer components {
    button {
      display: block;
      min-height: 44px;
      margin-top: 8px;
      background: none;
      border: 0;
      color: var(--text-primary);
    }
  }
</style>
