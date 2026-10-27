<!--
  The section row above the dock's tools while a plane is cut (index.html:491-537, ui/chrome/sections.js:
  195-247, 409-527, stage.css:509-614 and its phone rules). A `role=group` named by the plane.
  - Position: a native slider (one cut build at a time, `aria-valuetext` in signed millimetres) and the exact
    field beside it. The field applies on change; empty puts the position back; a value outside the plane's
    range is not applied and is explained under the row (deviation u4-number-field-range-error). Neither
    takes the cut's value back while the reader is on it.
  - Reverse side, Linked MRI (`M`), and Close, which hands focus to the Section tool before the row goes.
    While compact (G1's `sectionCompact`: always on a phone, elsewhere when one line would not fit),
    Reverse side and Linked MRI fold behind a disclosure.
  - An oblique cut adds tilt and azimuth sliders.
  - While the chosen plane's anatomy is prepared the row names the plane and says so, with nothing to move.
  - The status sentence is spoken from a live region that stays when the row goes, so closing the section
    is heard (deviation g4-status-outlives-bar). It waits while a slider is dragged or the position slider
    has focus, and is said once the reader lets go; the shown line leaves out the position.
  - The row's one-line width is measured into G1's `sectionNeed` whenever its words change.
-->
<script lang="ts">
  import { tick, untrack } from 'svelte';
  import type { Attachment } from 'svelte/attachments';
  import { ARIA_KEYSHORTCUTS } from '../../lib/controller/keymap.ts';
  import { millimetres } from '../../lib/core/format.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import type { StageLayout } from '../../lib/state/stage-layout.svelte.ts';
  import type { View } from '../../lib/state/view.svelte.ts';
  import type { Language } from '../../lib/types/index.ts';
  import { trackDrag } from '../../lib/ui/drag.ts';
  import IconButton from '../../lib/ui/IconButton.svelte';
  import { isKeyboardActivation } from '../../lib/ui/instant.ts';
  import type { SectionControls } from './section-controls.svelte.ts';
  import { axisEnds, degrees, rangeMessage, sectionSentences } from './section-text.ts';

  interface Props {
    controls: SectionControls;
    stage: Pick<StageLayout, 'sectionNeed' | 'sectionCompact' | 'fontEpoch'>;
    lang: Language;
    /** The colouring on screen, for the note the sentence ends with. */
    view: Pick<View, 'surfaceColor' | 'paint'>;
    /** The tract reference is shown alone, without the brain or its cut. */
    tractReference: boolean;
  }

  let { controls, stage, lang, view, tractReference }: Props = $props();

  const uid = $props.id();
  const positionId = `cut-position-${uid}`;
  const detailsId = `cut-details-${uid}`;
  const errorId = `cut-error-${uid}`;

  const copy = $derived(t(lang, 'cuts'));
  const plane = $derived(controls.plane);
  const shown = $derived(plane !== 'off' && !tractReference);
  const pending = $derived(controls.pending);
  // A failure is drawn even when no plane is cut: the first cut is the one that downloads, and it can fail.
  const failed = $derived(controls.failure !== null);
  const compact = $derived(stage.sectionCompact);
  const ends = $derived(axisEnds(plane, lang));
  const [minimum, maximum] = $derived(controls.offsetRange);

  let bar: HTMLElement;
  let details = $state<HTMLElement>();
  let more = $state<HTMLElement>();
  let expanded = $state(false);

  // The slider and the field each keep what the reader is doing with them until they leave.
  let rangeFocused = $state(false);
  let numberFocused = $state(false);
  let dragging = $state(false);
  let draft = $state(0);
  let numberText = $state('');
  let invalid = $state(false);
  let tilt = $state(0);
  let azimuth = $state(0);
  let angleFocused = $state(false);

  $effect.pre(() => {
    const offset = controls.offset;
    if (!untrack(() => rangeFocused)) draft = offset;
    if (!untrack(() => numberFocused)) {
      numberText = offset.toFixed(1);
      invalid = false;
    }
  });
  $effect.pre(() => {
    const { tilt: nextTilt, azimuth: nextAzimuth } = controls.state;
    if (untrack(() => angleFocused)) return;
    tilt = nextTilt;
    azimuth = nextAzimuth;
  });

  // A failure belongs to the cut it happened on: when the mode changes it is dropped, not just hidden, so a
  // command that moves the plane away and back does not bring it back.
  const cutMode = $derived(controls.state.mode);
  let seenMode = untrack(() => cutMode);
  $effect.pre(() => {
    if (cutMode === seenMode) return;
    seenMode = cutMode;
    untrack(() => controls.forgetFailure());
  });

  const sentences = $derived(
    sectionSentences({
      lang,
      state: controls.state,
      active: controls.active,
      offset: controls.offset,
      spacing: controls.spacing,
      surfaceColor: view.surfaceColor,
      paint: view.paint,
      nextbrainSegmented: controls.nextbrainSegmented,
      colourAtlases: controls.colourAtlases,
      failure: controls.failure,
    }),
  );
  // A live region rewritten at every step of a drag is noise; the sentence waits until the slider is left.
  let said = $state(untrack(() => sentences.said));
  $effect(() => {
    const next = sentences.said;
    if (!dragging && !rangeFocused) said = next;
  });

  /** A slider's drag lasts from its first input until it is released, cancelled or left (U2 `trackDrag`). */
  const tracked: Attachment<HTMLInputElement> = (slider) => {
    const drag = trackDrag([slider], () => (dragging = false));
    return () => drag.dispose();
  };

  /**
   * The Section tool, or the dock's first tool when the tract reference hides it. Decided by the tract
   * reference, not by what is drawn: this runs before the dock hides the tool.
   */
  function focusTool() {
    const tools = [...bar.parentElement!.querySelectorAll<HTMLElement>('.stage-tool')];
    // G2's Section tool carries its label as `section-tool-…` (Dock.svelte); a hand-off is requested on #4.
    const section = tools.find((tool) => tool.querySelector('[id^="section-tool-"]'));
    (tractReference ? tools[0] : section)!.focus({ preventScroll: true });
  }

  // Before the row goes: focus inside it would otherwise fall to the page (g4-focus-when-bar-hidden).
  $effect.pre(() => {
    if (shown) return;
    const group = untrack(() => bar?.querySelector('[role="group"]'));
    if (group?.contains(document.activeElement)) focusTool();
  });

  // Folding the details away with focus inside them hands it to the disclosure that opens them again.
  $effect.pre(() => {
    if (!compact || expanded) return;
    if (!untrack(() => details)?.contains(document.activeElement)) return;
    tick().then(() => more?.focus({ preventScroll: true }));
  });

  /**
   * The row's natural width with every control beside the slider, in one forced layout, read again only
   * when its words, its plane or the webfont change (viewport-chrome.js:148-166).
   */
  $effect(() => {
    void [lang, plane, pending, stage.fontEpoch];
    if (!shown) {
      stage.sectionNeed = 0;
      return;
    }
    const style = getComputedStyle(bar.parentElement!);
    // Measured uncompacted, as legacy did; the attribute is put back before anything is drawn.
    const compactAttribute = bar.dataset.compact!;
    delete bar.dataset.compact;
    bar.dataset.measure = '';
    const width =
      bar.offsetWidth + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
    delete bar.dataset.measure;
    bar.dataset.compact = compactAttribute;
    stage.sectionNeed = width;
  });

  /** Leaving a cut angle's slider: both sliders catch up with the cut, as the position slider does. */
  function leaveAngles() {
    angleFocused = false;
    // While a slide is building the cut lags the sliders: the cut catches up when it lands.
    if (!controls.sliding) ({ tilt, azimuth } = controls.state);
  }

  function closeSection() {
    focusTool();
    void controls.close();
  }

  function commitNumber(field: HTMLInputElement) {
    if (field.value === '') {
      numberText = controls.offset.toFixed(1);
      invalid = false;
      return;
    }
    const typed = Number(field.value);
    if (!Number.isFinite(typed) || typed < minimum || typed > maximum) {
      invalid = true;
      return;
    }
    invalid = false;
    controls.setOffset(typed);
  }
</script>

<div
  bind:this={bar}
  class="section-bar"
  data-shown={shown ? '' : undefined}
  data-failed={failed ? '' : undefined}
  data-pending={pending}
  data-compact={compact}
  data-expanded={expanded}
>
  {#if shown}
    <div role="group" aria-label={copy.sectionNames[plane as keyof typeof copy.sectionNames]}>
      <div class="section-bar-row">
        <span class="section-bar-name">
          <span class="section-bar-full">{copy.modes[plane]}</span>
          <span class="section-bar-short" aria-hidden="true">{copy.modesShort[plane]}</span>
        </span>
        {#if !pending}
          <div class="cut-position-row">
            <label class="visually-hidden" for={positionId}>{copy.axes[plane]}</label>
            <span class="cut-end" aria-hidden="true">{ends[0]}</span>
            <input
              id={positionId}
              type="range"
              min={minimum}
              max={maximum}
              step="0.5"
              value={draft}
              disabled={!controls.active}
              aria-valuetext={millimetres(draft, lang)}
              {@attach tracked}
              onfocus={() => (rangeFocused = true)}
              onblur={() => {
                rangeFocused = false;
                draft = controls.offset;
              }}
              oninput={(event) => {
                dragging = true;
                draft = event.currentTarget.valueAsNumber;
                numberText = draft.toFixed(1);
                invalid = false;
                controls.slideOffset(draft);
              }}
            />
            <span class="cut-end" aria-hidden="true">{ends[1]}</span>
            <input
              class="cut-number"
              type="number"
              min={minimum}
              max={maximum}
              step="0.5"
              disabled={!controls.active}
              aria-label={copy.exactPositionAria}
              aria-invalid={invalid}
              aria-describedby={invalid ? errorId : undefined}
              bind:value={numberText}
              onfocus={() => (numberFocused = true)}
              onblur={() => {
                numberFocused = false;
                if (!invalid) numberText = controls.offset.toFixed(1);
              }}
              onchange={(event) => commitNumber(event.currentTarget)}
            />
            <span class="cut-unit" aria-hidden="true">mm</span>
          </div>
          <div bind:this={details} id={detailsId} class="cut-details">
            <label class="check">
              <input
                type="checkbox"
                data-tooltip={copy.reverseSide}
                checked={controls.state.reverse}
                disabled={!controls.active}
                onchange={(event) => controls.setReverse(event.currentTarget.checked)}
              />
              <span>{copy.reverseShort}</span>
            </label>
            <button
              type="button"
              class="stage-command"
              aria-keyshortcuts={ARIA_KEYSHORTCUTS.linkedMri}
              aria-disabled={controls.opening ? 'true' : undefined}
              data-tooltip={copy.openMprTitle}
              onclick={(event) => controls.openLinkedMri({ instant: isKeyboardActivation(event) })}
            >
              {copy.openLinkedMpr}
            </button>
          </div>
          <button
            bind:this={more}
            type="button"
            class="stage-icon-button cut-more"
            aria-expanded={expanded}
            aria-controls={detailsId}
            aria-label={copy.moreControls}
            onclick={() => (expanded = !expanded)}
          >
            <span class="stage-tool-chevron" aria-hidden="true"></span>
          </button>
        {/if}
        <IconButton
          icon="close"
          class="cut-close"
          label={copy.closeCut}
          data-tooltip={copy.closeCut}
          onclick={closeSection}
        />
      </div>
      {#if invalid && !pending}
        <p id={errorId} class="cut-error">{rangeMessage([minimum, maximum], lang)}</p>
      {/if}
      {#if controls.state.mode === 'oblique' && !pending}
        <div class="section-bar-row cut-angles">
          <label class="cut-angle">
            <span>{copy.tiltShort}</span>
            <input
              type="range"
              data-tooltip={copy.tilt}
              min="0"
              max="90"
              step="1"
              value={tilt}
              aria-valuetext={degrees(tilt, lang)}
              {@attach tracked}
              onfocus={() => (angleFocused = true)}
              onblur={leaveAngles}
              oninput={(event) => {
                dragging = true;
                tilt = event.currentTarget.valueAsNumber;
                controls.slideAngles(tilt, azimuth);
              }}
            />
            <output aria-hidden="true">{degrees(tilt, lang)}</output>
          </label>
          <label class="cut-angle">
            <span>{copy.azimuthShort}</span>
            <input
              type="range"
              data-tooltip={copy.azimuth}
              min="-180"
              max="180"
              step="1"
              value={azimuth}
              aria-valuetext={degrees(azimuth, lang, true)}
              {@attach tracked}
              onfocus={() => (angleFocused = true)}
              onblur={leaveAngles}
              oninput={(event) => {
                dragging = true;
                azimuth = event.currentTarget.valueAsNumber;
                controls.slideAngles(tilt, azimuth);
              }}
            />
            <output aria-hidden="true">{degrees(azimuth, lang, true)}</output>
          </label>
        </div>
      {/if}
    </div>
  {/if}
  <!-- The slider and the field state the position; the sentence carrying it is spoken once it settles. -->
  <p role="status" class="cut-status">
    <span class="visually-hidden">{said}</span>{#if shown || failed}<span aria-hidden="true"
        >{sentences.shown}</span
      >{/if}
  </p>
</div>

<style>
  @layer features {
    /* The dock's upper row while a plane is cut, ruled off from the tools under it. */
    .section-bar:is([data-shown], [data-failed]) {
      /* The plane's name starts on the tools' words: the toolbar's inset and a tool's padding. */
      padding: var(--space-1) var(--space-1) var(--space-2) calc(var(--space-1) + var(--space-3));
      border-bottom: 1px solid var(--overlay-border);
      color: var(--overlay-ink);
    }
    /* With no plane and no failure only the live region is left, and it draws nothing. */
    .section-bar:not([data-shown], [data-failed]) .cut-status {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: -1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    .section-bar-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-1) var(--space-3);
      min-height: var(--control-height);
    }
    .section-bar-name {
      flex: none;
      font-size: var(--text-stage);
      font-weight: 600;
    }
    .section-bar-short {
      display: none;
    }
    .cut-position-row {
      display: flex;
      flex: 1 1 auto;
      align-items: center;
      gap: var(--space-2);
      min-width: 0;
    }
    .cut-end {
      flex: none;
      min-width: 1ch;
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      font-weight: 600;
      letter-spacing: 0.06em;
      text-align: center;
      color: var(--overlay-ink-muted);
    }
    /* A 24px hit area around the 2px track; 160px is the slider's natural length in a whole row. */
    input[type='range'] {
      appearance: none;
      flex: 1 1 auto;
      width: 160px;
      min-width: 64px;
      height: 24px;
      margin: 0;
      padding: 0;
      background: transparent;
      cursor: pointer;
    }
    input[type='range']::-webkit-slider-runnable-track {
      height: 2px;
      background: var(--border-control);
      border-radius: 1px;
    }
    input[type='range']::-moz-range-track {
      height: 2px;
      background: var(--border-control);
      border-radius: 1px;
    }
    input[type='range']::-webkit-slider-thumb {
      appearance: none;
      width: 14px;
      height: 14px;
      margin-top: -6px;
      background: var(--surface-base);
      border: 2px solid var(--accent);
      border-radius: 50%;
    }
    input[type='range']::-moz-range-thumb {
      width: 10px;
      height: 10px;
      background: var(--surface-base);
      border: 2px solid var(--accent);
      border-radius: 50%;
    }
    input:disabled {
      cursor: default;
    }
    .cut-number {
      appearance: textfield;
      flex: none;
      width: 4.5rem;
      height: var(--control-height);
      padding: 0 var(--space-2);
      border: 1px solid var(--border-control);
      border-radius: var(--radius-control);
      background-color: var(--surface-base);
      color: var(--text-primary);
      font-size: var(--text-stage);
      font-variant-numeric: tabular-nums;
      text-align: right;
    }
    .cut-number::-webkit-inner-spin-button,
    .cut-number::-webkit-outer-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    /* The same hover edge as the stage's select. */
    @media (hover: hover) and (pointer: fine) {
      .cut-number:hover:not(:disabled, [aria-invalid='true']) {
        border-color: var(--text-secondary);
      }
    }
    .cut-number[aria-invalid='true'] {
      border-color: var(--overlay-danger);
    }
    .cut-unit {
      margin-left: calc(-1 * var(--space-1));
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      color: var(--overlay-ink-muted);
    }
    .cut-error {
      margin: var(--space-1) 0 0;
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      color: var(--overlay-danger);
    }
    .cut-details {
      display: contents;
    }
    .check {
      display: flex;
      flex: none;
      align-items: center;
      gap: var(--space-2);
      min-height: var(--control-height);
      margin: 0;
      font-size: var(--text-stage);
      white-space: nowrap;
      cursor: pointer;
    }
    input[type='checkbox'] {
      appearance: none;
      display: grid;
      place-content: center;
      flex: none;
      width: 16px;
      height: 16px;
      margin: 0;
      border: 1px solid var(--border-control);
      border-radius: var(--radius-small);
      background: var(--surface-base);
      cursor: pointer;
    }
    input[type='checkbox']::before {
      content: '';
      width: 8px;
      height: 4px;
      border-left: 1.5px solid transparent;
      border-bottom: 1.5px solid transparent;
      transform: rotate(-45deg) translateY(-1px);
    }
    input[type='checkbox']:checked {
      background: var(--accent);
      border-color: var(--accent);
    }
    input[type='checkbox']:checked::before {
      border-color: var(--surface-base);
    }
    .stage-icon-button,
    .section-bar :global(.icon-button.cut-close) {
      display: inline-flex;
      flex: none;
      align-items: center;
      justify-content: center;
      width: var(--control-height);
      height: var(--control-height);
      padding: 0;
      border: 0;
      border-radius: var(--radius-small);
      background: none;
      color: var(--overlay-ink-muted);
      cursor: pointer;
      transition:
        background-color var(--ui-transition) var(--ease-ui),
        color var(--ui-transition) var(--ease-ui),
        transform var(--press-transition) var(--ease-ui);
    }
    .stage-icon-button:active:not(:focus-visible) {
      transform: scale(var(--press-scale));
    }
    @media (hover: hover) and (pointer: fine) {
      .stage-icon-button:hover:not(:disabled),
      .section-bar :global(.icon-button.cut-close:hover) {
        background: var(--overlay-plate-hover);
        color: var(--overlay-ink);
      }
    }
    .cut-more {
      display: none;
    }
    .section-bar :global(.cut-close) {
      margin-left: auto;
    }
    .cut-angles {
      margin-top: var(--space-1);
      padding-right: var(--space-2);
    }
    .cut-angle {
      display: flex;
      flex: 1 1 220px;
      align-items: center;
      gap: var(--space-2);
      min-width: 0;
      font-size: var(--text-stage);
      color: var(--overlay-ink-muted);
    }
    .cut-angle output {
      min-width: 5ch;
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      font-variant-numeric: tabular-nums;
      text-align: right;
      color: var(--overlay-ink);
    }
    .section-bar:is([data-shown], [data-failed]) .cut-status {
      margin: var(--space-1) 0 0;
      padding-right: var(--space-2);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      color: var(--overlay-ink-muted);
    }

    /*
     * Compact (G1's `sectionCompact`, where the whole row would wrap): the row keeps the plane, the slider
     * and the exact position on one line; Reverse side and Linked MRI open from the disclosure.
     */
    .section-bar[data-compact='true'] .section-bar-row:first-child {
      flex-wrap: nowrap;
      gap: var(--space-2);
    }
    /* From nothing, so an unfolded row never pushes the disclosure and close onto a line of their own. */
    .section-bar[data-compact='true'] .cut-position-row {
      flex: 1 1 0;
    }
    .section-bar[data-compact='true'] input[type='range'] {
      min-width: 40px;
    }
    .section-bar[data-compact='true'] .cut-number {
      width: 4rem;
    }
    .section-bar[data-compact='true'] .cut-more {
      display: inline-flex;
    }
    .section-bar[data-compact='true'] :global(.cut-close) {
      margin-left: 0;
    }
    .section-bar[data-compact='true'] .cut-details {
      display: none;
    }
    .section-bar[data-compact='true'][data-expanded='true'] .section-bar-row:first-child {
      flex-wrap: wrap;
    }
    .section-bar[data-compact='true'][data-expanded='true'] .cut-details {
      display: flex;
      flex-basis: 100%;
      order: 5;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      padding: 0 var(--space-2) var(--space-1) 0;
    }

    /* Measured whole on one line, out of the dock's flow and unseen, for G1's `sectionNeed`. */
    .section-bar:global([data-measure]) {
      position: absolute;
      top: 0;
      left: 0;
      width: max-content;
      visibility: hidden;
    }
    .section-bar:global([data-measure]) .section-bar-row:first-child {
      flex-wrap: nowrap;
    }
    .section-bar:global([data-measure]) :is(.cut-more, .cut-angles, .cut-error, .cut-status) {
      display: none;
    }

    /* The phone's rules (stage.css:621, 687-704), on the literal twin of PHONE_QUERY. */
    @media (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      /* A cut plane's row takes the stage's width. */
      :global(.stage-dock:has(> .section-bar[data-shown])) {
        width: calc(100% - var(--vis-left) - var(--vis-right) - 2 * var(--stage-gutter));
      }
      /* Always compact here, under the plane's short name, on the tools' words. */
      .section-bar[data-shown] {
        padding: 0 0 0 var(--space-3);
      }
      .section-bar-full {
        display: none;
      }
      .section-bar-short {
        display: inline;
      }
      .section-bar:not([data-expanded='true']) .cut-angles {
        display: none;
      }
      .cut-angles {
        flex-wrap: wrap;
        padding-bottom: var(--space-1);
      }
      input[type='range'] {
        height: 44px;
      }
      /* Folded, the status line still speaks; it is simply not drawn, unless it is a failure. */
      .section-bar:not([data-expanded='true'], [data-failed]) .cut-status {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }
      .section-bar[data-shown][data-expanded='true'] .cut-status {
        padding-bottom: var(--space-2);
      }
      /* 16px, so a phone does not zoom the page into the field (phone.css:347). */
      .cut-number {
        font-size: var(--text-title);
      }
    }
    @media (pointer: coarse) {
      input[type='range'] {
        height: 44px;
      }
      .check {
        min-height: 44px;
      }
      input[type='range']::-webkit-slider-thumb {
        width: 20px;
        height: 20px;
        margin-top: -9px;
      }
      input[type='range']::-moz-range-thumb {
        width: 20px;
        height: 20px;
      }
    }
    /* At the narrowest phone widths, the position field keeps its spoken unit while the slider keeps room. */
    @media (max-width: 360px) {
      .section-bar[data-compact='true'] .cut-unit {
        display: none;
      }
    }
  }

  @layer a11y {
    @media (prefers-reduced-motion: reduce) {
      .stage-icon-button,
      .section-bar :global(.icon-button.cut-close) {
        transition-property: background-color, color;
      }
      .stage-icon-button:active {
        transform: none;
      }
    }
    @media (forced-colors: active) {
      .cut-number:focus-visible {
        outline: 2px solid Highlight;
      }
      .cut-number[aria-invalid='true'] {
        border-color: CanvasText;
        border-width: 2px;
      }
      /* A transparent track is forced to nothing; the track and thumb keep system colours of their own. */
      input[type='range'] {
        forced-color-adjust: none;
      }
      input[type='range']::-webkit-slider-runnable-track {
        background: CanvasText;
      }
      input[type='range']::-moz-range-track {
        background: CanvasText;
      }
      input[type='range']::-webkit-slider-thumb {
        background: Canvas;
        border-color: CanvasText;
      }
      input[type='range']::-moz-range-thumb {
        background: Canvas;
        border-color: CanvasText;
      }
      input[type='range']:focus-visible {
        outline: 2px solid Highlight;
      }
      /* The tick would be forced to ink on every box, checked or not: the system control draws itself. */
      input[type='checkbox'] {
        appearance: auto;
        background: Canvas;
        border-color: CanvasText;
      }
      input[type='checkbox']::before {
        content: none;
      }
    }
  }
</style>
