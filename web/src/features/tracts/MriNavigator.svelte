<!--
  The diffusion MRI navigator (diffusion/navigation-ui.js, index.html:630-677): the reference T1
  and FA with the selected tracts, in NiiVue. The engine half is `engine.tracts.createMriNavigator`
  (E6/E7); this is the dialog around it. Opened from the tract explorer's MRI button (`open`);
  mounted only by an integration chunk (decision 0008). Native modal Dialog: trap, Escape, inert
  page, `data-instant` and focus return are U5's. It does not isolate keys (decision 7 on #4):
  the canvas keeps its arrows, and the page keymap is inert while this dialog is open.
  - NiiVue, its WebGL context and the volumes exist only while open; closing frees all three and
    the next open draws on a fresh canvas (a lost context stays bound to its canvas). A load that
    returns after a close disposes its own engine;
  - the canvas is a focusable `application` that owns six keys (deviations/t2-canvas-application.md);
  - status and failure are two persistent regions, and the readout is not live
    (deviations/t2-status-and-alert.md, deviations/t2-readout-not-live.md);
  - the voxel fields are one named group with their range (deviations/t2-voxel-group.md);
  - `M` follows the single-key preference (deviations/t2-shortcut-toggle.md); modified arrow keys
    are left to the browser (deviations/t2-key-modifiers.md);
  - Retry keeps focus on the page (deviations/t2-retry-focus.md); a lost WebGL context is shown
    and retried (deviations/t2-context-lost.md).
