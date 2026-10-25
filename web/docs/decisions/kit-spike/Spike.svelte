<!--
  U0 spike fixture: the Bits UI parts the Planum wrappers will use, bare, so
  kit-spike.svelte.test.ts can check them against the APG. Not shipped.
-->
<script lang="ts">
  import { Combobox, Popover, RadioGroup, Tabs, Toolbar, Tooltip } from 'bits-ui';

  let language = $state('en');
  let view = $state('front');
  let tab = $state('anatomy');
  let query = $state('');
  let picked = $state('');
  const regions = ['Amygdala', 'Hippocampus', 'Thalamus'];
  const shown = $derived(regions.filter((r) => r.toLowerCase().includes(query.toLowerCase())));
</script>

<span id="lang-label">Language</span>
<RadioGroup.Root bind:value={language} aria-labelledby="lang-label">
  <RadioGroup.Item value="en" aria-label="English">EN</RadioGroup.Item>
  <RadioGroup.Item value="fr" aria-label="Francais">FR</RadioGroup.Item>
</RadioGroup.Root>

<Toolbar.Root aria-label="View presets">
  {#each ['front', 'left', 'top'] as preset (preset)}
    <Toolbar.Button aria-pressed={view === preset} onclick={() => (view = preset)}>
      {preset}
    </Toolbar.Button>
  {/each}
</Toolbar.Root>

<Tabs.Root bind:value={tab} activationMode="manual">
  <Tabs.List aria-label="Explore the atlas">
    <Tabs.Trigger value="anatomy">Anatomy</Tabs.Trigger>
    <Tabs.Trigger value="functions">Functions</Tabs.Trigger>
    <Tabs.Trigger value="deficits">Deficits</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Content value="anatomy">Anatomy panel</Tabs.Content>
  <Tabs.Content value="functions">Functions panel</Tabs.Content>
  <Tabs.Content value="deficits">Deficits panel</Tabs.Content>
</Tabs.Root>

<Popover.Root>
  <Popover.Trigger>Settings</Popover.Trigger>
  <Popover.Portal>
    <Popover.Content aria-label="Settings">
      <button type="button">Provenance</button>
    </Popover.Content>
  </Popover.Portal>
</Popover.Root>

<Tooltip.Provider delayDuration={500} skipDelayDuration={300}>
  <Tooltip.Root>
    <Tooltip.Trigger>Snapshot</Tooltip.Trigger>
    <Tooltip.Portal>
      <!-- Bits 2.20.2 renders no role on the content; the Planum Tooltip wrapper must add it (APG Tooltip). -->
      <Tooltip.Content role="tooltip">Save a PNG</Tooltip.Content>
    </Tooltip.Portal>
  </Tooltip.Root>
</Tooltip.Provider>

<Combobox.Root
  type="single"
  bind:value={picked}
  items={regions.map((r) => ({ value: r, label: r }))}
>
  <Combobox.Input
    aria-label="Search regions"
    oninput={(event) => (query = event.currentTarget.value)}
  />
  <Combobox.Portal>
    <Combobox.Content>
      {#each shown as region (region)}
        <Combobox.Item value={region} label={region}>{region}</Combobox.Item>
      {/each}
    </Combobox.Content>
  </Combobox.Portal>
</Combobox.Root>
<p id="picked">{picked}</p>
