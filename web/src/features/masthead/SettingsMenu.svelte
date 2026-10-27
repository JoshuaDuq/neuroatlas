<!--
  The ⋯ settings panel (viewer/ui/chrome/header.js:96-243, index.html:147-182, masthead.css:308-364).
  APG Disclosure, not a menu (decision 0005): the trigger carries aria-expanded and aria-controls,
  the panel holds three radio groups (decision 0003, APG Radio Group) and three commands.
  - a pointer choice or a command closes the panel and focuses ⋯; a keyboard choice keeps it open
    so arrows can walk the options (decision 15 on #4, deviation h2-close-on-keyboard-choice);
  - every change is announced (WCAG 4.1.3, deviation h2-settings-announcements);
  - a command closes the panel first, so the dialog it opens captures ⋯ as its invoker
    (deviation h2-focus-before-dialog).
-->
<script lang="ts">
  import { tick } from 'svelte';
  import type { Attachment } from 'svelte/attachments';
  import { t } from '../../lib/core/i18n/index.ts';
  import type { ThemeChoice } from '../../lib/state/theme.svelte.ts';
  import type { Language } from '../../lib/types/index.ts';
  import { announce } from '../../lib/ui/announcer.svelte.ts';
  import ChoiceGroup from '../../lib/ui/ChoiceGroup.svelte';
  import IconButton from '../../lib/ui/IconButton.svelte';
  import { isKeyboardActivation } from '../../lib/ui/instant.ts';
  import { OWN_KEYS_ATTRIBUTE } from '../../lib/ui/keys.ts';
  import Popover from '../../lib/ui/Popover.svelte';

  type SingleKeys = 'on' | 'off';

  interface Props {
    lang: Language;
    themeChoice: ThemeChoice;
    singleKeys: boolean;
    /** The anatomy is on screen: Full screen waits for it. */
    ready: boolean;
    /** `document.fullscreenEnabled`: without it the Full screen item is not offered. */
    fullscreenAvailable: boolean;
    /** The Full screen item's name, which follows the fullscreen state. */
    fullscreenLabel: string;
    /** The provenance manifest has loaded (phones only: the status bar carries it elsewhere). */
    provenanceReady: boolean;
    open?: boolean;
    /** The start failed: the panel is closed and ⋯ waits for nothing (app.js:183-189, header.js:236-241). */
    disabled?: boolean;
    onLanguage: (lang: Language) => void;
    onTheme: (choice: ThemeChoice) => void;
    onSingleKeys: (on: boolean) => void;
    onFullscreen: () => void;
    onProvenance: () => void;
    onShortcuts: () => void;
  }

  let {
    lang,
    themeChoice,
    singleKeys,
    ready,
    fullscreenAvailable,
    fullscreenLabel,
    provenanceReady,
    open = $bindable(false),
    disabled = false,
    onLanguage,
    onTheme,
    onSingleKeys,
    onFullscreen,
    onProvenance,
    onShortcuts,
  }: Props = $props();

  let moreButton: HTMLElement | undefined;
  /** The ⋯ button, which takes focus back when the opener of a dialog has gone. */
  export function button(): HTMLElement | null {
    return moreButton ?? null;
  }
  $effect.pre(() => {
    if (disabled) open = false;
  });

  const uid = $props.id();
  const labelId = (row: string) => `${row}-label-${uid}`;
  const noteId = `system-theme-note-${uid}`;

  const copy = $derived(t(lang, 'header'));
  const spoken = (label: string, choice: string) =>
    `${label}${lang === 'fr' ? ' : ' : ': '}${choice}`;

  const languages = [
    { value: 'en', label: 'EN', name: 'English' },
    { value: 'fr', label: 'FR', name: 'Français' },
  ] as const;
  const themes = $derived([
    { value: 'system', label: copy.systemTheme, name: copy.systemTheme },
    { value: 'light', label: copy.lightTheme, name: copy.lightTheme },
    { value: 'dark', label: copy.darkTheme, name: copy.darkTheme },
  ] as const);
  const keyChoices = $derived([
    { value: 'on', label: copy.singleKeysOn, name: copy.singleKeysOn },
    { value: 'off', label: copy.singleKeysOff, name: copy.singleKeysOff },
  ] as const);

  function chooseLanguage(next: Language) {
    // Said in the language just chosen.
    const name = languages.find((option) => option.value === next)!.name;
    announce(`${t(next, 'header').languageSwitch}${next === 'fr' ? ' : ' : ': '}${name}`);
    onLanguage(next);
  }
  function chooseTheme(next: ThemeChoice) {
    announce(spoken(copy.theme, themes.find((option) => option.value === next)!.label));
    onTheme(next);
  }
  function chooseSingleKeys(next: SingleKeys) {
    announce(spoken(copy.singleKeys, keyChoices.find((option) => option.value === next)!.label));
    onSingleKeys(next === 'on');
  }

  // ChoiceGroup draws a radio from `label` and `name` only. The rest of what these radios need is
  // set on them here: the language of each name (WCAG 3.1.2), the System note (WCAG 1.3.1, 1.4.13)
  // and the drawn text as data-label, which holds the width of the bold checked item. The radios
  // carry their visible text as an explicit name, so role locators that count generated content
  // (the hidden bold copy) still find them by it.
  interface Decoration {
    label: string;
    lang?: string;
    describedby?: string;
    tooltip?: string;
  }
  const decorated =
    (items: Record<string, Decoration>): Attachment<HTMLElement> =>
    (group) => {
      for (const [value, item] of Object.entries(items)) {
        const radio = group.querySelector<HTMLElement>(`[role="radio"][data-value="${value}"]`)!;
        radio.dataset.label = item.label;
        if (item.lang) radio.lang = item.lang;
        if (item.describedby) radio.setAttribute('aria-describedby', item.describedby);
        if (item.tooltip) radio.dataset.tooltip = item.tooltip;
      }
    };

  // A pointer choice has been applied: leaving the panel open would hide the anatomy it changed.
  function onclick(event: MouseEvent, close: () => void) {
    if ((event.target as Element).closest('[role="radio"]') && !isKeyboardActivation(event)) {
      close();
    }
  }

  // Close, then act once focus is back on ⋯: the dialog a command opens takes ⋯ as its invoker.
  async function command(close: () => void, action: () => void) {
    close();
    await tick();
    action();
  }
</script>

<Popover bind:open class="settings-menu">
  {#snippet trigger({ props })}
    <!-- Bits adds aria-haspopup="dialog"; this panel is a disclosure of plain controls, not a dialog. -->
    <IconButton
      {...props}
      aria-haspopup={undefined}
      {...{ [OWN_KEYS_ATTRIBUTE]: '' }}
      icon="more"
      {disabled}
      {@attach (node) => {
        moreButton = node;
      }}
      label={t(lang, 'menu').more}
      data-tooltip={t(lang, 'menu').more}
    />
  {/snippet}
  {#snippet children({ close })}
    <!-- Presses bubble up from the radios; the panel itself is not interactive. -->
    <div role="presentation" class="menu" onclick={(event) => onclick(event, close)}>
      <div class="menu-row">
        <span id={labelId('lang')} class="menu-label">{copy.languageSwitch}</span>
        <div
          {@attach decorated({
            en: { label: 'EN', lang: 'en' },
            fr: { label: 'FR', lang: 'fr' },
          })}
        >
          <ChoiceGroup
            labelledby={labelId('lang')}
            options={languages}
            bind:value={() => lang, chooseLanguage}
          />
        </div>
      </div>
      <div class="menu-row">
        <span id={labelId('theme')} class="menu-label">{copy.theme}</span>
        <div
          {@attach decorated({
            system: {
              label: copy.systemTheme,
              describedby: noteId,
              tooltip: copy.systemThemeNote,
            },
            light: { label: copy.lightTheme },
            dark: { label: copy.darkTheme },
          })}
        >
          <ChoiceGroup
            labelledby={labelId('theme')}
            options={themes}
            bind:value={() => themeChoice, chooseTheme}
          />
        </div>
        <span id={noteId} class="visually-hidden">{copy.systemThemeNote}</span>
      </div>
      <div class="menu-row">
        <span id={labelId('keys')} class="menu-label">{copy.singleKeys}</span>
        <div
          {@attach decorated({
            on: { label: copy.singleKeysOn },
            off: { label: copy.singleKeysOff },
          })}
        >
          <ChoiceGroup
            labelledby={labelId('keys')}
            options={keyChoices}
            bind:value={() => (singleKeys ? 'on' : 'off'), chooseSingleKeys}
          />
        </div>
      </div>
      {#if fullscreenAvailable}
        <button
          type="button"
          class="menu-item phone-only"
          {...{ [OWN_KEYS_ATTRIBUTE]: '' }}
          disabled={!ready}
          onclick={() => command(close, onFullscreen)}
        >
          {fullscreenLabel}
        </button>
      {/if}
      {#if provenanceReady}
        <button
          type="button"
          class="menu-item phone-only"
          {...{ [OWN_KEYS_ATTRIBUTE]: '' }}
          aria-haspopup="dialog"
          onclick={() => command(close, onProvenance)}
        >
          {t(lang, 'footer').provenance}
        </button>
      {/if}
      <button
        type="button"
        class="menu-item"
        {...{ [OWN_KEYS_ATTRIBUTE]: '' }}
        onclick={() => command(close, onShortcuts)}
      >
        <span>{copy.shortcuts}</span>
        <kbd aria-hidden="true">?</kbd>
      </button>
    </div>
  {/snippet}
</Popover>

<style>
  @layer features {
    /* Popover's content element carries the chrome; the grid is the datasheet inside it. */
    :global(.popover.settings-menu) {
      width: max-content;
      min-width: min(22rem, calc(100vw - var(--space-6)));
      scrollbar-gutter: stable;
    }
    .menu {
      display: grid;
      /* One choice column for every row, as wide as the widest (Système | Clair | Sombre): nothing wraps, every edge aligns. */
      grid-template-columns: minmax(0, 1fr) minmax(11.5rem, max-content);
    }
    .menu-row {
      display: grid;
      grid-column: 1 / -1;
      grid-template-columns: subgrid;
      align-items: center;
      gap: var(--space-6);
      /* Rows and commands share one pitch: a control and 4px above and below it (52px on touch). */
      min-height: calc(var(--control-height) + 2 * var(--space-1));
      padding: 0 var(--space-3);
      border-bottom: 1px solid var(--border-subtle);
    }
    .menu-label {
      min-width: 0;
      font-size: var(--text-ui);
      color: var(--text-primary);
      overflow-wrap: anywhere;
    }
    .menu-row :global(.choice-group [role='radio']) {
      flex: 1;
      /* The text may outgrow U3's fixed height at 200 % text or with WCAG 1.4.12 spacing. */
      height: auto;
      min-height: calc(var(--control-height) - 4px);
    }
    /* Three words of unequal length: each keeps its own width and the spare room is shared. */
    .menu-row:nth-child(2) :global(.choice-group [role='radio']) {
      flex: 1 1 auto;
    }
    /* The bold label's width is held, so a choice never moves its neighbours. */
    .menu-row :global(.choice-group [role='radio']::after) {
      content: attr(data-label);
      display: block;
      height: 0;
      overflow: hidden;
      visibility: hidden;
      font-weight: 600;
    }
    .menu-item {
      display: flex;
      grid-column: 1 / -1;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      width: 100%;
      min-height: calc(var(--control-height) + 2 * var(--space-1));
      padding: var(--space-1) var(--space-3);
      border: 0;
      border-radius: 0;
      background: none;
      color: var(--text-primary);
      font: inherit;
      font-size: var(--text-ui);
      text-align: left;
      cursor: pointer;
    }
    .menu-item:disabled {
      color: var(--text-tertiary);
      cursor: default;
    }
    .menu-item:not(:last-child) {
      border-bottom: 1px solid var(--border-subtle);
    }
    .menu-item:focus-visible {
      outline-offset: -2px;
    }
    @media (hover: hover) and (pointer: fine) {
      .menu-item:hover:not(:disabled) {
        background: var(--surface-hover);
      }
    }
    /* The status bar carries Provenance on a desktop, and the masthead the Full screen button. */
    .phone-only {
      display: none;
    }

    /* Phones: a full-width column inset by the safe areas; rows wrap by their content. */
    @media (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      :global(.popover.settings-menu) {
        width: auto;
        min-width: 0;
      }
      .menu {
        display: flex;
        flex-direction: column;
      }
      .menu-row {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2) var(--space-4);
        padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
      }
      .menu-label {
        flex: 1 0 8ch;
      }
      .menu-row > :global(div:has(.choice-group)) {
        flex: 1 1 11.5rem;
        min-width: 0;
      }
      .menu-row :global(.choice-group [role='radio']) {
        padding: var(--space-1) var(--space-2);
        white-space: normal;
        overflow-wrap: anywhere;
      }
      .phone-only {
        display: flex;
      }
    }
    @media (max-width: 360px) {
      .menu-label {
        flex-basis: 100%;
      }
    }
    @media (pointer: coarse), (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      .menu-row :global(.choice-group [role='radio']) {
        min-height: 44px;
      }
    }
  }
</style>
