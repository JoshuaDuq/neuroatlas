<!--
  APG Switch: a labelled on/off setting that takes effect at once. Space (and Enter) toggle.
  Bits Switch behind the Planum seam; the visible label is the accessible name and clicking it
  toggles. State is carried by the thumb's position and the role's `aria-checked`, never by
  colour alone, including in forced colours (CanvasText track and thumb).
-->
<script lang="ts">
  import { Switch } from 'bits-ui';

  type Props = {
    checked: boolean;
    /** The visible label, which names the switch. */
    label: string;
    disabled?: boolean;
    class?: string;
  };

  let { checked = $bindable(), label, disabled = false, class: className }: Props = $props();
</script>

<label class={['switch-field', className]} data-disabled={disabled ? '' : undefined}>
  <Switch.Root bind:checked {disabled} class="switch-track">
    <Switch.Thumb class="switch-thumb" />
  </Switch.Root>
  <span>{label}</span>
</label>

<style>
  @layer components {
    .switch-field {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      min-height: 24px;
      color: var(--text-primary);
      font-size: var(--text-ui);
      line-height: var(--lh-ui);
      cursor: pointer;
    }
    .switch-field[data-disabled] {
      color: var(--text-tertiary);
      cursor: default;
    }
    .switch-field :global(.switch-track) {
      position: relative;
      flex: none;
      width: 40px;
      height: 24px;
      padding: 0;
      border: 1px solid var(--border-control);
      border-radius: 12px;
      background: var(--surface-tonal);
      cursor: inherit;
      transition: background-color var(--ui-transition) var(--ease-ui);
    }
    .switch-field :global(.switch-track[data-state='checked']) {
      border-color: var(--accent);
      background: var(--accent);
    }
    .switch-field :global(.switch-track:disabled) {
      opacity: 0.55;
    }
    .switch-field :global(.switch-thumb) {
      position: absolute;
      top: 3px;
      left: 3px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: var(--text-primary);
      transition: transform var(--ui-transition) var(--ease-ui);
    }
    .switch-field :global(.switch-track[data-state='checked'] .switch-thumb) {
      transform: translateX(16px);
      background: var(--surface-base);
    }
  }

  @layer a11y {
    @media (prefers-reduced-motion: reduce) {
      .switch-field :global(.switch-thumb) {
        transition: none;
      }
    }
    @media (forced-colors: active) {
      .switch-field :global(.switch-track) {
        border-color: CanvasText;
        background: Canvas;
      }
      .switch-field :global(.switch-track[data-state='checked']) {
        background: CanvasText;
      }
      .switch-field :global(.switch-thumb) {
        background: CanvasText;
      }
      .switch-field :global(.switch-track[data-state='checked'] .switch-thumb) {
        background: Canvas;
      }
      .switch-field :global(.switch-track:disabled) {
        border-color: GrayText;
        opacity: 1;
      }
      .switch-field[data-disabled] {
        color: GrayText;
      }
    }
  }
</style>
