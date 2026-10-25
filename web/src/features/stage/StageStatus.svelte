<!--
  What the stage says while there is no anatomy to draw: the download, a failed start, a lost
  graphics context (viewport-chrome.js:63-83, 763-781; main.js:43-60). Nothing is rendered once
  the status is `ready` or `switching`.

  The message and bar are not live regions: the progress is reported hundreds of times a load.
  The reader is told only when the load starts, ends or fails, through the page's announcer.
-->
<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { t } from '../../lib/core/i18n/index.ts';
  import { reloadWithoutStoredModels } from '../../lib/core/assets/published-assets.ts';
  import { announce } from '../../lib/ui/announcer.svelte.ts';
  import Progress from '../../lib/ui/Progress.svelte';
  import type { Language, LoadStatus } from '../../lib/types/index.ts';

  let {
    status,
    lang,
    progress,
    failure,
  }: {
    status: LoadStatus;
    lang: Language;
    /** The download so far, in bytes; no `total` while it is not yet known. */
    progress?: { loaded: number; total: number };
    /**
     * What a failed start says (`startFailure`) or the capability error's text, which has no
     * `button`. Without it an `error` status says the generic failure, with Retry.
     */
    failure?: { text: string; button?: string; dropLink?: boolean };
  } = $props();

  const viewport = $derived(t(lang, 'viewport'));
  const shown = $derived(failure ?? { text: viewport.error, button: viewport.retry });
  const percent = $derived(
    progress?.total ? Math.round((progress.loaded / progress.total) * 100) : undefined,
  );
  const message = $derived(
    status === 'context-lost'
      ? t(lang, 'errors').contextLost
      : status === 'error'
        ? shown.text
        : progress?.total
          ? viewport.loadingWithTotal(progress.loaded, progress.total)
          : viewport.loadingAnatomy,
  );

  let messageElement = $state<HTMLElement>();
  let retryButton = $state<HTMLButtonElement>();

  function retry(): void {
    if (shown.dropLink) history.replaceState(null, '', location.pathname + location.search);
    void reloadWithoutStoredModels();
  }

  const interrupted = (value: LoadStatus | undefined) =>
    value === 'error' || value === 'context-lost';

  // Where focus was when the status hid it, so it can go back (WCAG 2.4.3).
  let remembered: HTMLElement | null = null;
  let previous: LoadStatus | undefined;

  /** The control that held focus was hidden by the new status: focus lands on the status instead. */
  async function handOff(active: HTMLElement): Promise<void> {
    await tick();
    if (active.checkVisibility({ visibilityProperty: true })) return;
    remembered = active;
    (retryButton ?? messageElement)?.focus();
  }

  async function restore(): Promise<void> {
    await tick();
    const lost = document.activeElement === null || document.activeElement === document.body;
    if (lost && remembered?.isConnected) remembered.focus();
    remembered = null;
  }

  // One statement per transition, of the text the reader sees (WCAG 4.1.3).
  $effect.pre(() => {
    const now = status;
    const text = message;
    untrack(() => {
      const before = previous;
      previous = now;
      if (now === 'loading') {
        if (before === undefined) announce(text);
      } else if (interrupted(now)) {
        if (before !== now) announce(text);
        const active = document.activeElement;
        if (!interrupted(before) && before !== undefined && active instanceof HTMLElement) {
          if (active !== document.body) void handOff(active);
        }
      } else {
        if (before === 'loading' || before === 'context-lost') announce(viewport.loaded);
        if (interrupted(before)) void restore();
        else remembered = null;
      }
    });
  });
</script>

{#if status === 'loading' || status === 'error' || status === 'context-lost'}
  <div class="stage-status" data-status={status}>
    <p id="stage-message" bind:this={messageElement} tabindex="-1">
      {message}
    </p>
    {#if status === 'loading' && percent !== undefined}
      <Progress label={viewport.progressAria} value={percent} max={100} />
    {/if}
    {#if status === 'error' && shown.button}
      <button type="button" bind:this={retryButton} onclick={retry}>{shown.button}</button>
    {/if}
  </div>
{/if}

<style>
  @layer features {
    /* The page's own surface and ink, so the screen follows the reader's theme (decisions 3 and 18). */
    .stage-status {
      /* The bar's primitive paints from the overlay tokens, which are fixed dark-scene colours. */
      --overlay-border: var(--border-control);
      --overlay-accent: var(--accent);
      position: absolute;
      inset: 0;
      z-index: 3;
      display: grid;
      place-content: center;
      justify-items: center;
      gap: var(--space-3);
      padding: var(--space-8);
      text-align: center;
      background: var(--surface-base);
      color: var(--text-secondary);
      font-size: var(--text-stage);
      line-height: var(--lh-ui);
    }
    #stage-message {
      max-width: 44ch;
      font-variant-numeric: tabular-nums;
      text-wrap: pretty;
    }
    .stage-status[data-status='error'] #stage-message {
      color: var(--danger);
    }
    button {
      height: var(--control-height);
      padding: 0 var(--space-3);
      border: 0;
      border-radius: var(--radius-control);
      background: var(--surface-tonal);
      color: var(--text-primary);
      cursor: pointer;
    }
    @media (hover: hover) and (pointer: fine) {
      button:hover {
        background: var(--surface-tonal-hover);
      }
    }
    @media (pointer: coarse) {
      button {
        min-height: 44px;
        min-width: 44px;
      }
    }
    /* A phone's sheet covers the lower stage: the message waits above it, and Retry stays in reach. */
    @media (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      .stage-status {
        place-content: start center;
        padding-top: 20dvh;
      }
    }
  }
  @layer a11y {
    @media (forced-colors: active) {
      .stage-status,
      .stage-status[data-status='error'] #stage-message {
        background: Canvas;
        color: CanvasText;
      }
      button {
        border: 1px solid ButtonText;
      }
    }
  }
</style>
