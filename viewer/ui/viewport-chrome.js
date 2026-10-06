import { edgeLabels, localizeEdges } from '../render/orientation.js';
import { scaleBar } from '../render/scale-bar.js';
import { PHONE_QUERY } from '../render/device.js';
import { FRAME_FILL } from '../render/camera-views.js';
import { clearFraming } from '../render/effective-viewport.js';
import { networkCss, networkName } from '../catalog/networks.js';
import { t } from '../i18n/translations.js';
import { isIndependentTractReference } from '../diffusion/presentation.js';
import { createStagePopovers, dockArrangement } from './stage-tools.js';
import { bindRoving } from './roving.js';
import { decimal } from './format.js';
import { subjectName } from './header.js';
import { SNAPSHOT_LAYOUT, annotateSnapshot, snapshotCaption, snapshotFonts } from './snapshot.js';

const VIEW_KEYS = ['oblique', 'left', 'right', 'anterior', 'posterior', 'superior', 'inferior'];

/** Both margins plus the least gap allowed between the dock and the scale bar. */
const CHROME_GUTTERS_PX = 48;

/** Space kept between a marking and the anatomy, so its halo never sits on tissue. */
const MARKING_GAP_PX = 8;

/** Room the top orientation letter and its gap take from a hint that would reach it. */
const TOP_LETTER_ROOM_PX = 20;

/** Keys that move the camera while the canvas has focus. */
const CAMERA_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-']);

/** How far the camera must move during a gesture before it has left the preset. */
const MOVED_EPSILON = 1e-6;

/** The reader has rotated or clicked the model once; the drag-and-scroll hint stays retired. */
const HINT_STORAGE_KEY = 'neuroatlas.stage-hint';

function hintRetired() {
  try { return globalThis.localStorage?.getItem(HINT_STORAGE_KEY) === 'retired'; } catch { return false; }
}
function retireHint() {
  try { globalThis.localStorage?.setItem(HINT_STORAGE_KEY, 'retired'); } catch { /* Storage blocked: the hint returns next visit. */ }
}

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
 * the stage dock and its popovers, the colour keys, the hover label, and
 * the loading and error stage.
 */
