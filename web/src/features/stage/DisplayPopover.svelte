<!--
  The Display popover's body (index.html:473-489, ui/chrome/display.js): how much of the model is drawn.
  - Hemisphere is a radio group (decision 6): arrows move and select. Choosing the side already shown does
    nothing, so a second click never refits the camera and throws away the orbit.
  - The cortex opacity row is removed, not greyed, while the cortex is hidden; its slider does not take the
    value back while the reader holds the thumb (U4 `RangeField`). The spoken value is the percentage.
  - The spinal cord is absent, not disabled, when the subject publishes none (the S key says why).
  Every change goes through the controller's commands, which say so when a hidden selection was cleared.
-->
<script lang="ts">
  import { t } from '../../lib/core/i18n/index.ts';
  import { percent } from '../../lib/core/format.ts';
  import type { Hemisphere, Language } from '../../lib/types/index.ts';
  import ChoiceGroup from '../../lib/ui/ChoiceGroup.svelte';
  import RangeField from '../../lib/ui/RangeField.svelte';

  interface Props {
    lang: Language;
    hemisphere: Hemisphere;
    cortexVisible: boolean;
    cortexOpacity: number;
    internalVisible: boolean;
    spinalCordVisible: boolean;
    /** The subject publishes a spinal cord. */
    hasSpinalCord: boolean;
    onHemisphere: (hemisphere: Hemisphere) => void;
    onCortexVisible: (visible: boolean) => void;
    onCortexOpacity: (opacity: number) => void;
    onInternalVisible: (visible: boolean) => void;
    onSpinalCordVisible: (visible: boolean) => void;
  }

  let {
    lang,
    hemisphere,
    cortexVisible,
    cortexOpacity,
    internalVisible,
    spinalCordVisible,
    hasSpinalCord,
    onHemisphere,
    onCortexVisible,
    onCortexOpacity,
    onInternalVisible,
    onSpinalCordVisible,
  }: Props = $props();

  const uid = $props.id();
  const hemisphereLabelId = `hemisphere-label-${uid}`;

  const copy = $derived(t(lang, 'display'));
  const sides = $derived(
    (['both', 'left', 'right'] as const).map((value) => ({ value, label: copy[value] })),
  );
</script>

<p id={hemisphereLabelId} class="stage-field-label">{copy.hemisphere}</p>
<ChoiceGroup
  labelledby={hemisphereLabelId}
  class="hemisphere"
  options={sides}
  bind:value={() => hemisphere, onHemisphere}
/>
<div class="visibility">
  <label class="check">
    <input
      type="checkbox"
      checked={cortexVisible}
      onchange={(event) => onCortexVisible(event.currentTarget.checked)}
    />
    <span>{copy.showCortex}</span>
  </label>
  {#if cortexVisible}
    <div class="opacity">
      <RangeField
        label={copy.cortexOpacity}
        value={cortexOpacity}
        min={0}
        max={1}
        step={0.05}
        format={(fraction) => percent(fraction, lang)}
        oninput={onCortexOpacity}
      />
    </div>
  {/if}
  <label class="check">
    <input
      type="checkbox"
      checked={internalVisible}
      onchange={(event) => onInternalVisible(event.currentTarget.checked)}
    />
    <span>{copy.showInternal}</span>
  </label>
  {#if hasSpinalCord}
    <label class="check">
      <input
        type="checkbox"
        checked={spinalCordVisible}
        onchange={(event) => onSpinalCordVisible(event.currentTarget.checked)}
      />
      <span>{copy.showSpinalCord}</span>
    </label>
  {/if}
</div>

<style>
  @layer features {
    :global(.segmented.choice-group.hemisphere) {
      width: 100%;
    }
    :global(.segmented.choice-group.hemisphere [role='radio']) {
      flex: 1;
      height: auto;
      min-height: var(--control-height);
      min-width: 0;
      padding: 0 var(--space-2);
      font-size: var(--text-stage);
      white-space: normal;
      overflow-wrap: anywhere;
    }
    .visibility {
      margin-top: var(--space-3);
      padding-top: var(--space-1);
      border-top: 1px solid var(--overlay-border);
    }
    /* Indented to the checkbox's words: a 16px box and its 8px gap. */
    .opacity {
      padding: 0 0 var(--space-2) var(--space-6);
    }
    .check {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-height: var(--row-height);
      margin: 0;
      font-size: var(--text-ui);
      color: var(--text-primary);
      cursor: pointer;
    }
    .check span {
      min-width: 0;
    }
    input[type='checkbox'] {
      appearance: none;
      display: grid;
      place-content: center;
      flex: none;
      width: 16px;
      height: 16px;
      margin: 0;
      border: 1px solid var(--border-control);
      border-radius: var(--radius-small);
      background: var(--surface-base);
      cursor: pointer;
    }
    input[type='checkbox']::before {
      content: '';
      width: 8px;
      height: 4px;
      border-left: 1.5px solid transparent;
      border-bottom: 1.5px solid transparent;
      transform: rotate(-45deg) translateY(-1px);
    }
    input[type='checkbox']:checked {
      background: var(--accent);
      border-color: var(--accent);
    }
    input[type='checkbox']:checked::before {
      border-color: var(--surface-base);
    }
    @media (pointer: coarse) {
      :global(.segmented.choice-group.hemisphere [role='radio']),
      .check {
        min-height: 44px;
      }
      /* The tick box itself is 20 px, as the legacy touch rule has it (phone.css:329). */
      input[type='checkbox'] {
        width: 20px;
        height: 20px;
      }
    }
  }

  @layer a11y {
    @media (forced-colors: active) {
      /* The tick would be forced to ink on every box, checked or not: the system control draws itself. */
      input[type='checkbox'] {
        appearance: auto;
        background: Canvas;
        border-color: CanvasText;
      }
      input[type='checkbox']::before {
        content: none;
      }
    }
  }
</style>
