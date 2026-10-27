<!--
  A mutually exclusive choice that is cheap to apply: language, theme, single keys, hemisphere,
  functional level, MPR planes, tree scope. APG Radio Group (decision 0003, deviation
  u3-segmented-controls): one Tab stop on the checked item, arrows move AND select (wrapping),
  Space selects. Bits RadioGroup behind the Planum seam; drawn as the legacy `.segmented` track.
  A visible label text can be shorter than its accessible name ("EN" / "English"), which
  satisfies WCAG 2.5.3 as long as the name contains the text.
-->
<script lang="ts" generics="Value extends string">
  import { RadioGroup } from 'bits-ui';

  interface Option {
    value: Value;
    /** What is drawn. */
    label: string;
    /** The accessible name, when the drawn text is an abbreviation. */
    name?: string;
    disabled?: boolean;
  }

  type Naming = { label: string; labelledby?: never } | { labelledby: string; label?: never };

  type Props = Naming & {
    options: readonly Option[];
    value: Value;
    class?: string;
    /**
     * The group cannot be changed now, but its radios stay focusable: a native `disabled` would drop
     * focus to the page when a choice starts the load that disables it (deviations/a2-tree-scope-radio-group.md).
     */
    ariaDisabled?: boolean;
  };

  let {
    options,
    value = $bindable(),
    label,
    labelledby,
    class: className,
    ariaDisabled = false,
  }: Props = $props();
</script>

<RadioGroup.Root
  bind:value={() => value, (next) => ariaDisabled || (value = next as Value)}
  aria-label={label}
  aria-labelledby={labelledby}
  class={['segmented', 'choice-group', className]}
>
  {#each options as option (option.value)}
    <RadioGroup.Item
      value={option.value}
      disabled={option.disabled}
      aria-disabled={ariaDisabled ? 'true' : undefined}
      aria-label={option.name}
    >
      {option.label}
    </RadioGroup.Item>
  {/each}
</RadioGroup.Root>

<style>
  @layer components {
    /* A neutral track and a precise selected edge distinguish settings from navigation (components.css:212-237). */
    :global(.segmented.choice-group) {
      display: flex;
      align-items: stretch;
      gap: 2px;
      padding: 2px;
      border-radius: var(--radius-control);
      background: var(--surface-tonal);
    }
    :global(.segmented.choice-group [role='radio']) {
      height: calc(var(--control-height) - 4px);
      min-width: 24px;
      padding: 0 var(--space-3);
      margin: 0;
      border: 0;
      border-radius: var(--radius-small);
      background: transparent;
      color: var(--text-secondary);
      font-size: var(--text-ui);
      font-weight: 500;
      line-height: var(--lh-ui);
      white-space: nowrap;
      cursor: pointer;
      transition:
        background-color var(--ui-transition) var(--ease-ui),
        color var(--ui-transition) var(--ease-ui);
    }
    :global(.segmented.choice-group [role='radio']:disabled),
    :global(.segmented.choice-group [role='radio'][aria-disabled='true']) {
      color: var(--text-tertiary);
      cursor: default;
    }
    @media (hover: hover) and (pointer: fine) {
      :global(
        .segmented.choice-group
          [role='radio']:hover:not(:disabled, [aria-disabled='true'], [aria-checked='true'])
      ) {
        background: var(--surface-tonal-hover);
        color: var(--text-primary);
      }
    }
    /* A precise edge marks the choice; elevation belongs to floating surfaces. */
    :global(.segmented.choice-group [role='radio'][aria-checked='true']) {
      background: var(--surface-raised);
      color: var(--text-primary);
      font-weight: 600;
      box-shadow: inset 0 0 0 1px var(--thumb-ring);
    }
    :global(.segmented.choice-group [role='radio']:focus-visible) {
      outline-offset: -2px;
    }
    @media (pointer: coarse) {
      :global(.segmented.choice-group [role='radio']) {
        min-height: 44px;
      }
    }
  }

  @layer a11y {
    @media (prefers-contrast: more) {
      :global(.segmented.choice-group) {
        box-shadow: inset 0 0 0 1px var(--border-control);
      }
    }
    /* Shadows and fills are dropped here, so the checked item needs a system-colour edge (a11y.css:79). */
    @media (forced-colors: active) {
      :global(.segmented.choice-group [role='radio'][aria-checked='true']) {
        outline: 2px solid Highlight;
        outline-offset: -2px;
      }
    }
  }
</style>
