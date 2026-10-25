<!--
  A labelled native range, optionally paired with an exact-value number field (cut position,
  tract opacity and minimum length, MRI window). APG Slider, built on the native element:
  arrows step, PageUp/PageDown take the larger step, Home/End jump, and the platform supplies
  the roles and `aria-valuenow`. `aria-valuetext` is the formatted value, in the reader's
  notation (decimal comma and U+2212 minus come from `format`).

  - `oninput` fires while the thumb moves; `onchange` when the value is committed. The readout
    follows the thumb either way, so a caller applies on whichever suits it.
  - `value` is not copied into a control that has focus (the reader is moving it); the control
    catches up on blur.
  - The number field commits on change. An empty field restores the value; a value outside
    min..max is not applied, and `rangeMessage` is shown with the field marked invalid
    (WCAG 3.3.1 Error Identification).
-->
<script lang="ts">
  import { untrack } from 'svelte';

  let {
    label,
    value,
    min,
    max,
    step = 1,
    format,
    numberLabel,
    rangeMessage,
    disabled = false,
    oninput,
    onchange,
  }: {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    /** The value as text in the reader's language: the readout and `aria-valuetext`. */
    format: (value: number) => string;
    /** Names the number field; without it there is none. */
    numberLabel?: string;
    /** Said under the number field when its value is outside min..max. */
    rangeMessage?: string;
    disabled?: boolean;
    oninput?: (value: number) => void;
    onchange?: (value: number) => void;
  } = $props();

  const id = $props.id();
  const digits = $derived((String(step).split('.')[1] ?? '').length);

  let draft = $state(0);
  let rangeFocused = $state(false);
  let numberFocused = $state(false);
  let numberText = $state('');
  let invalid = $state(false);

  $effect.pre(() => {
    const next = value;
    if (!untrack(() => rangeFocused)) draft = next;
    if (!untrack(() => numberFocused)) {
      numberText = next.toFixed(digits);
      invalid = false;
    }
  });

  function commitNumber(event: Event & { currentTarget: HTMLInputElement }) {
    const field = event.currentTarget;
    if (field.value === '') {
      numberText = draft.toFixed(digits);
      invalid = false;
      return;
    }
    const typed = Number(field.value);
    if (!Number.isFinite(typed) || typed < min || typed > max) {
      invalid = true;
      return;
    }
    invalid = false;
    draft = typed;
    onchange?.(typed);
  }
</script>

