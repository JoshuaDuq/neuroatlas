<!--
  An icon-only command: a native button named by `label`, drawn by `icons.ts`
  (viewer/ui/chrome/button-label.js, `.icon-button` in styles/components.css:67-78).
  `iconGraphic` is the one place an icon becomes an <svg>; ToggleToolbar reuses it.
-->
<script module lang="ts">
  import { ICONS, type IconDefinition, type IconName } from './icons.ts';

  const definitionOf = (name: IconName): IconDefinition => ICONS[name];

  export { iconGraphic };
</script>

<script lang="ts">
  import type { HTMLButtonAttributes } from 'svelte/elements';

  type Props = Omit<HTMLButtonAttributes, 'aria-label' | 'children' | 'type'> & {
    icon: IconName;
    /** The accessible name; the icon is decorative. */
    label: string;
  };

  let { icon, label, class: className, ...rest }: Props = $props();
</script>

{#snippet iconGraphic(name: IconName)}
  {@const definition = definitionOf(name)}
  <svg
    class="control-icon"
    viewBox="0 0 24 24"
    width={definition.size ?? 16}
    height={definition.size ?? 16}
    fill={definition.filled ? 'currentColor' : 'none'}
    stroke={definition.filled ? undefined : 'currentColor'}
    stroke-width={definition.filled ? undefined : (definition.strokeWidth ?? 1.5)}
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {#each definition.shapes as shape, index (index)}
      {#if 'path' in shape}
        <path d={shape.path} fill-rule={shape.fillRule} />
      {:else}
        <circle cx={shape.circle[0]} cy={shape.circle[1]} r={shape.circle[2]} />
      {/if}
    {/each}
  </svg>
{/snippet}

<button type="button" class={['icon-button', className]} aria-label={label} {...rest}>
  {@render iconGraphic(icon)}
</button>

<style>
  @layer components {
    .icon-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: var(--control-height);
      height: var(--control-height);
      padding: 0;
      border: 1px solid transparent;
      border-radius: var(--radius-control);
      background: none;
      color: var(--text-secondary);
      cursor: pointer;
      transition:
        background-color var(--ui-transition) var(--ease-ui),
        color var(--ui-transition) var(--ease-ui);
    }
    .icon-button :global(.control-icon) {
      flex: none;
    }
    .icon-button[aria-expanded='true'],
    .icon-button[aria-pressed='true'] {
      background: var(--surface-tonal);
      color: var(--text-primary);
    }
    /* Quiet commands have no fill to lose, so a disabled one fades its ink below the secondary step. */
    .icon-button:disabled {
      background: none;
      color: color-mix(in srgb, var(--text-tertiary) 55%, transparent);
      cursor: default;
    }
    @media (hover: hover) and (pointer: fine) {
      .icon-button:hover:not(:disabled) {
        background: var(--surface-hover);
        color: var(--text-primary);
      }
    }
    /* WCAG 2.5.8 asks 24 px; a coarse pointer gets 44 (phone.css:44, 317-318). */
    @media (pointer: coarse) {
      .icon-button {
        min-width: 44px;
        min-height: 44px;
      }
    }
  }

  @layer a11y {
    /* a11y.css:40-42 leaves .icon-button without a contrast border; forced colours still need an edge. */
    @media (forced-colors: active) {
      .icon-button[aria-expanded='true'],
      .icon-button[aria-pressed='true'] {
        outline: 2px solid Highlight;
        outline-offset: -2px;
      }
      .icon-button:disabled {
        color: GrayText;
      }
    }
  }
</style>
