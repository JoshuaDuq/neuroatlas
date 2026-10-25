<!--
  A native <progress>. Without a value it is indeterminate; with one it is a determinate bar of
  value / max. Named by `label`, which axe and screen readers require on a progressbar.
-->
<script lang="ts">
  let { label, value, max = 1 }: { label: string; value?: number; max?: number } = $props();
</script>

<progress aria-label={label} {value} {max}></progress>

<style>
  @layer components {
    /* The stage's loading bar (stage.css:313-314): 2 px on the overlay ink, the fill growing linearly. */
    progress {
      appearance: none;
      display: block;
      width: 200px;
      max-width: 100%;
      height: 2px;
      border: 0;
      border-radius: 1px;
      overflow: hidden;
      background: var(--overlay-border);
      color: var(--overlay-accent);
    }
    progress::-webkit-progress-bar {
      background: var(--overlay-border);
    }
    progress::-webkit-progress-value {
      background: var(--overlay-accent);
      transition: width var(--ui-transition) linear;
    }
    progress::-moz-progress-bar {
      background: var(--overlay-accent);
    }
  }
  @layer a11y {
    @media (forced-colors: active) {
      progress {
        forced-color-adjust: none;
        background: Canvas;
        outline: 1px solid CanvasText;
        color: Highlight;
      }
      progress::-webkit-progress-bar {
        background: Canvas;
      }
      /* Two rules: an engine drops a whole list if one selector is a pseudo-element it does not know. */
      progress::-webkit-progress-value {
        forced-color-adjust: none;
        background: Highlight;
      }
      progress::-moz-progress-bar {
        forced-color-adjust: none;
        background: Highlight;
      }
    }
  }
</style>
