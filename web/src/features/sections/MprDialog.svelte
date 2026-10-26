<!--
  The Linked MRI dialog (ui/chrome/sections.js:264-408, 413-470, 528-588, index.html:600-633): the
  three source-grid planes through the shared crosshair, a window and level, and the segmentation
  overlay. Opened by G4's Linked MRI button, `M` and the region inspector through S3's
  `openLinkedMri` (which loads the scan), or by a lesson; mounted only by an integration chunk.
  Native modal Dialog: trap, Escape, inert page, `data-instant` and focus return are U5's.
  It does not isolate keys (decision on #4): the page keymap's `closeMpr` port closes it with `M`.
  - the pictures are `canvas role=img`, not focusable and without key handlers; the plane's
    slider is the keyboard route (deviations/g5-canvas-not-interactive.md);
  - a phone shows one plane at a time, chosen by a radio group, in one column
    (deviations/g5-plane-radio.md, g5-plane-layout.md); each plane is a named section whose heading
    stays for assistive technology (g5-panel-names.md);
  - the readout is said through the dialog's one live region after the crosshair has rested
    (g5-outputs-not-live.md, g5-unlabelled-sample.md); Save PNG is named by its plane and confirmed
    (g5-save-names.md, g5-save-announce.md); the wheel leaves Ctrl and Meta to the browser's zoom
    (g5-wheel-modifiers.md).
-->
<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { on } from 'svelte/events';
  import { MediaQuery } from 'svelte/reactivity';
  import { decimal, formatRas, millimetres } from '../../lib/core/format.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import type { EngineSections, MprPlane, SectionsState } from '../../lib/engine/api.ts';
  import { PHONE_QUERY } from '../../lib/types/index.ts';
  import type { Language, ManifestAnatomy } from '../../lib/types/index.ts';
  import ChoiceGroup from '../../lib/ui/ChoiceGroup.svelte';
  import Dialog from '../../lib/ui/Dialog.svelte';
  import RangeField from '../../lib/ui/RangeField.svelte';
  import StatusLine from '../../lib/ui/StatusLine.svelte';
  import type { MprDialogController } from './mpr-dialog.svelte.ts';
  import { AXES, COORDINATE_LIMIT, PLANES, drawPanel } from './mpr-draw.ts';
  import {
    canvasName,
    planeName,
    pngFileName,
    positionLabel,
    readoutText,
    saveSuffix,
    savedAnnouncement,
  } from './mpr-words.ts';

  interface Props {
    mpr: MprDialogController;
    engine: {
      sections: Pick<EngineSections, 'display' | 'sample' | 'mprFrame' | 'pixels'>;
    };
    /** The sections' display snapshot, replaced on every engine `change` (S1's engine sync). */
    engineState: { readonly sections: SectionsState };
    lang: Language;
    anatomy: Pick<ManifestAnatomy, 'subject' | 'individual'>;
    /** Takes focus on close when the opener is gone. */
    fallbackFocus?: () => HTMLElement | null;
  }

  let { mpr, engine, engineState, lang, anatomy, fallbackFocus }: Props = $props();

  /** The readout waits for the crosshair to rest, so a drag or a held key is not said per step. */
  const READOUT_QUIET_MS = 250;

  const uid = $props.id();
  const copy = $derived(t(lang, 'mpr'));
  const phone = new MediaQuery(PHONE_QUERY);
  // The dialog's one live region. The page's announcer is outside the modal dialog, so inert while it
  // is open; this one is inside.
  let said = $state('');
  let quiet: ReturnType<typeof setTimeout> | undefined;

  let root = $state<HTMLElement>();
  const canvases: Partial<Record<MprPlane, HTMLCanvasElement>> = {};

  const crosshair = $derived(engineState.sections.crosshair);
  // The engine's getters are not reactive: they are read again with every new snapshot.
  const reading = $derived.by(() => {
    void engineState.sections;
    if (!mpr.open) return null;
    const display = engine.sections.display;
    if (!display) throw new Error('The linked MRI dialog opened before the scan loaded.');
    return { display, sample: engine.sections.sample(crosshair) };
  });
  const visible = $derived(PLANES.filter((plane) => !phone.current || plane === mpr.plane));
  const readout = $derived(
    reading ? readoutText(formatRas(crosshair, lang), reading.sample, lang) : '',
  );
  // A string, so an unrelated engine change does not resample three planes (sections.js:562-564).
  const imageKey = $derived(
    reading &&
      JSON.stringify([
        crosshair,
        engineState.sections.overlay,
        reading.display.windowCenter,
        reading.display.windowWidth,
        lang,
        visible,
      ]),
  );

  // A plane nobody can see is not resampled; it is drawn when it is shown (sections.js:315-351).
  $effect(() => {
    if (imageKey === null) return;
    untrack(() => {
      const { display } = reading!;
      for (const plane of visible) {
        const frame = engine.sections.mprFrame(plane);
        drawPanel(canvases[plane]!, {
          plane,
          frame,
          pixels: engine.sections.pixels(frame),
          size: display.size,
          fieldOfView: display.fieldOfView,
          crosshair,
          lang,
        });
      }
    });
  });

  // Opening says nothing (the dialog's name does); a later change of what is under the crosshair is
  // said once it has rested.
  let spoken: string | null = null;
  $effect(() => {
    const text = readout;
    clearTimeout(quiet);
    if (!mpr.open) {
      spoken = null;
      said = '';
      return;
    }
    if (spoken !== null && text !== spoken)
      quiet = setTimeout(() => (said = text), READOUT_QUIET_MS);
    spoken = text;
  });
  $effect(() => () => clearTimeout(quiet));

  // The sticky header grows when its title wraps (200 % text, a narrow phone): the focus scroll
  // margin follows its measured height (WCAG 2.4.11).
  $effect(() => {
    const header = root?.closest('dialog')?.querySelector('.dialog-header');
    if (!root || !header) return;
    const target = root;
    const observer = new ResizeObserver(() =>
      target.style.setProperty('--header-clearance', `${header.getBoundingClientRect().height}px`),
    );
    observer.observe(header);
    return () => observer.disconnect();
  });

  // Focus inside what the viewport change removes goes to what replaces it: a plane that becomes
  // hidden hands it to the radio group; the radio group going hands it to the plane's slider.
  let handOff: 'radio' | 'slider' | null = null;
  $effect.pre(() => {
    const isPhone = phone.current;
    const shown = mpr.plane;
    untrack(() => {
      const focused = document.activeElement;
      if (!root?.contains(focused)) return;
      const inPlane = (focused as Element).closest<HTMLElement>('.plane');
      if (isPhone && inPlane && inPlane.dataset.plane !== shown) handOff = 'radio';
      else if (!isPhone && (focused as Element).closest('[role="radiogroup"]')) handOff = 'slider';
    });
  });
  $effect(() => {
    void phone.current;
    void mpr.plane;
    if (!handOff) return;
    const target = handOff;
    handOff = null;
    void tick().then(() => {
      const next =
        target === 'radio'
          ? root?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')
          : root?.querySelector<HTMLElement>(
              `.plane[data-plane="${mpr.plane}"] input[type="range"]`,
            );
      next?.focus();
    });
  });

  /** Pointer shortcuts on a picture: a click places the crosshair, the wheel scrolls the slice. The
   * keyboard route is the plane's slider (deviations/g5-canvas-not-interactive.md). */
  function pointer(plane: MprPlane) {
    return (canvas: HTMLCanvasElement) => {
      const stops = [
        on(canvas, 'click', (event) => {
          const rect = canvas.getBoundingClientRect();
          mpr.place(
            plane,
            (event.clientX - rect.left) / rect.width,
            (event.clientY - rect.top) / rect.height,
          );
        }),
        // Not passive: a wheel that moves the slice must not also scroll the page.
        on(
          canvas,
          'wheel',
          (event) => {
            // Ctrl and Meta with the wheel are the browser's zoom (deviations/g5-wheel-modifiers.md).
            if (event.ctrlKey || event.metaKey) return;
            if (mpr.wheel(plane, event.deltaY)) event.preventDefault();
          },
          { passive: false },
        ),
      ];
      return () => stops.forEach((stop) => stop());
    };
  }

  async function save(plane: MprPlane) {
    const link = document.createElement('a');
    link.download = pngFileName(anatomy.subject, plane, crosshair[AXES[plane]]);
    link.href = canvases[plane]!.toDataURL('image/png');
    link.click();
    // The same sentence again must change the region to be spoken again.
    clearTimeout(quiet);
    said = '';
    await tick();
    said = savedAnnouncement(plane, lang);
  }
</script>

<Dialog
  bind:open={mpr.open}
  bind:instant={mpr.instant}
  variant="imaging"
  {fallbackFocus}
  closeLabel={copy.close}
>
  {#snippet heading(id)}
    <h2 {id}>{copy.title}</h2>
  {/snippet}

  <div class="mpr" bind:this={root}>
    {#if phone.current}
      <ChoiceGroup
        label={copy.planes}
        options={PLANES.map((plane) => ({ value: plane, label: planeName(plane, lang) }))}
        bind:value={mpr.plane}
      />
    {/if}

    <div class="grid">
      {#each PLANES as plane (plane)}
        <section
          class="plane"
          data-plane={plane}
          hidden={!visible.includes(plane)}
          aria-labelledby="{uid}-{plane}"
        >
          <h3 id="{uid}-{plane}">{planeName(plane, lang)}</h3>
          <!-- A picture of data is an image (ARIA 1.2 img; HTML-AAM allows it on canvas). -->
          <!-- svelte-ignore a11y_no_interactive_element_to_noninteractive_role -->
          <canvas
            role="img"
            width="512"
            height="512"
            aria-label={canvasName(plane, engine.sections.mprFrame(plane).edges, lang)}
            bind:this={canvases[plane]}
            {@attach pointer(plane)}
          ></canvas>
          <div class="position">
            <label for="{uid}-position-{plane}">{positionLabel(plane, lang)}</label>
            <output class="value" for="{uid}-position-{plane}" aria-hidden="true"
              >{millimetres(crosshair[AXES[plane]], lang)}</output
            >
            <input
              id="{uid}-position-{plane}"
              type="range"
              min={-COORDINATE_LIMIT}
              max={COORDINATE_LIMIT}
              step="1"
              value={crosshair[AXES[plane]]}
              aria-valuetext={millimetres(crosshair[AXES[plane]], lang)}
              oninput={(event) => mpr.moveTo(plane, event.currentTarget.valueAsNumber)}
            />
          </div>
          <button
            type="button"
            class="save"
            aria-label={`${copy.savePng}${saveSuffix(plane, lang)}`}
            onclick={() => save(plane)}>{copy.savePng}</button
          >
        </section>
      {/each}
    </div>

    <p class="where measure">{readout}</p>
    <StatusLine class="visually-hidden" text={said} />

    <div class="display">
      <RangeField
        label={copy.contrastWindow}
        value={reading?.display.windowWidth ?? 0}
        min={10}
        max={256}
        step={1}
        format={(value) => decimal(value, 0, lang)}
        oninput={(width) => mpr.setWindow({ width })}
      />
      <RangeField
        label={copy.windowCenter}
        value={reading?.display.windowCenter ?? 0}
        min={0}
        max={255}
        step={1}
        format={(value) => decimal(value, 0, lang)}
        oninput={(center) => mpr.setWindow({ center })}
      />
      <label class="check">
        <input
          type="checkbox"
          checked={engineState.sections.overlay}
          onchange={(event) => mpr.setOverlay(event.currentTarget.checked)}
        />
        <span>{copy.segmentationOverlay}</span>
      </label>
    </div>

    <div class="note">
      <p>{copy.subtitle}</p>
      <p>{copy.note(anatomy)}</p>
    </div>
  </div>
</Dialog>

<style>
  @layer components {
    /* dialogs.css:135-204 */
    .mpr {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--space-4);
      margin-top: var(--space-4);
      min-width: 0;
    }
    .mpr :global(:is(button, input, canvas)) {
      /* The sticky header must not cover what a keyboard puts in view (WCAG 2.4.11). */
      scroll-margin-top: calc(var(--header-clearance, var(--header-height)) + var(--space-2));
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--space-4);
    }
    .plane {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      column-gap: var(--space-3);
      align-items: center;
      align-content: start;
    }
    .plane[hidden] {
      display: none;
    }
    h3 {
      grid-column: 1;
      grid-row: 1;
      margin: 0;
      font-size: var(--text-ui);
      font-weight: 600;
    }
    .save {
      grid-column: 2;
      grid-row: 1;
      justify-self: end;
      height: var(--space-8);
      padding: 0 var(--space-2);
      border: 1px solid transparent;
      border-radius: var(--radius-control);
      background: none;
      color: var(--text-secondary);
      font-size: var(--text-ui);
      font-weight: 500;
      line-height: var(--lh-ui);
      cursor: pointer;
    }
    canvas {
      grid-column: 1 / -1;
      grid-row: 2;
      display: block;
      width: 100%;
      height: auto;
      margin-top: var(--space-2);
      background: var(--mpr-canvas);
      border-radius: var(--radius-mark);
      cursor: crosshair;
    }
    /* The label, its value and the slider, as the legacy label wrapped them: the slider always shows
       the crosshair, which a RangeField holds back while it has focus. */
    .position {
      grid-column: 1 / -1;
      grid-row: 3;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: baseline;
      column-gap: var(--space-3);
      margin-top: var(--space-2);
      font-size: var(--text-ui);
    }
    .position label {
      font-weight: 500;
      color: var(--text-secondary);
    }
    .value {
      color: var(--text-tertiary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      font-variant-numeric: tabular-nums;
    }
    .position input {
      grid-column: 1 / -1;
      width: 100%;
      margin: var(--space-1) 0 0;
      accent-color: var(--accent);
      cursor: pointer;
    }
    @media (pointer: coarse) {
      .position input {
        height: 44px;
        margin: 0;
      }
    }
    /* The crosshair's position and label: a tonal readout, not a boxed field. */
    .where {
      margin: 0;
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-control);
      background: var(--surface-navigation);
      font-size: var(--text-ui);
      line-height: var(--lh-ui);
      overflow-wrap: anywhere;
    }
    .display {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: var(--space-2) var(--space-6);
      padding-top: var(--space-2);
    }
    .check {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-height: var(--control-height);
      font-size: var(--text-ui);
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
    .note {
      padding-top: var(--space-3);
      border-top: 1px solid var(--border-subtle);
    }
    .note > p {
      margin: 0;
      max-width: 72ch;
      text-wrap: pretty;
    }
    .note > p + p {
      margin-top: var(--space-1);
    }
    @media (hover: hover) and (pointer: fine) {
      .save:hover {
        background: var(--surface-hover);
        color: var(--text-primary);
      }
    }
    @media (pointer: coarse) {
      .save {
        height: 44px;
      }
    }
    @media (max-width: 700px) {
      .display {
        grid-template-columns: 1fr;
      }
    }
    /* The phone layout (PHONE_QUERY; dialogs.css:262-290): one plane, so one column, and the radio
       group names it, so its heading is kept for assistive technology and not drawn (g5-plane-layout.md,
       g5-panel-names.md). */
    @media (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      .grid {
        grid-template-columns: minmax(0, 1fr);
      }
      h3 {
        position: absolute;
        width: 1px;
        height: 1px;
        margin: -1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }
    }
  }

  @layer a11y {
    @media (prefers-contrast: more) {
      .mpr {
        --text-tertiary: var(--text-secondary);
        --border-control: var(--text-primary);
        --border-subtle: var(--border-control);
      }
    }
    @media (forced-colors: active) {
      .save:focus-visible,
      .position input:focus-visible,
      input[type='checkbox']:focus-visible {
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
