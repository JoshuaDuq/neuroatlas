<!--
  A native <select> (the platform's own listbox: keyboard, typeahead and mobile pickers come with
  it). Where the browser supports `appearance: base-select` the closed control and the list are
  styled and the chevron is the picker icon; elsewhere the control is drawn with the same chevron
  as two gradient strokes.
-->
<script lang="ts" module>
  export interface SelectOption {
    value: string;
    label: string;
    title?: string;
  }
</script>

<script lang="ts">
  let {
    id,
    label,
    describedby,
    options,
    value = $bindable(),
    disabled = false,
    onchange,
  }: {
    /** Lets a visible `<label for={id}>` name the select and focus it on click. */
    id?: string;
    /** The accessible name; leave it out when a visible `<label for>` names the select. */
    label?: string;
    /** The id of the note that describes the select. */
    describedby?: string;
    options: readonly SelectOption[];
    value: string;
    disabled?: boolean;
    onchange?: (value: string) => void;
  } = $props();
</script>

<select
  {id}
  aria-label={label}
  aria-describedby={describedby}
  {disabled}
  bind:value
  onchange={() => onchange?.(value)}
>
  {#each options as option (option.value)}
    <option value={option.value} title={option.title}>{option.label}</option>
  {/each}
</select>

<style>
  @layer components {
    select {
      /* The caret's ink ends this far inside the control, as far as the value starts from the other edge. */
      --caret-end: var(--space-3);
      appearance: none;
      width: 100%;
      height: var(--control-height);
      padding: 0 calc(var(--caret-end) + var(--space-5)) 0 var(--space-3);
      border: 1px solid var(--border-control);
      border-radius: var(--radius-control);
      background-color: var(--surface-base);
      color: var(--text-primary);
      box-shadow: none;
      font-size: var(--text-ui);
      cursor: pointer;
      background-image:
        linear-gradient(
          45deg,
          transparent calc(50% - 0.9px),
          var(--text-secondary) calc(50% - 0.9px) calc(50% + 0.6px),
          transparent calc(50% + 0.6px)
        ),
        linear-gradient(
          -45deg,
          transparent calc(50% - 0.9px),
          var(--text-secondary) calc(50% - 0.9px) calc(50% + 0.6px),
          transparent calc(50% + 0.6px)
        );
      background-position:
        calc(100% - var(--caret-end) - 5px) calc(50% + 1px),
        calc(100% - var(--caret-end)) calc(50% + 1px);
      background-size:
        5px 5px,
        5px 5px;
      background-repeat: no-repeat;
    }
    select:disabled {
      color: var(--text-tertiary);
      cursor: default;
      border-color: var(--border-subtle);
      background-color: var(--surface-sunken);
    }
    @supports (appearance: base-select) {
      select,
      select::picker(select) {
        appearance: base-select;
      }
      select {
        background-image: none;
        padding-right: var(--space-3);
      }
      select::picker-icon {
        content: '';
        width: 6px;
        height: 6px;
        margin: 0 3px;
        border-right: 1.5px solid var(--text-secondary);
        border-bottom: 1.5px solid var(--text-secondary);
        transform: translateY(-2px) rotate(45deg);
        transition: transform var(--ui-transition) var(--ease-ui);
      }
      select:open::picker-icon {
        transform: translateY(2px) rotate(225deg);
      }
      select::picker(select) {
        border: 1px solid var(--border-control);
        border-radius: var(--radius-control);
        background: var(--surface-base);
        padding: var(--space-1);
      }
      option {
        min-height: var(--control-height);
        padding: 0 var(--space-3);
        font-size: var(--text-ui);
      }
      option:checked {
        background: var(--surface-tonal);
      }
    }
    @media (hover: hover) and (pointer: fine) {
      select:hover:not(:disabled) {
        border-color: var(--text-secondary);
      }
      option:hover {
        background: var(--surface-tonal);
      }
    }
  }
  @layer a11y {
    @media (prefers-reduced-motion: reduce) {
      select::picker-icon {
        transition: none;
      }
    }
    @media (forced-colors: active) {
      select {
        border-color: CanvasText;
      }
      select:focus-visible {
        outline: 2px solid Highlight;
      }
    }
  }
</style>
