<!--
  A network's colour mark (detail.css:235-265): a 10 px square, or a share bar whose width is the
  fraction `share`. Decorative: the row names the network, so neither is announced.
-->
<script lang="ts">
  type Props = { kind?: 'swatch'; colour: string } | { kind: 'bar'; share: number };
  let props: Props = $props();
</script>

{#if props.kind === 'bar'}
  <span class="network-bar" aria-hidden="true"
    ><span style:width="{Math.min(1, Math.max(0, props.share)) * 100}%"></span></span
  >
{:else}
  <span class="network-swatch" aria-hidden="true" style:background={props.colour}></span>
{/if}

<style>
  @layer components {
    /* Swatch and bar centre on the first line, so a wrapped name reads as one row. */
    .network-swatch {
      display: block;
      width: 10px;
      height: 10px;
      margin-top: 5px;
      border-radius: var(--radius-mark);
    }
    .network-bar {
      display: block;
      height: 4px;
      margin-top: 8px;
      border-radius: var(--radius-mark);
      overflow: hidden;
      background: var(--border-subtle);
    }
    .network-bar > span {
      display: block;
      height: 100%;
      background: var(--text-tertiary);
    }
  }
  @layer a11y {
    @media (forced-colors: active) {
      /* A forced background would paint every swatch in one colour; a network colour is data. */
      .network-swatch,
      .network-bar,
      .network-bar > span {
        forced-color-adjust: none;
      }
      .network-bar {
        background: Canvas;
        outline: 1px solid CanvasText;
      }
      .network-bar > span {
        background: CanvasText;
      }
    }
  }
</style>
