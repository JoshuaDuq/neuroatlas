<!--
  APG Toolbar: one Tab stop, arrows/Home/End move focus (wrapping), Enter and Space are the
  buttons' own. Bits Toolbar behind the Planum seam (decision 0001). Its buttons come from
  `toolbarButton`, which only works inside a Toolbar:

    <Toolbar label="Tools">
      {#snippet children()}{@render toolbarButton({ onclick, children: label })}{/snippet}
    </Toolbar>
-->
<script module lang="ts">
  import { Toolbar as Kit } from 'bits-ui';
  import type { Snippet } from 'svelte';

  export interface ToolbarButtonProps {
    children: Snippet;
    onclick?: (event: MouseEvent) => void;
    disabled?: boolean;
    /** Present for a toggle button, absent for a plain command. */
    pressed?: boolean;
    /** The accessible name when the content is an icon. */
    label?: string;
    class?: string;
  }

  export { toolbarButton };
</script>

<script lang="ts">
  type Props = {
    /** The toolbar's accessible name. */
    label: string;
    children: Snippet;
    class?: string;
  };

  let { label, children, class: className }: Props = $props();
</script>

{#snippet toolbarButton(props: ToolbarButtonProps)}
  <Kit.Button
    class={['toolbar-button', props.class]}
    disabled={props.disabled}
    aria-label={props.label}
    aria-pressed={props.pressed}
    onclick={props.onclick}
  >
    {@render props.children()}
  </Kit.Button>
{/snippet}

<Kit.Root aria-label={label} class={className}>
  {@render children()}
</Kit.Root>

<style>
  @layer components {
    /* A tonal command until a feature restyles it with its own class (components.css:7-37). */
    :global(.toolbar-button) {
      height: var(--control-height);
      padding: 0 var(--space-3);
      border: 1px solid transparent;
      border-radius: var(--radius-control);
      background: var(--surface-tonal);
      color: var(--text-primary);
      font-size: var(--text-ui);
      font-weight: 500;
      line-height: var(--lh-ui);
      cursor: pointer;
    }
    :global(.toolbar-button:disabled) {
      background: var(--surface-sunken);
      color: var(--text-tertiary);
      cursor: default;
    }
    :global(.toolbar-button[aria-pressed='true']) {
      box-shadow: inset 0 0 0 1px var(--thumb-ring);
    }
    @media (pointer: coarse) {
      :global(.toolbar-button) {
        min-height: 44px;
      }
    }
  }

  @layer a11y {
    @media (forced-colors: active) {
      :global(.toolbar-button[aria-pressed='true']) {
        outline: 2px solid Highlight;
        outline-offset: -2px;
      }
    }
  }
</style>