<div class="control-field">
  <div class="head">
    <label for="{id}-range">{label}</label>
    <output class="readout" for="{id}-range" aria-hidden="true">{format(draft)}</output>
  </div>
  <div class="inputs">
    <input
      id="{id}-range"
      type="range"
      {min}
      {max}
      {step}
      {disabled}
      value={draft}
      aria-valuetext={format(draft)}
      onfocus={() => (rangeFocused = true)}
      onblur={() => {
        rangeFocused = false;
        draft = value;
      }}
      oninput={(event) => {
        draft = event.currentTarget.valueAsNumber;
        numberText = draft.toFixed(digits);
        invalid = false;
        oninput?.(draft);
      }}
      onchange={(event) => onchange?.(event.currentTarget.valueAsNumber)}
    />
    {#if numberLabel}
      <input
        class="number"
        type="number"
        {min}
        {max}
        {step}
        {disabled}
        aria-label={numberLabel}
        aria-invalid={invalid}
        aria-describedby={invalid ? `${id}-error` : undefined}
        bind:value={numberText}
        onfocus={() => (numberFocused = true)}
        onblur={() => {
          numberFocused = false;
          if (!invalid) numberText = draft.toFixed(digits);
        }}
        onchange={commitNumber}
      />
    {/if}
  </div>
  {#if numberLabel && invalid && rangeMessage}
    <p class="error" id="{id}-error">{rangeMessage}</p>
  {/if}
</div>

<style>
  @layer components {
    .control-field {
      display: grid;
      gap: var(--space-2);
    }
    .head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-3);
    }
    label {
      display: block;
      font-size: var(--text-ui);
      font-weight: 500;
      color: var(--text-secondary);
    }
    .readout {
      flex: none;
      font-weight: 400;
      color: var(--text-tertiary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      font-variant-numeric: tabular-nums;
    }
    .inputs {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }
    input[type='range'] {
      appearance: none;
      flex: 1;
      min-width: 0;
      width: 100%;
      height: 20px;
      margin: var(--space-1) 0;
      padding: 0;
      background: transparent;
      accent-color: var(--accent);
      cursor: pointer;
    }
    input[type='range']::-webkit-slider-runnable-track {
      height: 2px;
      background: var(--border-control);
      border-radius: 1px;
    }
    input[type='range']::-moz-range-track {
      height: 2px;
      background: var(--border-control);
      border-radius: 1px;
    }
    input[type='range']:disabled {
      opacity: 1;
      cursor: default;
    }
    input[type='range']::-webkit-slider-thumb {
      appearance: none;
      width: 14px;
      height: 14px;
      margin-top: -6px;
      background: var(--surface-base);
      border: 2px solid var(--accent);
      border-radius: 50%;
    }
    input[type='range']::-moz-range-thumb {
      width: 10px;
      height: 10px;
      background: var(--surface-base);
      border: 2px solid var(--accent);
      border-radius: 50%;
    }
    input[type='range']:disabled::-webkit-slider-runnable-track {
      background: var(--border-subtle);
    }
    input[type='range']:disabled::-moz-range-track {
      background: var(--border-subtle);
    }
    input[type='range']:disabled::-webkit-slider-thumb {
      border-color: var(--border-control);
    }
    input[type='range']:disabled::-moz-range-thumb {
      border-color: var(--border-control);
    }
    .number {
      appearance: textfield;
      flex: none;
      width: 5.5rem;
      height: var(--control-height);
      padding: 0 var(--space-3);
      border: 1px solid var(--border-control);
      border-radius: var(--radius-control);
      background-color: var(--surface-base);
      box-shadow: none;
      font-size: var(--text-ui);
      font-variant-numeric: tabular-nums;
    }
    .number::-webkit-inner-spin-button,
    .number::-webkit-outer-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    .number:disabled {
      color: var(--text-tertiary);
      cursor: default;
      border-color: var(--border-subtle);
      background-color: var(--surface-sunken);
    }
    .number[aria-invalid='true'] {
      border-color: var(--danger, currentColor);
    }
    .error {
      margin: 0;
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      color: var(--danger, var(--text-primary));
    }
    @media (pointer: coarse) {
      input[type='range'] {
        height: 44px;
        margin: 0;
      }
      input[type='range']::-webkit-slider-thumb {
        width: 20px;
        height: 20px;
        margin-top: -9px;
      }
      input[type='range']::-moz-range-thumb {
        width: 20px;
        height: 20px;
      }
    }
    @media (hover: hover) and (pointer: fine) {
      .number:hover:not(:disabled) {
        border-color: var(--text-secondary);
      }
    }
  }
  @layer a11y {
    @media (forced-colors: active) {
      .number:focus-visible {
        outline: 2px solid Highlight;
      }
      /* A transparent track is forced to nothing; the track and thumb keep system colours of their own. */
      input[type='range'] {
        forced-color-adjust: none;
      }
      input[type='range']::-webkit-slider-runnable-track {
        background: CanvasText;
      }
      input[type='range']::-moz-range-track {
        background: CanvasText;
      }
      input[type='range']::-webkit-slider-thumb {
        background: Canvas;
        border-color: CanvasText;
      }
      input[type='range']::-moz-range-thumb {
        background: Canvas;
        border-color: CanvasText;
      }
      input[type='range']:disabled::-webkit-slider-runnable-track {
        background: GrayText;
      }
      input[type='range']:disabled::-moz-range-track {
        background: GrayText;
      }
      input[type='range']:disabled::-webkit-slider-thumb {
        border-color: GrayText;
      }
      input[type='range']:disabled::-moz-range-thumb {
        border-color: GrayText;
      }
      /* The thumb keeps a system outline when focused, as forced colours drop the page's ring. */
      input[type='range']:focus-visible {
        outline: 2px solid Highlight;
      }
    }
  }
</style>
