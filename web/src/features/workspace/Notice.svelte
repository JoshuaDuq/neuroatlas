<!--
  The one visible notice (viewer/ui/chrome/notice.js, index.html:208-215, layout.css:160-201): text,
  at most one action (reload, or seeing through the cortex) and a dismiss. It follows the mode tabs
  in the DOM in both shells, so focus inside it survives a shell change; H6's grip styles it into
  the sheet. It is not a live region: the announcer speaks the text (S1), so there is no
  role=alert and no focus move.
-->
<script lang="ts">
  import { tick } from 'svelte';
  import { t } from '../../lib/core/i18n/index.ts';
  import { noticeActionLabel } from '../../lib/core/workspace.ts';
  import type { Language, Notice } from '../../lib/types/index.ts';
  import { FOCUS_TARGETS, rescueFocus } from '../../lib/ui/focus.ts';
  import IconButton from '../../lib/ui/IconButton.svelte';

  type Props = {
    lang: Language;
    notice: Notice | null;
    onAction: (action: NonNullable<Notice['action']>) => void;
    onDismiss: () => void;
  };

  let { lang, notice, onAction, onDismiss }: Props = $props();

  const dismissLabel = $derived(t(lang, 'errors').dismiss);

  // The notice is gone with its dismiss, so focus goes to the tab in front (app.js:1479-1486).
  async function dismiss() {
    onDismiss();
    await tick();
    rescueFocus(FOCUS_TARGETS.activeTab);
  }
</script>

{#if notice}
  <div class="notice">
    <p class="notice-text">{notice.text}</p>
    {#if notice.action}
      <button type="button" class="notice-action" onclick={() => onAction(notice.action!)}>
        {noticeActionLabel(lang, notice.action)}
      </button>
    {/if}
    <IconButton
      class="notice-dismiss"
      icon="close"
      label={dismissLabel}
      data-tooltip={dismissLabel}
      onclick={dismiss}
    />
  </div>
{/if}

<style>
  @layer features {
    /* The one notice, under the mode tabs in both shells: tonal ground, primary ink, no colour of its own. */
    /* Its one action sits under the words it answers, so a long label never narrows them. */
    .notice {
      display: grid;
      flex: none;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: start;
      column-gap: var(--space-2);
      padding: var(--space-1) var(--space-1) var(--space-1) var(--panel-inset);
      border-bottom: 1px solid var(--border-subtle);
      background: var(--surface-tonal);
      color: var(--text-primary);
    }
    .notice-text {
      grid-column: 1;
      grid-row: 1;
      min-width: 0;
      margin: 0;
      padding: var(--space-2) 0;
      font-size: var(--text-ui);
      line-height: var(--lh-ui);
    }
    /* Its one action is a text link, as Restore previous view is. */
    .notice-action {
      grid-column: 1;
      grid-row: 2;
      justify-self: start;
      margin: calc(-1 * var(--space-1)) 0 var(--space-2);
      padding: 0;
      border: 0;
      background: none;
      color: var(--accent);
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    @media (hover: hover) and (pointer: fine) {
      .notice-action:hover {
        color: var(--accent-hover);
        text-decoration: underline;
        text-underline-offset: 3px;
      }
    }
    .notice :global(.notice-dismiss) {
      grid-column: 2;
      grid-row: 1;
    }
    @media (pointer: coarse) {
      .notice-action {
        min-height: 44px;
        margin: calc(-1 * var(--space-2)) 0 calc(-1 * var(--space-1));
      }
    }
  }

  @layer a11y {
    @media (forced-colors: active) {
      .notice-action {
        color: LinkText;
      }
    }
  }
</style>
