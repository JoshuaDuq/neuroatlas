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
    progress {
      appearance: none;
      display: block;
      width: 200px;
      max-width: 100%;
      height: 4px;
      border: 0;
      border-radius: 2px;
      overflow: hidden;
      background: var(--border-subtle);
      color: var(--accent);
    }
    progress::-webkit-progress-bar {
      background: var(--border-subtle);
    }
    progress::-webkit-progress-value {
      background: var(--accent);
    }
    progress::-moz-progress-bar {
      background: var(--accent);
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
      progress::-webkit-progress-value,
      progress::-moz-progress-bar {
        background: Highlight;
      }
    }
  }
</style>
