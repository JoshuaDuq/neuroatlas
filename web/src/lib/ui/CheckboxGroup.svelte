<!--
  A group of native checkboxes in a <fieldset> whose <legend> names the group (APG Checkbox,
  W3C Grouping Controls). Each box is a real input, so Space toggles it and Tab walks the boxes.
  A checked box that the current view has turned off (`disabled`) still reads as on.
-->
<script lang="ts" module>
  export interface CheckboxItem {
    value: string;
    label: string;
    disabled?: boolean;
  }
</script>

<script lang="ts">
  let {
    legend,
    items,
    values = $bindable([]),
    onchange,
  }: {
    legend: string;
    items: readonly CheckboxItem[];
    values?: string[];
    onchange?: (values: string[]) => void;
  } = $props();
</script>

<fieldset>
  <legend>{legend}</legend>
  {#each items as item (item.value)}
    <label class="check">
      <input
        type="checkbox"
        value={item.value}
        disabled={item.disabled}
        bind:group={values}
        onchange={() => onchange?.(values)}
      />
      <span>{item.label}</span>
    </label>
  {/each}
</fieldset>

<style>
  @layer components {
    fieldset {
      margin: 0;
      padding: 0;
      border: 0;
      min-width: 0;
    }
    legend {
      padding: 0;
      font-size: var(--text-ui);
      font-weight: 500;
      color: var(--text-secondary);
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
    input {
      appearance: none;
      width: 16px;
      height: 16px;
      margin: 0;
      flex: none;
      display: grid;
      place-content: center;
      border: 1px solid var(--border-control);
      border-radius: var(--radius-small);
      background: var(--surface-base);
      cursor: pointer;
      transition:
        background-color var(--ui-transition) var(--ease-ui),
        border-color var(--ui-transition) var(--ease-ui);
    }
    input::before {
      content: '';
      width: 8px;
      height: 4px;
      border-left: 1.5px solid transparent;
      border-bottom: 1.5px solid transparent;
      transform: rotate(-45deg) translateY(-1px);
    }
    input:checked {
      background: var(--accent);
      border-color: var(--accent);
    }
    input:checked::before {
      border-color: var(--surface-base);
    }
    input:disabled {
      border-color: var(--border-subtle);
      background: transparent;
      cursor: default;
    }
    /* A checked control that the current view has turned off still has to read as on. */
    input:checked:disabled {
      background: var(--text-tertiary);
      border-color: var(--text-tertiary);
    }
    .check:has(input:disabled) {
      color: var(--text-tertiary);
      cursor: default;
    }
  }
  @layer a11y {
    @media (forced-colors: active) {
      input:focus-visible {
        outline: 2px solid Highlight;
      }
      /* The drawn tick would be forced to ink on every box, checked or not: the system control draws itself. */
      input {
        appearance: auto;
        background: Canvas;
        border-color: CanvasText;
      }
      input::before {
        content: none;
      }
    }
  }
</style>