export function createViewportChrome({ networks, onView, onRetry, onSnapshot, onDock, controls }) {
  const orientation = document.getElementById('orientation');
  const edges = Object.fromEntries(
    [...orientation.children].map(node => [node.dataset.edge, node]));
  const views = document.getElementById('views');
  const toolbar = document.getElementById('stage-toolbar');
  const separator = toolbar.querySelector('.stage-toolbar-sep');
  const dock = document.getElementById('stage-dock');
  const sectionBar = document.getElementById('section-bar');
  const sectionRow = sectionBar.querySelector('.section-bar-row');
  const sectionToolLabel = document.getElementById('section-tool-label');
  const viewTool = document.getElementById('view-tool');
  const viewToolLabel = document.getElementById('view-tool-label');
  const viewPopover = document.getElementById('view-popover');
  const viewPopoverLabel = document.getElementById('view-popover-label');
  const displayToolLabel = document.getElementById('display-tool-label');
  const bar = document.getElementById('scale-bar');
  const barRule = bar.querySelector('.scale-bar-rule');
  const barText = bar.querySelector('.measure');
  const hover = document.getElementById('hover-label');
  const legend = document.getElementById('network-legend');
  const directionKey = document.getElementById('direction-key');
  const host = document.getElementById('viewport');
  const help = document.getElementById('viewport-help');
  const focusHint = document.getElementById('viewport-focus-hint');
  const fullscreenButton = document.getElementById('viewport-fullscreen');
  const snapshotButton = document.getElementById('viewport-snapshot');
  const stageMessage = document.getElementById('stage-message');
  const stageProgress = document.getElementById('stage-progress');
  const retry = document.getElementById('stage-retry');
  const phone = globalThis.matchMedia?.(PHONE_QUERY);
  let currentLang = 'en';
  let lastState = null;
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

  let stageGutter = null;
  const gutter = () => {
    stageGutter ??= parseFloat(getComputedStyle(host).getPropertyValue('--stage-gutter')) || 16;
    return stageGutter;
  };

  /*
   * The dock's natural widths: the tools with the presets inline, and the section bar's first
   * row with every control beside the slider. Read in one forced layout, and only when the words
   * or the tools on show change, never on a resize or a sheet drag.
   */
  let needs = null;
  let needsKey = '';
  function dockNeeds() {
    const key = [currentLang, [...toolbar.children].map(node => Number(node.hidden)).join(''),
      sectionBar.hidden, sectionBar.dataset.pending, sectionRow.textContent].join('|');
    if (needs && key === needsKey) return needs;
    needsKey = key;
    const compact = sectionBar.dataset.compact;
    let probe = null;
    if (views.parentElement !== toolbar) {
      probe = views.cloneNode(true);
      probe.removeAttribute('id');
      separator.before(probe);
    }
    delete sectionBar.dataset.compact;
    dock.dataset.measure = 'true';
    const style = getComputedStyle(dock);
    const frame = parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
    needs = { tools: toolbar.offsetWidth + frame, section: sectionBar.hidden ? 0 : sectionBar.offsetWidth + frame };
    delete dock.dataset.measure;
    if (compact !== undefined) sectionBar.dataset.compact = compact;
    probe?.remove();
    return needs;
  }

  // Seven presets beside two tools need room; where there is none they open from View ▾.
  function seatPresets(menu) {
    const mode = menu ? 'menu' : 'inline';
    if (host.dataset.presets !== mode) host.dataset.presets = mode;
    const home = menu ? viewPopover : toolbar;
    if (views.parentElement === home) return;
    const hadFocus = views.contains(document.activeElement);
    if (popovers.open === viewPopover.id) popovers.hide();
    if (menu) viewPopover.append(views); else separator.before(views);
    roving.sync();
    if (hadFocus) (menu ? viewTool : views.querySelector('[tabindex="0"]'))?.focus({ preventScroll: true });
  }

  /** Presets inline or in View ▾, and the section bar whole or behind its disclosure, by measured room. */
  function fitDockLayout() {
    if (!lastRect?.width) return;
    const onPhone = phone?.matches ?? false;
    const { menu, compact } = dockArrangement({
      room: lastRect.width - 2 * gutter(),
      needs: onPhone ? null : dockNeeds(),
    });
    seatPresets(menu);
    if (sectionBar.dataset.compact !== String(compact)) sectionBar.dataset.compact = String(compact);
  }

  /*
   * The bar's width is its rule, which is set here, plus a label from a short
   * fixed list. The label part is read once per label, so a fit during a sheet
   * drag — which has just moved the chrome — does not force a layout.
   */
  const labelWidths = new Map();
  let barWidth = 0;
  let dockWidth = 0;

  /** Do the dock and the scale bar still fit on one line of the rectangle the reader can see? */
  function fitChrome() {
    if (!lastRect?.width) return;
    const needed = dockWidth + (bar.hidden ? 0 : barWidth) + CHROME_GUTTERS_PX;
    let mode = needed > lastRect.width ? 'tight' : 'wide';
    // Raised beside the bottom letter, a bar reaching the middle would read as part of it.
    if (mode === 'tight' && barWidth > lastRect.width / 2 - CHROME_GUTTERS_PX) mode = 'stacked';
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
    ? new ResizeObserver(([entry]) => {
      const box = entry.borderBoxSize?.[0];
      dockHeight = Math.round(box?.blockSize ?? dock.offsetHeight);
      dockWidth = Math.round(box?.inlineSize ?? dock.offsetWidth);
      fitDock();
      fitChrome();
      onDock?.();
    })
    : null;
  dockObserver?.observe(dock);
  // The section bar's plane, words and readiness change outside the state loop; refit before paint.
  const sectionObserver = globalThis.MutationObserver ? new MutationObserver(fitDockLayout) : null;
  sectionObserver?.observe(sectionBar, {
    attributes: true, attributeFilter: ['hidden', 'data-pending'], subtree: true, childList: true, characterData: true,
  });

  const sheetRaised = () => phone?.matches && document.getElementById('sheet')?.dataset.detent === 'full';

  /** How far up from the visible bottom the dock reaches; zero while a raised phone sheet hides it. */
  function dockReach() {
    if (sheetRaised()) return 0;
    const measured = Math.round(dock.offsetHeight);
    if (measured !== dockHeight) {
      dockHeight = measured;
      fitDock();
    }
    return dockHeight + gutter();
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
    const text = `${decimal(scale.millimetres, 1, currentLang, { trim: true })} mm`;
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
   * The hints sit at the top left and never reach the top letter: on a stage too narrow for
   * one line beside it, a hint is not drawn. Widths are read once per wording.
   */
  const hintWidths = new Map();
  function fitHints() {
    if (!lastRect?.width) return;
    const room = lastRect.width / 2 - gutter() - TOP_LETTER_ROOM_PX;
    for (const node of [help, focusHint]) {
      const text = node.textContent;
      if (!hintWidths.has(text)) hintWidths.set(text, node.offsetWidth);
      const fits = String(hintWidths.get(text) <= room);
      if (node.dataset.room !== fits) node.dataset.room = fits;
    }
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
    views.append(button);
    return button;
  });
  const roving = bindRoving(views);

  /** View ▾ names the view the camera holds, so the chooser reads like the inline presets. */
  function paintViewTool() {
    const copy = t(currentLang, 'viewport');
    const name = held && currentView ? t(currentLang, 'views')[currentView] : null;
    const label = name ?? copy.viewTool;
    if (viewToolLabel.textContent !== label) viewToolLabel.textContent = label;
    viewTool.setAttribute('aria-label', name ? copy.viewToolAria(name) : copy.viewAria);
  }

  function paintPresets() {
    const pressed = held ? currentView : null;
    for (const button of buttons) {
      const value = String(button.dataset.view === pressed);
      if (button.getAttribute('aria-pressed') !== value) button.setAttribute('aria-pressed', value);
    }
    roving.sync();
    paintViewTool();
  }

  const onPhoneChange = () => fitDockLayout();
  phone?.addEventListener('change', onPhoneChange);
  // Widths measured in a fallback face are wrong once Source Sans arrives.
  const onFontsLoaded = () => {
    needs = null;
    hintWidths.clear();
    labelWidths.clear();
    fitDockLayout();
    fitHints();
  };
  document.fonts?.addEventListener('loadingdone', onFontsLoaded);

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
    dismissHelp();
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

  // Once the reader has moved or clicked the model, the instruction has done its work, for good.
  function dismissHelp() {
    if (help.dataset.dismissed === 'true') return;
    help.dataset.dismissed = 'true';
    retireHint();
    host.removeEventListener('pointerdown', onCanvasGesture);
    host.removeEventListener('wheel', onCanvasGesture);
  }
  const onCanvasGesture = event => {
    if (event.target.tagName === 'CANVAS') dismissHelp();
  };
  const onCanvasKey = event => {
    if (event.target.tagName !== 'CANVAS' || !CAMERA_KEYS.has(event.key)) return;
    dismissHelp();
    releaseView();
  };
  if (hintRetired()) help.dataset.dismissed = 'true';
  else {
    host.addEventListener('pointerdown', onCanvasGesture);
    host.addEventListener('wheel', onCanvasGesture, { passive: true });
  }
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

  /*
   * The markings as the reader sees them, in CSS pixels of the visible stage: the letters where
   * they are drawn, the scale bar's rule and words, and any colour key's plate.
   */
  function snapshotMarkings(crop) {
    const origin = host.getBoundingClientRect();
    const local = node => {
      const r = node.getBoundingClientRect();
      return { x: r.left - origin.left - crop.x, y: r.top - origin.top - crop.y, width: r.width, height: r.height };
    };
    const { gutter: margin, line } = SNAPSHOT_LAYOUT;
    const letters = orientation.hidden ? [] : Object.entries(edges).map(([edge, node]) => {
      const box = local(node);
      const spot = { edge, text: node.textContent, x: box.x + box.width / 2, y: box.y + box.height / 2 };
      // Without the dock the top letter needs no room under a phone's scale bar.
      if (edge === 'top') spot.y = 12 + line / 2;
      // Hidden over a tall dock; on the image it keeps the line above the statement.
      if (edge === 'bottom' && host.dataset.dockTall === 'true') {
        Object.assign(spot, { x: crop.width / 2, y: crop.height - margin - line * 2 });
      }
      return spot;
    });
    const keys = [...host.querySelectorAll('.stage-key')].filter(node => !node.hidden).map(node => ({
      box: local(node),
      swatches: [...node.querySelectorAll('.network-swatch')].map(swatch => {
        const style = getComputedStyle(swatch);
        return { ...local(swatch), color: style.backgroundColor, radius: parseFloat(style.borderTopLeftRadius) || 0 };
      }),
      texts: [...node.querySelectorAll('li > span:not(.network-swatch), .stage-key-title')].map(word => {
        const box = local(word);
        const style = getComputedStyle(word);
        return { text: word.textContent, x: box.x, y: box.y + box.height / 2, color: style.color,
          font: `${style.fontWeight} ${style.fontSize} ${style.fontFamily}` };
      }),
    }));
    const scaleShown = !bar.hidden && scale;
    return {
      letters, keys,
      scale: scaleShown ? { pixels: Math.round(scale.pixels), label: barText.textContent } : null,
    };
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
      fitDockLayout();
      fitChrome();
      fitDock();
      fitHints();
      settlePopovers();
    },

    update(state, { directionKey: showKey = false } = {}) {
      currentLang = state.lang;
      lastState = state;
      const selected = state.selectedRegion?.id ?? null;
      if (state.status === 'ready' && firstSelection === undefined) firstSelection = selected;
      else if (selected && firstSelection !== undefined && selected !== firstSelection) dismissHelp();
      currentView = state.view;
      const i18nViewport = t(state.lang, 'viewport');
      // The tract reference has no regions to click.
      help.textContent = isIndependentTractReference(state)
        ? i18nViewport.navigationHintTracts : i18nViewport.navigationHint;
      focusHint.textContent = i18nViewport.keyboardHint;
      const viewLabels = t(state.lang, 'views');
      views.setAttribute('aria-label', i18nViewport.viewAria);
      viewPopoverLabel.textContent = i18nViewport.viewAria;
      sectionToolLabel.textContent = i18nViewport.sectionTool;
      displayToolLabel.textContent = i18nViewport.displayTool;

      for (const button of buttons) {
        const label = viewLabels[button.dataset.view] ?? button.dataset.view;
        if (button.textContent !== label) button.textContent = label;
      }
      paintPresets();
      fitDockLayout();
      fitHints();
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

    /**
     * The visible stage as a PNG data URL that documents itself: the rendered frame from
     * `capture(crop)`, with the orientation letters, scale bar, colour key, a caption naming
     * subject, labels, colouring and view or section, and the not-clinical statement.
     */
    async snapshot(capture, { anatomy, section = null, referenceLabel = () => null } = {}) {
      if (!lastRect || !lastState) throw new Error('The stage has not been laid out yet.');
      const lang = currentLang;
      const reference = isIndependentTractReference(lastState) ? referenceLabel(lang) : null;
      const detail = document.getElementById('detail');
      const caption = snapshotCaption(lang, {
        subject: subjectName(anatomy),
        atlas: lastState.atlas,
        surfaceColor: lastState.surfaceColor,
        detail: detail && !detail.hidden ? lastState.detail : null,
        reference,
        view: held ? currentView : null,
        section: reference ? null : section,
      });
      const tokens = getComputedStyle(host);
      const token = name => tokens.getPropertyValue(name).trim();
      const crop = { x: lastRect.x, y: lastRect.y, width: lastRect.width, height: lastRect.height };
      const plan = {
        ...snapshotMarkings(crop),
        width: crop.width,
        height: crop.height,
        caption,
        statement: t(lang, 'viewport').snapshotStatement,
        fonts: { ui: token('--font-ui'), mono: token('--font-mono') },
        palette: {
          ink: token('--overlay-ink'), halo: token('--overlay-halo'), haloCore: token('--overlay-halo-core'),
          plate: token('--overlay-plate'), border: token('--overlay-border'),
        },
      };
      await snapshotFonts(plan);
      const { canvas, ratio } = capture(crop);
      return annotateSnapshot(canvas, { ...plan, ratio }).toDataURL('image/png');
    },

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
      sectionObserver?.disconnect();
      roving.dispose();
      phone?.removeEventListener('change', onPhoneChange);
      document.fonts?.removeEventListener('loadingdone', onFontsLoaded);
      popovers.dispose();
      snapshotButton?.removeEventListener('click', onSnapshotClick);
      fullscreenButton?.removeEventListener('click', onFullscreenClick);
      views.replaceChildren();
      legend.replaceChildren();
    },
  };
}
