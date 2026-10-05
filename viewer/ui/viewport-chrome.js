import { edgeLabels, localizeEdges } from '../render/orientation.js';
import { scaleBar } from '../render/scale-bar.js';
import { PHONE_QUERY } from '../render/device.js';
import { FRAME_FILL } from '../render/camera-views.js';
import { clearFraming } from '../render/effective-viewport.js';
import { networkCss, networkName } from '../catalog/networks.js';
import { t } from '../i18n/translations.js';
import { isIndependentTractReference } from '../diffusion/presentation.js';
import { createStagePopovers, overflowCue, revealDelta } from './stage-tools.js';
import { bindRoving } from './roving.js';
import { decimal } from './format.js';

const VIEW_KEYS = ['oblique', 'left', 'right', 'anterior', 'posterior', 'superior', 'inferior'];

/** Both margins plus the least gap allowed between the toolbar and the bar. */
const CHROME_GUTTERS_PX = 48;

/** Space kept between a marking and the anatomy, so its halo never sits on tissue. */
const MARKING_GAP_PX = 8;

/** Keys that move the camera while the canvas has focus. */
const CAMERA_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-']);

/** How far the camera must move during a gesture before it has left the preset. */
const MOVED_EPSILON = 1e-6;

/** The fade on a clipped edge of the presets (stage.css), kept clear when one is revealed. */
const PRESET_FADE_PX = 32;

/**
 * The download's bar and its words. Called hundreds of times a load, so none
 * of it is a live region: the bar answers whoever asks, and the app speaks
 * only when the load starts, ends or fails.
 */
export function paintLoadProgress(lang, loaded, total) {
  const track = document.getElementById('stage-progress');
  const fill = document.getElementById('stage-bar');
  const line = document.getElementById('stage-message');
  const copy = t(lang, 'viewport');
  track.hidden = !total;
  track.setAttribute('aria-label', copy.progressAria);
  if (!total) {
    line.textContent = copy.loadingAnatomy;
    return;
  }
  const percent = String(Math.round((loaded / total) * 100));
  fill.style.width = `${percent}%`;
  if (track.getAttribute('aria-valuenow') !== percent) track.setAttribute('aria-valuenow', percent);
  line.textContent = copy.loadingWithTotal(loaded, total);
}

/**
 * Everything drawn over the canvas: anatomical orientation, the scale bar,
 * the stage toolbar and its popovers, the colour keys, the hover label, and
 * the loading and error stage.
 */