-->
<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { MediaQuery } from 'svelte/reactivity';
  import { reloadWithoutStoredModels } from '../../lib/core/assets/published-assets.ts';
  import { tractCatalog } from '../../lib/core/diffusion/catalogs.ts';
  import { diffusionErrorCode } from '../../lib/core/diffusion/validation.ts';
  import { decimal, percent, withUnit } from '../../lib/core/format.ts';
  import { diffusionError, mriReadout } from '../../lib/core/i18n/diffusion.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import type {
    Engine,
    MriLocation,
    MriNavigator,
    MriPlaneChoice,
    Vec3,
  } from '../../lib/engine/api.ts';
  import { COARSE_POINTER_QUERY, PHONE_DEVICE_QUERY } from '../../lib/types/index.ts';
  import type { Language } from '../../lib/types/index.ts';
  import Dialog from '../../lib/ui/Dialog.svelte';
  import RangeField from '../../lib/ui/RangeField.svelte';
  import Select from '../../lib/ui/Select.svelte';
  import StatusLine from '../../lib/ui/StatusLine.svelte';
  import { announce, createDebouncedAnnouncer } from '../../lib/ui/announcer.svelte.ts';

  interface Props {
    open?: boolean;
    instant?: boolean;
    engine: Pick<Engine, 'tracts'>;
    /** The anatomy on screen; the tracts' own anatomy, or CDMD's as a reference. */
    anatomy: string;
    lang: Language;
    /** The tract explorer's applied length filter in millimetres. */
    minimum: number;
    /** The reader has not turned single-key shortcuts off (WCAG 2.1.4). */
    singleKeys: boolean;
    /** The atlas crosshair in the scan's RAS millimetres, read once per opening; null when the
     * tracts are not its own anatomy or not loaded. */
    getPoint: () => Vec3 | null;
    /** The MRI crosshair moved: the atlas crosshair follows (RAS millimetres). */
    onPoint: (point: Vec3) => void;
    /** Takes focus on close when the opener is gone. */
    fallbackFocus?: () => HTMLElement | null;
  }

  let {
    open = $bindable(false),
    instant = $bindable(false),
    engine,
    anatomy,
    lang,
    minimum,
    singleKeys,
    getPoint,
    onPoint,
    fallbackFocus,
  }: Props = $props();

  const AXES = ['i', 'j', 'k'] as const;
  /** The canvas keys, as a step along the source voxel axes. */
  const MOVES: Readonly<Record<string, Vec3>> = {
    ArrowLeft: [-1, 0, 0],
    ArrowRight: [1, 0, 0],
    ArrowDown: [0, -1, 0],
    ArrowUp: [0, 1, 0],
    PageDown: [0, 0, -1],
    PageUp: [0, 0, 1],
  };

  const copy = $derived(t(lang, 'mri').dialog);
  const catalog = $derived(tractCatalog(anatomy));
  const dataset = $derived(catalog.text[lang]!);
  const map = $derived(catalog.maps[0]!);
  const hasFa = $derived(catalog.maps.length > 1);
  const files = $derived(catalog.maps.map((entry) => entry.file.split('/').pop()).join(' · '));
  const coarse = new MediaQuery(COARSE_POINTER_QUERY);

  // Plane, contrast and FA opacity are the reader's and outlive an opening, as the legacy
  // controls did; the phone default is read once.
  let plane = $state(matchMedia(PHONE_DEVICE_QUERY).matches ? 'AXIAL' : 'MULTIPLANAR');
  let windowWidth = $state(untrack(() => map.range[1] - map.range[0]));
  let level = $state(untrack(() => Math.round((map.range[0] + map.range[1]) / 2)));
  let fa = $state(0);

  let navigator = $state.raw<MriNavigator | null>(null);
  let busy = $state(false);
  let ready = $state(false);
  let lost = $state(false);
  let outside = $state(false);
  let failure = $state<{ error: unknown } | null>(null);
  let location = $state.raw<MriLocation | null>(null);
  let voxel = $state<(number | null)[]>([null, null, null]);
  let canvas = $state<HTMLCanvasElement>();
  let notes = $state<HTMLElement>();
  let root = $state<HTMLElement>();
  /** A fresh canvas per engine: a context that was lost stays bound to its canvas. */
  let canvasKey = $state(0);
  /** Counts openings and closings; a load that finds it changed was abandoned. */
  let session = 0;
  let active = false;
  /** The key that moved the crosshair is being handled: its result is said, not only drawn. */
  let keyMove = false;
  const moves = createDebouncedAnnouncer(200);

  const controlsOff = $derived(busy || !navigator || lost);
  const errorCode = $derived(failure && diffusionErrorCode(failure.error));
  const updated = $derived(errorCode === 'asset-updated');
  const showRetry = $derived(failure !== null && !busy);
  const statusText = $derived(
    busy ? copy.loading : outside ? copy.outside : ready ? copy.ready : '',
  );
  const planes = $derived([
    { value: 'MULTIPLANAR', label: copy.all },
    { value: 'AXIAL', label: copy.axial },
    { value: 'CORONAL', label: copy.coronal },
    { value: 'SAGITTAL', label: copy.sagittal },
    // "3D" is the name in every language.
    { value: 'RENDER', label: '3D' },
  ]);
  const dims = $derived(navigator ? navigator.header.dims.slice(1, 4) : null);
  const grid = $derived.by(() => {
    if (!navigator) return '';
    const spacing = navigator.header.pixDims
      .slice(1, 4)
      .map((value) => decimal(value, 2, lang, { trim: true }));
    return copy.grid(dims!, withUnit(spacing.join(' × '), 'mm', lang));
  });
  const readout = $derived(
    location
      ? mriReadout(location.mm, location.values[0]!.value, location.values[1]?.value, lang)
      : '',
  );
  const hint = $derived(
    coarse.current
      ? copy.hintTouch
      : [copy.hint, copy.hintKeys, singleKeys ? copy.hintClose : ''].filter(Boolean).join(' '),
  );

  const uid = $props.id();

  /** The error is for the console and the alert; the reader gets its code's sentence. */
  function report(error: unknown) {
    console.error(error);
    failure = { error };
  }

  /** An engine call at the UI boundary: a failure is shown, not thrown at the reader. */
  function run(action: () => void) {
    try {
      action();
      failure = null;
    } catch (error) {
      report(error);
    }
  }

  function updateLocation(next: MriLocation) {
    if (next.values.length !== catalog.maps.length) {
      throw new RangeError(
        `The MRI reported ${next.values.length} map values for ${catalog.maps.length} maps.`,
      );
    }
    location = next;
    if (!busy) outside = false;
    voxel = next.vox.map(Math.round);
    if (keyMove) {
      moves.say(mriReadout(next.mm, next.values[0]!.value, next.values[1]?.value, lang));
    }
    if (!busy && open) onPoint(next.mm);
  }

  async function load() {
    const mine = session;
    busy = true;
    failure = null;
    outside = false;
    ready = false;
    try {
      if (!navigator) {
        const created = await engine.tracts.createMriNavigator(canvas!, updateLocation);
        if (mine !== session) {
          created.dispose();
          return;
        }
        navigator = created;
        // Reopened, it resumes where the reader left it.
        created.setWindow(level, windowWidth);
        if (hasFa) created.setFaOpacity(fa);
        created.setVoxel(
          location
            ? (location.vox.map(Math.round) as unknown as Vec3)
            : (created.header.dims
                .slice(1, 4)
                .map((size) => Math.floor(size / 2)) as unknown as Vec3),
        );
      }
      const current = navigator;
      const point = getPoint();
      if (point) outside = !current.setScannerPoint(point);
      await current.syncTracts(
        engine.tracts
          .snapshot()
          .filter((bundle) => bundle.visible)
          .map((bundle) => bundle.id),
        minimum,
      );
      // Closed while the tracts were added.
      if (mine !== session) return;
      current.setPlane(plane as MriPlaneChoice);
      current.resize();
      ready = !lost;
    } catch (error) {
      if (mine === session) report(error);
      else console.error(error);
    } finally {
      if (mine === session) busy = false;
    }
  }

  function start() {
    session++;
    lost = false;
    void load();
  }

  /** Frees the GPU context and the volumes and hands the next opening a fresh canvas. */
  function release() {
    navigator?.dispose();
    navigator = null;
    canvasKey++;
  }

  function stop() {
    session++;
    busy = false;
    ready = false;
    release();
  }

  $effect(() => {
    const next = open;
    untrack(() => {
      if (next === active) return;
      active = next;
      if (next) start();
      else stop();
    });
  });
  $effect(() => () => {
    session++;
    navigator?.dispose();
    moves.dispose();
  });

  // The sticky header grows when its title wraps (200 % text, a narrow phone): the focus scroll
  // margin follows its measured height.
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

  // No library surfaces this: NiiVue and the legacy dialog left a blank canvas.
  $effect(() => {
    const target = canvas;
    if (!target) return;
    // Also while the first load runs: the load then ends with the failure shown and Retry offered.
    const onLost = () => {
      lost = true;
      report(new Error('The WebGL context of the MRI canvas was lost.'));
    };
    target.addEventListener('webglcontextlost', onLost);
    return () => target.removeEventListener('webglcontextlost', onLost);
  });

  async function retry() {
    if (updated) {
      await reloadWithoutStoredModels();
      return;
    }
    // Retry unmounts while it loads; focus would fall to the page.
    notes?.focus({ preventScroll: true });
    if (lost) {
      release();
      lost = false;
      await tick();
    }
    await load();
  }

  function onPlane(value: string) {
    run(() => navigator!.setPlane(value as MriPlaneChoice));
  }

  function submitVoxel(event: SubmitEvent) {
    event.preventDefault();
    const target = voxel as unknown as Vec3;
    run(() => navigator!.setVoxel([...target]));
    if (failure === null) announce(copy.moved(voxel as number[]));
  }

  function onCanvasKeydown(event: KeyboardEvent) {
    const move = MOVES[event.key];
    // Alt+Arrow is the browser's back and forward, and the screen reader's own keys use the rest.
    if (!move || controlsOff || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }
    event.preventDefault();
    keyMove = true;
    run(() => navigator!.moveVoxel(move));
    keyMove = false;
  }

  // `M` closes the dialog it opened (app.js:1948, navigation-ui.js:174).
  function onWindowKeydown(event: KeyboardEvent) {
    if (
      !open ||
      event.defaultPrevented ||
      !singleKeys ||
      event.key.toLowerCase() !== 'm' ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      (event.target as Element).matches('input, select, textarea, [contenteditable]')
    ) {
      return;
    }
    event.preventDefault();
    instant = true;
    open = false;
  }
