<!--
  The Section popover's body (index.html:455-469, ui/chrome/sections.js:56-64, 171-194, 418-428, 483-489):
  the cutting plane and the labels a cut samples. G2's StagePopover is the frame.
  - The planes are U3's toolbar of `aria-pressed` toggles (decision 6): a cut is an expensive choice, so
    the arrows only move. Pressing one chooses it, closes the popover and returns focus to the Section
    tool; it reads as pressed at once, while its anatomy is still being prepared.
  - On a phone the five planes share one row: the icon over the short name, the full name as the
    accessible name. Elsewhere the icon beside the full name, in two columns under Full brain.
  - Cut labels is a native select. A choice that fails leaves the select on the labels still cut.
-->
<script lang="ts">
  import { atlasSwitchLabel, t } from '../../lib/core/i18n/index.ts';
  import { CUTS } from '../../lib/types/index.ts';
  import type { Language } from '../../lib/types/index.ts';
  import Select from '../../lib/ui/Select.svelte';
  import ToggleToolbar from '../../lib/ui/ToggleToolbar.svelte';
  import type { SectionControls } from './section-controls.svelte.ts';

  interface Props {
    controls: SectionControls;
    lang: Language;
    /** The phone layout: short names under the icons. */
    phone: boolean;
    /** Closes the popover and returns focus to the Section tool. */
    close: () => void;
  }

  let { controls, lang, phone, close }: Props = $props();

  const uid = $props.id();
  const captionId = `cut-mode-label-${uid}`;
  const atlasId = `cut-atlas-${uid}`;

  const copy = $derived(t(lang, 'cuts'));
  const planes = $derived(
    CUTS.map((plane) => ({
      value: plane,
      icon: `cut-${plane}` as const,
      label: phone ? copy.modesShort[plane] : copy.modes[plane],
      name: phone ? copy.modes[plane] : undefined,
    })),
  );
  const atlases = $derived(
    controls.cutAtlases.map(({ id }) => {
      const label = atlasSwitchLabel(id, lang);
      const full: Record<string, string | undefined> = t(lang, 'atlases');
      return { value: id, label, title: full[id] ?? label };
    }),
  );

  // Follows the labels the sections cut; a choice shows at once and gives way to the next snapshot.
  let cutAtlas = $derived(controls.state.cutAtlas);
</script>

<p id={captionId} class="stage-field-label">{copy.cuttingPlane}</p>
<ToggleToolbar
  labelledby={captionId}
  class="cut-mode"
  items={planes}
  pressed={controls.plane}
  onpress={(plane) => {
    void controls.choose(plane);
    close();
  }}
/>
<div class="stage-field">
  <label class="stage-field-label" for={atlasId}>{copy.cutLabels}</label>
  <Select
    id={atlasId}
    options={atlases}
    bind:value={() => cutAtlas, (id) => (cutAtlas = id)}
    onchange={(id) =>
      controls.setCutAtlas(id).then(() => {
        cutAtlas = controls.state.cutAtlas;
      })}
  />
</div>

<style>
  @layer features {
    /* Full brain across the top, then one pair of planes per row (stage.css:448-459). */
    :global(.toggle-toolbar.cut-mode) {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    :global(.toggle-toolbar.cut-mode button) {
      height: auto;
      min-height: var(--control-height);
      min-width: 0;
      justify-content: flex-start;
      padding: 0 var(--space-3);
      font-size: var(--text-stage);
      /* At 200 % text a name wraps inside its cell instead of crossing into the next. */
      white-space: normal;
      overflow-wrap: anywhere;
      text-align: left;
    }
    :global(.toggle-toolbar.cut-mode button:first-child) {
      grid-column: 1 / -1;
    }
    /* The phone's single row: the icon over the short name, each a full 44 px target (stage.css:681-685). */
    @media (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      :global(.toggle-toolbar.cut-mode) {
        grid-template-columns: repeat(5, minmax(0, 1fr));
      }
      :global(.toggle-toolbar.cut-mode button:first-child) {
        grid-column: auto;
      }
      :global(.toggle-toolbar.cut-mode button) {
        flex-direction: column;
        justify-content: center;
        gap: 2px;
        min-height: 44px;
        padding: 0 var(--space-1);
        font-size: var(--text-caption);
        line-height: var(--lh-caption);
        text-align: center;
      }
    }
    @media (pointer: coarse) {
      :global(.toggle-toolbar.cut-mode button) {
        min-height: 44px;
      }
    }
  }
</style>