export function createViewportChrome({ networks, onView, onRetry, onSnapshot, onDock, controls }) {
  const orientation = document.getElementById('orientation');
  const edges = Object.fromEntries(
    [...orientation.children].map(node => [node.dataset.edge, node]));
  const views = document.getElementById('views');
  const toolbar = document.getElementById('stage-toolbar');
  const dock = document.getElementById('stage-dock');
  const sectionToolLabel = document.getElementById('section-tool-label');
  const viewToolLabel = document.getElementById('view-tool-label');
  const viewPopover = document.getElementById('view-popover');
  const displayToolLabel = document.getElementById('display-tool-label');
  const bar = document.getElementById('scale-bar');
  const barRule = bar.querySelector('.scale-bar-rule');
  const barText = bar.querySelector('.measure');
  const hover = document.getElementById('hover-label');
  const legend = document.getElementById('network-legend');
  const directionKey = document.getElementById('direction-key');
  const host = document.getElementById('viewport');
  const help = document.getElementById('viewport-help');
  const fullscreenButton = document.getElementById('viewport-fullscreen');
  const snapshotButton = document.getElementById('viewport-snapshot');
  const stageMessage = document.getElementById('stage-message');
  const stageProgress = document.getElementById('stage-progress');
  const retry = document.getElementById('stage-retry');
  const phone = globalThis.matchMedia?.(PHONE_QUERY);
  let currentLang = 'en';
  // The region selected when the stage first drew; a later selection means "click to inspect" was learned.
  let firstSelection;
  // Letters as of the last camera move. A language change re-words them; it never re-reads
  // a camera that a framing plan may have turned toward somewhere it has not gone yet.
  let cameraEdges = null;
  let lastRect = null;
  // The label's box is read from layout. Measuring it on every pointer move
  // forced a reflow for a chip that only changes size when its words do.
  let hoverBounds = null;
  let hoverSize = null;

  const popovers = createStagePopovers(host, {
    visibleRect: () => lastRect,
    fill: () => phone?.matches ?? false,
  });

  // Seven presets do not fit a phone's plate beside two tools, so there they open from View.
  function seatPresets() {
    const home = phone?.matches ? viewPopover : toolbar;
    if (views.parentElement === home) return;
    popovers.hide();
    if (home === toolbar) viewPopover.after(views); else viewPopover.append(views);
    cachedToolbarWidth = null;
    fitChrome();
  }

  /*
   * Do the toolbar and the scale bar still fit on one line? Asked of the
   * rectangle the reader can see, not the window. The presets scroll inside
   * the plate when it is capped, so their content width is what is measured.
   */
  let cachedToolbarWidth = null;
  let toolbarSignature = '';
  function toolbarWidth() {
    if (cachedToolbarWidth === null) {
      const style = getComputedStyle(toolbar);
      const spacing = ['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth']
        .reduce((total, property) => total + parseFloat(style[property]), 0);
      const items = [...toolbar.children].filter(node =>
        !node.hidden && getComputedStyle(node).position !== 'absolute' && getComputedStyle(node).display !== 'none');
      cachedToolbarWidth = items.reduce((total, node) =>
        total + (node === views ? views.scrollWidth : node.offsetWidth), 0)
        + spacing + parseFloat(style.columnGap || 0) * Math.max(0, items.length - 1);
    }
    return cachedToolbarWidth;
  }

  /*
   * The bar's width is its rule, which is set here, plus a label from a short
   * fixed list. The label part is read once per label, so a fit during a sheet
   * drag — which has just moved the chrome — does not force a layout.
   */
  const labelWidths = new Map();
  let barWidth = 0;

  function fitChrome() {
    if (!lastRect?.width) return;
    const needed = toolbarWidth() + (bar.hidden ? 0 : barWidth) + CHROME_GUTTERS_PX;
    const mode = needed > lastRect.width ? 'tight' : 'wide';
    if (host.dataset.chrome !== mode) host.dataset.chrome = mode;
  }

  // Orientation's bottom letter and a raised scale bar sit above whatever the dock holds.
  // Past the middle of a short stage the bottom letter would read as the top one, so it goes.
  let dockHeight = 0;
  function fitDock() {
    host.style.setProperty('--dock-height', `${dockHeight}px`);
    const tall = String(Boolean(lastRect?.height) && dockHeight + 64 > lastRect.height / 2);
    if (host.dataset.dockTall !== tall) host.dataset.dockTall = tall;
  }
  const dockObserver = globalThis.ResizeObserver
    ? new ResizeObserver(() => { dockHeight = Math.round(dock.offsetHeight); fitDock(); onDock?.(); })
    : null;
  dockObserver?.observe(dock);
  let stageGutter = null;

  const sheetRaised = () => phone?.matches && document.getElementById('sheet')?.dataset.detent === 'full';

  /** How far up from the visible bottom the dock reaches; zero while a raised phone sheet hides it. */
  function dockReach() {
    if (sheetRaised()) return 0;
    const measured = Math.round(dock.offsetHeight);
    if (measured !== dockHeight) {
      dockHeight = measured;
      fitDock();
    }
    stageGutter ??= parseFloat(getComputedStyle(host).getPropertyValue('--stage-gutter')) || 16;
    return dockHeight + stageGutter;
  }

  /*
   * The room the orientation letters and the scale bar take at each edge of the stage over the
   * dock, measured where they are drawn. Boxes are read even while a popover hides the markings:
   * framing runs as a preset closes the View popover, and the markings return with the picture.
   */
  function markingClearance(reach) {
    const clear = { top: 0, bottom: 0, left: 0, right: 0 };
    if (!lastRect || orientation.hidden || sheetRaised()) return clear;
    const origin = host.getBoundingClientRect();
    const top = lastRect.y;
    const floor = lastRect.y + lastRect.height - reach;
    const box = node => {
      const r = node.getBoundingClientRect();
      return { top: r.top - origin.top, bottom: r.bottom - origin.top, left: r.left - origin.left, right: r.right - origin.left };
    };
    const above = b => Math.max(0, b.bottom - top + MARKING_GAP_PX);
    const below = b => Math.max(0, floor - b.top + MARKING_GAP_PX);
    clear.top = above(box(edges.top));
    if (host.dataset.dockTall !== 'true') clear.bottom = below(box(edges.bottom));
    clear.left = Math.max(0, box(edges.left).right - lastRect.x + MARKING_GAP_PX);
    clear.right = Math.max(0, lastRect.x + lastRect.width - box(edges.right).left + MARKING_GAP_PX);
    if (!bar.hidden) {
      const b = box(bar);
      if ((b.top + b.bottom) / 2 < (top + floor) / 2) clear.top = Math.max(clear.top, above(b));
      else clear.bottom = Math.max(clear.bottom, below(b));
    }
    return clear;
  }

  /** The scene's framing inset and the scale for its fit, keeping anatomy clear of dock and markings. */
  function framing() {
    const reach = dockReach();
    if (!lastRect?.height) return { inset: reach, scale: { horizontal: 1, vertical: 1 } };
    return clearFraming(lastRect, reach, markingClearance(reach), FRAME_FILL);
  }

  /*
   * The key to the colours on the model. On the stage rather than in a panel:
   * a key that is not beside the picture it explains is not a key.
   */
  function showLegend(state) {
    legend.hidden = !networks || state.surfaceColor !== 'network'
      || !(state.status === 'ready' || state.status === 'switching');
    if (legend.hidden) return;
    legend.replaceChildren(...networks.networks.map(key => {
      const row = document.createElement('li');
      const swatch = document.createElement('span');
      swatch.className = 'network-swatch';
      swatch.style.background = networkCss(networks.colors[key]);
      const label = document.createElement('span');
      label.textContent = networkName(key, state.lang);
      row.append(swatch, label);
      return row;
    }));
  }

  let scale = null;
  function paintScale() {
    const wasHidden = bar.hidden;
    bar.hidden = !scale;
    if (!scale) {
      if (!wasHidden) fitChrome();
      return;
    }
    // The bar is as wide as the camera makes it, so the fit is asked again
    // whenever it changes, not only when it appears.
    const pixels = `${Math.round(scale.pixels)}px`;
    const text = `${decimal(scale.millimetres, 1, currentLang, { trim: true })}\u202fmm`;
    const changed = wasHidden || barRule.style.width !== pixels || barText.textContent !== text;
    if (barRule.style.width !== pixels) barRule.style.width = pixels;
    if (barText.textContent !== text) barText.textContent = text;
    if (!changed) return;
    if (!labelWidths.has(text)) labelWidths.set(text, bar.scrollWidth - Math.round(scale.pixels));
    barWidth = Math.round(scale.pixels) + labelWidths.get(text);
    fitChrome();
  }

  function paintEdges() {
    if (!cameraEdges) return;
    const labels = localizeEdges(cameraEdges, currentLang);
    for (const [edge, node] of Object.entries(edges)) {
      if (node.textContent !== labels[edge]) node.textContent = labels[edge];
    }
  }

  function showDirectionKey(visible, copy) {
    directionKey.hidden = !visible;
    if (!visible) return;
    document.getElementById('direction-key-title').textContent = copy.title;
    document.getElementById('direction-key-lr').textContent = copy.leftRight;
    document.getElementById('direction-key-ap').textContent = copy.anteriorPosterior;
    document.getElementById('direction-key-si').textContent = copy.superiorInferior;
  }

  /*
   * A preset reads as pressed only while the camera sits where that preset
   * put it. The session keeps the named view for the link either way.
   */
  let currentView = null;
  let held = false;

  const buttons = VIEW_KEYS.map(view => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.view = view;
    button.tabIndex = -1;
    button.addEventListener('click', () => {
      dismissHelp();
      onView(view);
    });
    button.addEventListener('focus', () => revealPreset(button));
    views.append(button);
    return button;
  });

  // A capped plate scrolls its presets; the clipped edge fades while more lies past it.
  function fitPresetCue() {
    const cue = overflowCue(views);
    if ((views.dataset.overflow ?? '') === cue) return;
    if (cue) views.dataset.overflow = cue; else delete views.dataset.overflow;
  }
  function revealPreset(button) {
    const delta = revealDelta(views.getBoundingClientRect(), button.getBoundingClientRect(), PRESET_FADE_PX);
    if (delta) views.scrollLeft += delta;
    fitPresetCue();
  }
  let shownPressed = -1;
  views.addEventListener('scroll', fitPresetCue, { passive: true });
  const presetObserver = globalThis.ResizeObserver
    ? new ResizeObserver(() => {
      fitPresetCue();
      if (shownPressed >= 0) revealPreset(buttons[shownPressed]);
    })
    : null;
  for (const node of [views, ...buttons]) presetObserver?.observe(node);
  const roving = bindRoving(views);
  seatPresets();
  phone?.addEventListener('change', seatPresets);

  function paintPresets() {
    const pressed = held ? currentView : null;
    const pressedIndex = buttons.findIndex(button => button.dataset.view === pressed);
    buttons.forEach((button, index) => {
      const value = String(index === pressedIndex);
      if (button.getAttribute('aria-pressed') !== value) button.setAttribute('aria-pressed', value);
    });
    roving.sync();
    if (pressedIndex >= 0 && pressedIndex !== shownPressed) revealPreset(buttons[pressedIndex]);
    shownPressed = pressedIndex;
  }

  function holdView() {
    held = true;
    watching = false;
    paintPresets();
  }
  function releaseView() {
    if (!held) return;
    held = false;
    paintPresets();
  }

  // A drag, pinch or wheel that actually moves the camera leaves the preset;
  // a click that selects a region does not.
  let watching = false;
  let watchTimer = null;
  let gestureFrom = null;
  const onGestureStart = () => {
    clearTimeout(watchTimer);
    watching = true;
    gestureFrom = { position: controls.object.position.clone(), target: controls.target.clone() };
  };
  const onGestureChange = () => {
    if (!watching) return;
    if (controls.object.position.distanceTo(gestureFrom.position) > MOVED_EPSILON
      || controls.target.distanceTo(gestureFrom.target) > MOVED_EPSILON) {
      watching = false;
      releaseView();
    }
  };
  // A wheel step reports its end before the camera moves on the next frame.
  const onGestureEnd = () => {
    clearTimeout(watchTimer);
    watchTimer = setTimeout(() => { watching = false; }, 250);
  };
  controls?.addEventListener('start', onGestureStart);
  controls?.addEventListener('change', onGestureChange);
  controls?.addEventListener('end', onGestureEnd);

  // Once the reader has moved the model by any means, the instruction has done its work.
  function dismissHelp() {
    if (help.dataset.dismissed === 'true') return;
    help.dataset.dismissed = 'true';
    host.removeEventListener('pointerdown', onCanvasGesture);
    host.removeEventListener('wheel', onCanvasGesture);
  }
  const onCanvasGesture = event => {
    if (event.target.tagName !== 'CANVAS') return;
    if (event.type !== 'keydown' || CAMERA_KEYS.has(event.key)) dismissHelp();
  };
  const onCanvasKey = event => {
    if (event.target.tagName !== 'CANVAS' || !CAMERA_KEYS.has(event.key)) return;
    dismissHelp();
    releaseView();
  };
  host.addEventListener('pointerdown', onCanvasGesture);
  host.addEventListener('wheel', onCanvasGesture, { passive: true });
  host.addEventListener('keydown', onCanvasKey);

  retry.addEventListener('click', onRetry);
  const onSnapshotClick = () => onSnapshot?.();
  snapshotButton?.addEventListener('click', onSnapshotClick);
  const onFullscreenClick = () => {
    if (!document.fullscreenElement) {
      host.requestFullscreen?.().catch(err => console.error('Fullscreen failed:', err));
    } else {
      document.exitFullscreen?.().catch(err => console.error('Exit fullscreen failed:', err));
    }
  };
  fullscreenButton?.addEventListener('click', onFullscreenClick);

  // A popover whose tool is gone, or whose dock the sheet has covered, closes.
  function settlePopovers() {
    if (!popovers.open) return;
    const button = host.querySelector(`[aria-controls="${popovers.open}"]`);
    if (!button?.checkVisibility?.({ visibilityProperty: true })) popovers.hide();
    else popovers.place();
  }

  return {
    /**
     * Place every overlay against the rectangle the reader can actually see.
     *
     * On a phone the sheet covers the lower canvas; markers pinned to the
     * canvas edge would sit behind it. `size` is the canvas's, when the
     * caller already knows it.
     */
    setViewport(rect, size = host.getBoundingClientRect()) {
      const { width, height } = size;
      if (!width || !height || !rect) return;
      if (lastRect && lastRect.x === rect.x && lastRect.y === rect.y &&
          lastRect.width === rect.width && lastRect.height === rect.height) {
        return;
      }
      lastRect = rect;
      hoverBounds = null;
      hoverSize = null;
      host.style.setProperty('--vis-top', `${Math.round(rect.y)}px`);
      host.style.setProperty('--vis-left', `${Math.round(rect.x)}px`);
      host.style.setProperty('--vis-right', `${Math.round(width - rect.x - rect.width)}px`);
      host.style.setProperty('--vis-bottom', `${Math.round(height - rect.y - rect.height)}px`);
      fitChrome();
      fitDock();
      settlePopovers();
    },

    update(state, { directionKey: showKey = false } = {}) {
      currentLang = state.lang;
      const selected = state.selectedRegion?.id ?? null;
      if (state.status === 'ready' && firstSelection === undefined) firstSelection = selected;
      else if (selected && firstSelection !== undefined && selected !== firstSelection) dismissHelp();
      currentView = state.view;
      const i18nViewport = t(state.lang, 'viewport');
      // The tract reference has no regions to click.
      help.textContent = isIndependentTractReference(state)
        ? i18nViewport.navigationHintTracts : i18nViewport.navigationHint;
      const viewLabels = t(state.lang, 'views');
      views.setAttribute('aria-label', i18nViewport.viewAria);
      sectionToolLabel.textContent = i18nViewport.sectionTool;
      viewToolLabel.textContent = i18nViewport.viewTool;
      displayToolLabel.textContent = i18nViewport.displayTool;

      for (const button of buttons) {
        const label = viewLabels[button.dataset.view] ?? button.dataset.view;
        if (button.textContent !== label) button.textContent = label;
      }
      paintPresets();
      // The toolbar is measured for the chrome layout, so new words or a tool
      // appearing or leaving invalidates that measure.
      const signature = `${state.lang}|${[...toolbar.children].map(node => Number(node.hidden)).join('')}`;
      if (signature !== toolbarSignature) {
        toolbarSignature = signature;
        cachedToolbarWidth = null;
        fitChrome();
      }
      showLegend(state);
      showDirectionKey(showKey, i18nViewport.directionKey);
      settlePopovers();
      const ready = state.status === 'ready' || state.status === 'switching';
      orientation.hidden = !ready;
      if (ready) paintScale(); else bar.hidden = true;
      if (snapshotButton) {
        snapshotButton.setAttribute('aria-label', i18nViewport.snapshot);
        snapshotButton.title = i18nViewport.snapshot;
        snapshotButton.disabled = !ready;
        const label = snapshotButton.querySelector('.masthead-action-label');
        if (label) label.textContent = i18nViewport.snapshot;
        const short = snapshotButton.querySelector('.masthead-action-short');
        if (short) short.textContent = i18nViewport.snapshotShort;
      }
      if (fullscreenButton) {
        fullscreenButton.setAttribute('aria-label', i18nViewport.fullscreen);
        fullscreenButton.title = i18nViewport.fullscreen;
        fullscreenButton.disabled = !ready;
        const label = fullscreenButton.querySelector('.masthead-action-label');
        if (label) label.textContent = i18nViewport.fullscreen;
        const short = fullscreenButton.querySelector('.masthead-action-short');
        if (short) short.textContent = i18nViewport.fullscreenShort;
      }

      paintEdges();

      if (state.status === 'context-lost') {
        stageMessage.textContent = state.error.message;
        stageProgress.hidden = true;
        retry.hidden = true;
        return;
      }
      if (state.status === 'error') {
        stageMessage.textContent = state.error?.message ?? i18nViewport.error;
        stageProgress.hidden = true;
        retry.hidden = false;
        retry.textContent = i18nViewport.retry;
        return;
      }
      retry.hidden = true;
      retry.textContent = i18nViewport.retry;
      if (state.status === 'loading') {
        const { loaded, total } = state.progress ?? {};
        paintLoadProgress(state.lang, loaded, total);
      }
    },

    dismissHelp,

    framing,

    /** The camera now sits where the session's named view puts it. */
    holdView,

    /** Whether the camera still sits on a named view. */
    get viewHeld() { return held; },

    /** The camera has been framed on something other than a preset. */
    releaseView,

    /** Called when the camera moves or the viewport resizes, outside the state loop. */
    updateCamera(camera, distance, viewportHeight) {
      // The chip named what was under the pointer before the move; the next pointer move renames it.
      hover.hidden = true;
      cameraEdges = edgeLabels(camera, 'en', controls?.target);
      paintEdges();
      scale = scaleBar(camera.fov, distance, viewportHeight);
      paintScale();
    },

    /**
     * Name what the pointer is over, beside the pointer.
     *
     * On the chip rather than in a rail: the reader is reading the cut face,
     * and a name that appears at the far edge of the screen is a name they
     * have to leave the anatomy to find.
     */
    showHover(label, position) {
      if (!label || !position) {
        hover.hidden = true;
        return;
      }
      hover.hidden = false;
      if (hover.textContent !== label) {
        hover.textContent = label;
        hoverSize = null;
      }
      if (!hoverBounds) hoverBounds = hover.parentElement.getBoundingClientRect();
      if (!hoverSize) hoverSize = { width: hover.offsetWidth, height: hover.offsetHeight };
      hover.style.left =
        `${Math.min(position.x + 14, hoverBounds.width - hoverSize.width - 8)}px`;
      hover.style.top =
        `${Math.min(position.y + 14, hoverBounds.height - hoverSize.height - 8)}px`;
    },

    dispose() {
      retry.removeEventListener('click', onRetry);
      host.removeEventListener('pointerdown', onCanvasGesture);
      host.removeEventListener('wheel', onCanvasGesture);
      host.removeEventListener('keydown', onCanvasKey);
      controls?.removeEventListener('start', onGestureStart);
      controls?.removeEventListener('change', onGestureChange);
      controls?.removeEventListener('end', onGestureEnd);
      clearTimeout(watchTimer);
      dockObserver?.disconnect();
      presetObserver?.disconnect();
      roving.dispose();
      phone?.removeEventListener('change', seatPresets);
      views.removeEventListener('scroll', fitPresetCue);
      popovers.dispose();
      snapshotButton?.removeEventListener('click', onSnapshotClick);
      fullscreenButton?.removeEventListener('click', onFullscreenClick);
      views.replaceChildren();
      legend.replaceChildren();
    },
  };
}