</script>

<svelte:window onkeydown={onWindowKeydown} />

<Dialog bind:open bind:instant variant="imaging" {fallbackFocus} closeLabel={copy.close}>
  {#snippet heading(id)}
    <h2 {id}>{dataset.mriTitle}</h2>
  {/snippet}

  <div class="navigator" bind:this={root}>
    <p id="{uid}-hint" class="hint">{hint}</p>

    <div class="notes" tabindex="-1" bind:this={notes}>
      {#key lang}
        <StatusLine class="status{busy || outside ? '' : ' visually-hidden'}" text={statusText} />
      {/key}
      <p class="status alert" role="alert">
        {failure && errorCode ? diffusionError(lang, errorCode) : ''}
      </p>
    </div>
    {#if showRetry}
      <button type="button" class="retry" onclick={retry}>
        {updated ? t(lang, 'errors').reload : copy.retry}
      </button>
    {/if}

    <div class="toolbar">
      <label class="plane">
        <span>{copy.plane}</span>
        <Select options={planes} bind:value={plane} disabled={controlsOff} onchange={onPlane} />
      </label>
      <form class="position" onsubmit={submitVoxel}>
        <div role="group" aria-labelledby="{uid}-voxel" class="voxels">
          <span id="{uid}-voxel" class="voxel-title">{copy.voxel}</span>
          {#each AXES as axis, index (axis)}
            <span class="voxel">
              <label>
                <span aria-hidden="true">{axis}</span>
                <span class="visually-hidden">{copy.voxelName(axis)}</span>
                <input
                  type="number"
                  class="code"
                  min="0"
                  max={dims ? dims[index]! - 1 : undefined}
                  step="1"
                  required
                  disabled={controlsOff}
                  aria-describedby="{uid}-range-{axis}"
                  bind:value={voxel[index]}
                />
              </label>
              <span id="{uid}-range-{axis}" class="visually-hidden">
                {dims ? copy.range(dims[index]! - 1) : ''}
              </span>
            </span>
          {/each}
        </div>
        <button type="submit" disabled={controlsOff}>{copy.go}</button>
      </form>
    </div>

    <div class="canvas-box">
      {#key canvasKey}
        <!-- A canvas that owns six keys is an application widget (ARIA 1.2); every key it owns is
             also on the voxel form, and Tab leaves it. -->
        <!-- svelte-ignore a11y_no_interactive_element_to_noninteractive_role -->
        <canvas
          bind:this={canvas}
          role="application"
          aria-roledescription={copy.viewer}
          aria-label={dataset.mriCanvas}
          aria-describedby="{uid}-hint"
          tabindex={controlsOff ? -1 : 0}
          onkeydown={onCanvasKeydown}
        ></canvas>
      {/key}
    </div>
    <p class="readout measure">{readout}</p>

    <div class="display">
      <RangeField
        label={copy.window}
        value={windowWidth}
        min={1}
        max={map.range[1] - map.range[0]}
        step={1}
        format={(value) => decimal(value, 0, lang)}
        disabled={controlsOff}
        onchange={(value) => {
          windowWidth = value;
          run(() => navigator!.setWindow(level, windowWidth));
        }}
      />
      <RangeField
        label={copy.center}
        value={level}
        min={map.range[0]}
        max={map.range[1]}
        step={1}
        format={(value) => decimal(value, 0, lang)}
        disabled={controlsOff}
        onchange={(value) => {
          level = value;
          run(() => navigator!.setWindow(level, windowWidth));
        }}
      />
      {#if hasFa}
        <RangeField
          label={copy.faOpacity}
          value={fa}
          min={0}
          max={1}
          step={0.05}
          format={(value) => percent(value, lang)}
          disabled={controlsOff}
          onchange={(value) => {
            fa = value;
            run(() => navigator!.setFaOpacity(fa));
          }}
        />
      {/if}
    </div>

    <div class="footnotes">
      <p class="measure">{grid}</p>
      <p class="code" lang="en">{files}</p>
      <p>{dataset.mriScope}</p>
    </div>
  </div>
</Dialog>

<style>
  @layer components {
    /* dialogs.css:205-251 */
    .navigator {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--space-3);
      margin-top: var(--space-3);
      min-width: 0;
    }
    .navigator :global(:is(button, input, select, canvas)) {
      /* The sticky header must not cover what a keyboard puts in view (WCAG 2.4.11). */
      scroll-margin-top: calc(var(--header-clearance, var(--header-height)) + var(--space-2));
    }
    .hint,
    .footnotes > p {
      max-width: 72ch;
      text-wrap: pretty;
    }
    .hint {
      color: var(--text-secondary);
    }
    .notes {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--space-1);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
    }
    .notes p {
      margin: 0;
    }
    .notes :global(.status.visually-hidden) {
      position: absolute;
    }
    .alert {
      color: var(--danger);
    }
    /* Present before it has text (ARIA19), but with no room of its own. */
    .alert:empty {
      position: absolute;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3) var(--space-6);
    }
    .plane,
    .voxel-title {
      font-size: var(--text-ui);
      font-weight: 500;
      color: var(--text-secondary);
    }
    .plane {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      max-width: 100%;
    }
    .plane :global(select) {
      flex: 0 1 12rem;
      width: 12rem;
      min-width: 0;
      font-weight: 400;
      color: var(--text-primary);
    }
    .position,
    .voxels {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2) var(--space-3);
    }
    .voxel,
    .voxels label {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      color: var(--text-tertiary);
    }
    /* Voxel indices are typed and copied, so they take the code voice. */
    input[type='number'] {
      box-sizing: border-box;
      width: 5.5rem;
      height: var(--control-height);
      padding: 0 var(--space-2);
      border: 1px solid var(--border-control);
      border-radius: var(--radius-control);
      background: var(--surface-base);
      color: var(--text-primary);
    }
    input[type='number']:disabled {
      color: var(--text-tertiary);
      border-color: var(--border-subtle);
      background: var(--surface-sunken);
    }
    button {
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
    button:disabled {
      background: var(--surface-sunken);
      color: var(--text-tertiary);
      cursor: default;
    }
    .retry {
      justify-self: start;
    }
    .canvas-box {
      height: min(52dvh, 520px);
      min-height: 300px;
      overflow: hidden;
      border-radius: var(--radius-mark);
      background: var(--scene-background);
    }
    canvas {
      display: block;
      width: 100%;
      height: 100%;
      touch-action: none;
    }
    /* The box clips what is outside it, so the ring is drawn inside (WCAG 2.4.7). */
    canvas:focus-visible {
      outline-offset: -2px;
    }
    .readout {
      margin: 0;
    }
    .display {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--space-4) var(--space-6);
    }
    .footnotes {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      overflow-wrap: anywhere;
      gap: var(--space-1);
      padding-top: var(--space-3);
      border-top: 1px solid var(--border-subtle);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
    }
    .footnotes p {
      margin: 0;
    }
    @media (hover: hover) and (pointer: fine) {
      button:hover:not(:disabled) {
        background: var(--surface-tonal-hover);
      }
      input[type='number']:hover:not(:disabled) {
        border-color: var(--text-secondary);
      }
    }
    /* Fingers get 44 px wherever the window is (WCAG 2.5.5; the phone query alone misses a tablet). */
    @media (pointer: coarse) {
      .navigator {
        --control-height: 44px;
      }
    }
    @media (max-width: 700px) {
      .display {
        grid-template-columns: 1fr;
      }
    }
    /* The phone layout (PHONE_QUERY; dialogs.css:262-282). */
    @media (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      .navigator {
        --text-tertiary: var(--text-secondary);
        --border-control: var(--text-primary);
      }
      button:not(:disabled) {
        border-color: var(--border-control);
      }
    }
  }

  @layer a11y {
    @media (prefers-contrast: more) {
      button:not(:disabled) {
        border-color: var(--border-control);
      }
    }
  }
</style>
