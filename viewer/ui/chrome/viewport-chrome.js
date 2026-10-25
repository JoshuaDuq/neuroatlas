import { edgeLabels, localizeEdges } from '../../render/orientation.js';
import { scaleBar } from '../../render/scale-bar.js';
import { PHONE_QUERY, isCoarse } from '../../render/device.js';
import { FRAME_FILL } from '../../render/camera-views.js';
import { clearFraming } from '../../render/effective-viewport.js';
import { cabNpName, networkCss, networkName } from '../../catalog/networks.js';
import { functionalShortName } from '../../catalog/functional-regions.js';
import { t } from '../../i18n/translations.js';
import { failureNotice } from '../../i18n/errors.js';
import { isIndependentTractReference } from '../../diffusion/presentation.js';
import { compactSection, createStagePopovers } from './stage-tools.js';
import { bindRoving } from '../roving.js';
import { decimal, withUnit } from '../format.js';
import { subjectName } from './header.js';
import { SNAPSHOT_LAYOUT, annotateSnapshot, snapshotCaption, snapshotFonts } from './snapshot.js';

const VIEW_KEYS = ['oblique', 'left', 'right', 'anterior', 'posterior', 'superior', 'inferior'];

/** Both margins plus the least gap allowed between the dock and the scale bar. */
const CHROME_GUTTERS_PX = 48;

/** Space kept between a marking and the anatomy, so its halo never sits on tissue. */
const MARKING_GAP_PX = 8;

/** Room the top orientation letter and its gap take from a hint that would reach it. */
const TOP_LETTER_ROOM_PX = 20;

/**
 * A key longer than this many rows starts folded to its title where the stage is narrower than
 * KEY_FOLD_WIDTH_PX, or where its rows (KEY_ROW_PX each, TOUCH_ROW_PX for touch toggles, under
 * KEY_HEAD_PX of title, foot and edges) would not fit above the dock; on a phone any key starts
 * folded where it would take more than half that room from the picture. The hover chip names the colour under
 * the pointer, so a folded key hides nothing the reader cannot reach; unfolded, its rows go into a
 * saved image.
 */
const KEY_FOLD_ROWS = 8;
const KEY_FOLD_WIDTH_PX = 1000;
const KEY_ROW_PX = 24;
const TOUCH_ROW_PX = 44;
/**
 * Narrower than this, a paint key keeps its rows and drops its note: the note would take more of a
 * phone's stage than the picture it explains, and the open profile says the same thing in the panel.
 */
const KEY_NOTE_MIN_WIDTH_PX = 600;
const KEY_HEAD_PX = 42;

/** Keys that move the camera while the canvas has focus. */
const CAMERA_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-']);

/** How far the camera must move during a gesture before it has left the preset. */
const MOVED_EPSILON = 1e-6;

/** The reader has rotated or clicked the model once; the drag-and-scroll hint stays retired. */
const HINT_STORAGE_KEY = 'planum.stage-hint';

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
export function createViewportChrome({
  networks, cabNp, functionalRegions, onView, onRetry, onSnapshot, onDock, onFunctionalLevel, onPaintPick,
  controls,
}) {
  const orientation = document.getElementById('orientation');
  const edges = Object.fromEntries(
    [...orientation.children].map(node => [node.dataset.edge, node]));
  const views = document.getElementById('views');
  const dock = document.getElementById('stage-dock');
  const sectionBar = document.getElementById('section-bar');
  const sectionRow = sectionBar.querySelector('.section-bar-row');
  const sectionToolLabel = document.getElementById('section-tool-label');
  const viewTool = document.getElementById('view-tool');
  const viewToolLabel = document.getElementById('view-tool-label');
  const viewPopoverLabel = document.getElementById('view-popover-label');
  const displayToolLabel = document.getElementById('display-tool-label');
  const bar = document.getElementById('scale-bar');
  const barRule = bar.querySelector('.scale-bar-rule');
  const barText = bar.querySelector('.measure');
  const hover = document.getElementById('hover-label');
  const keysHost = document.getElementById('stage-keys');
  const functionalLevel = document.getElementById('functional-level');
  const paintNote = document.getElementById('paint-key-note');
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
  let lastLegend = null;
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
   * The section row's natural width, with every control beside the slider. Read in one forced
   * layout, and only when its words or state change, never on a resize or a sheet drag.
   */
  let sectionWidth = 0;
  let sectionKey = '';
  function sectionNeed() {
    if (sectionBar.hidden) return 0;
    const key = [currentLang, sectionBar.dataset.pending, sectionRow.textContent].join('|');
    if (key === sectionKey) return sectionWidth;
    sectionKey = key;
    const compact = sectionBar.dataset.compact;
    delete sectionBar.dataset.compact;
    dock.dataset.measure = 'true';
    const style = getComputedStyle(dock);
    sectionWidth = sectionBar.offsetWidth + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
    delete dock.dataset.measure;
    if (compact !== undefined) sectionBar.dataset.compact = compact;
    return sectionWidth;
  }

  /** The section row whole, or with its details behind the disclosure where it would wrap. */
  function fitDockLayout() {
    if (!lastRect?.width) return;
    const compact = String(compactSection({
      room: lastRect.width - 2 * gutter(),
      need: phone?.matches ? null : sectionNeed(),
    }));
    if (sectionBar.dataset.compact !== compact) sectionBar.dataset.compact = compact;
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
    // Measured from the framing rectangle (the visible stage less any colour key's band) as it is
    // drawn: on a phone it glides with a settling sheet, and the markings glide with it.
    const frame = orientation.getBoundingClientRect();
    const floor = frame.bottom - reach;
    const box = edge => edges[edge].getBoundingClientRect();
    const above = b => Math.max(0, b.bottom - frame.top + MARKING_GAP_PX);
    const below = b => Math.max(0, floor - b.top + MARKING_GAP_PX);
    clear.top = above(box('top'));
    if (host.dataset.dockTall !== 'true') clear.bottom = below(box('bottom'));
    clear.left = Math.max(0, box('left').right - frame.left + MARKING_GAP_PX);
    clear.right = Math.max(0, frame.right - box('right').left + MARKING_GAP_PX);
    if (!bar.hidden) {
      const b = bar.getBoundingClientRect();
      if ((b.top + b.bottom) / 2 < (frame.top + floor) / 2) clear.top = Math.max(clear.top, above(b));
      else clear.bottom = Math.max(clear.bottom, below(b));
    }
    return clear;
  }

  /** The scene's framing insets and the scale for its fit, keeping anatomy clear of dock, keys and markings. */
  function framing() {
    const reach = dockReach();
    fitKeys({ width: keysHost.offsetWidth, height: keysHost.offsetHeight });
    if (!lastRect?.height) return { inset: { ...keyInset, bottom: reach }, scale: { horizontal: 1, vertical: 1 } };
    const room = { width: lastRect.width - keyInset.right, height: lastRect.height - keyInset.top };
    const { inset, scale } = clearFraming(room, reach, markingClearance(reach), FRAME_FILL);
    return { inset: { ...keyInset, bottom: inset }, scale };
  }

  /*
   * The colour keys. On the stage rather than in a panel: a key that is not beside the picture it
   * explains is not a key. Each is one plate whose title row names its map and folds its rows;
   * the reader's own fold of a map is kept for the visit.
   */
  const plates = Object.fromEntries(['network', 'functional', 'paint', 'direction'].map(name => {
    const node = document.getElementById(`${name}-key`);
    return [name, {
      plate: node,
      title: document.getElementById(`${name}-key-title`),
      toggle: node.querySelector('.stage-key-toggle'),
      list: node.querySelector('.stage-key-list'),
    }];
  }));
  const folds = new Map();

  function keyRow(color, text) {
    const row = document.createElement('li');
    const swatch = document.createElement('span');
    swatch.className = 'network-swatch';
    swatch.style.background = networkCss(color);
    const label = document.createElement('span');
    label.textContent = text;
    row.append(swatch, label);
    return row;
  }

  /**
   * One plate, for `map` or for nothing; `rows` replaces its list when given. `toggles` says its
   * rows are buttons, which touch makes full targets; a phone runs rows two to a line, but a
   * deficit's findings one to a line (stage.css).
   */
  function paintKey(name, map, title, count, rows = null, toggles = false) {
    const { plate, toggle, list } = plates[name];
    plate.hidden = !map;
    if (!map) return;
    plate.dataset.map = map;
    plates[name].title.textContent = title;
    if (rows) list.replaceChildren(...rows);
    const columns = phone?.matches && name !== 'direction' && map !== 'deficit' ? 2 : 1;
    const rowPx = toggles && (phone?.matches || isCoarse()) ? TOUCH_ROW_PX : KEY_ROW_PX;
    const need = KEY_HEAD_PX + Math.ceil(count / columns) * rowPx;
    const room = (lastRect?.height ?? 0) - 3 * gutter() - dockHeight;
    const crowded = Boolean(lastRect?.width) && (lastRect.width < KEY_FOLD_WIDTH_PX || need > room);
    // On a phone even a short key folds where it would take over half the picture's room.
    const open = folds.get(map) ?? !((count > KEY_FOLD_ROWS && crowded) || (phone?.matches && Boolean(lastRect?.height) && need > room / 2));
    toggle.setAttribute('aria-expanded', String(open));
    list.hidden = !open;
  }

  /**
   * `legend` keys the paint a tab draws: `{ map, title, note, pickable, rows: [{ id, color, label, pressed }] }`,
   * or null. Unless `pickable` is false, more than one row makes each a toggle that shows that row alone.
   */
  function showKeys(state, directionShown, legend) {
    const ready = state.status === 'ready' || state.status === 'switching';
    // A key is titled as the masthead's Colour field names its map.
    const maps = t(state.lang, 'display').surfaceColors;
    // A paint is drawn over the masthead's colour, so that colour's key would explain nothing on screen.
    const network = ready && !legend ? { network: networks, 'cab-np': cabNp }[state.surfaceColor] : null;
    if (network) {
      const name = state.surfaceColor === 'cab-np' ? cabNpName : networkName;
      paintKey('network', state.surfaceColor, maps[state.surfaceColor], network.networks.length,
        network.networks.map(key => keyRow(network.colors[key], name(key, state.lang))));
    } else paintKey('network', null);

    const functional = ready && !legend && functionalRegions && state.surfaceColor === 'functional'
      ? functionalRegions.levels[state.functionalLevel] : null;
    const copy = t(state.lang, 'functional');
    functionalLevel.setAttribute('aria-label', copy.keyAria);
    for (const button of functionalLevel.querySelectorAll('[data-level]')) {
      button.textContent = copy.levels[button.dataset.level];
      button.setAttribute('aria-pressed', String(button.dataset.level === state.functionalLevel));
    }
    levelRoving.sync();
    const division = record => (record.number ? `${record.number} · ` : '') + functionalShortName(record, state.lang);
    paintKey('functional', functional && 'functional', maps.functional, functional?.length,
      functional?.map(record => keyRow(record.color, division(record))));

    // The rows are rebuilt on every paint, so the one holding focus hands it to its replacement.
    const focusedPick = plates.paint.list.contains(document.activeElement)
      ? document.activeElement.dataset.pick : null;
    const shownLegend = ready ? legend : null;
    const pickable = shownLegend?.pickable !== false && shownLegend?.rows.length > 1;
    paintKey('paint', shownLegend?.map ?? null, shownLegend?.title, shownLegend?.rows.length,
      shownLegend?.rows.map(entry => {
        const row = keyRow(entry.color, entry.label);
        // A colour the stage does not show is outlined in the row's ink instead of filled.
        if (entry.absent) {
          row.dataset.absent = '';
          row.querySelector('.network-swatch').style.background = '';
        }
        if (!pickable) return row;
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.pick = entry.id;
        button.setAttribute('aria-pressed', String(entry.pressed));
        button.append(...row.childNodes);
        row.append(button);
        return row;
      }), pickable);
    plates.paint.list.toggleAttribute('data-picked', Boolean(shownLegend?.rows.some(entry => entry.pressed)));
    paintNote.textContent = shownLegend?.note ?? '';
    paintNote.hidden = plates.paint.list.hidden || (lastRect?.width ?? Infinity) < KEY_NOTE_MIN_WIDTH_PX;
    // Where the stage leaves the key too little height, its rows keep the room and the note gives way.
    const { list } = plates.paint;
    if (!paintNote.hidden && list.scrollHeight > list.clientHeight) paintNote.hidden = true;
    if (focusedPick) plates.paint.list.querySelector(`[data-pick="${CSS.escape(focusedPick)}"]`)?.focus();
    paintRoving.sync();

    const directions = t(state.lang, 'viewport').directionKey;
    paintKey('direction', directionShown && 'direction', directions.title, 3);
    document.getElementById('direction-key-lr').textContent = directions.leftRight;
    document.getElementById('direction-key-ap').textContent = directions.anteriorPosterior;
    document.getElementById('direction-key-si').textContent = directions.superiorInferior;
  }

  const onKeyToggle = event => {
    const toggle = event.target.closest('.stage-key-toggle');
    if (!toggle) return;
    folds.set(toggle.closest('.stage-key').dataset.map, toggle.getAttribute('aria-expanded') !== 'true');
    if (lastState) showKeys(lastState, !plates.direction.plate.hidden, lastLegend);
  };
  keysHost.addEventListener('click', onKeyToggle);

  const onLevelClick = event => {
    const button = event.target.closest('[data-level]');
    if (button && button.getAttribute('aria-pressed') !== 'true') onFunctionalLevel(button.dataset.level);
  };
  functionalLevel.addEventListener('click', onLevelClick);
  const levelRoving = bindRoving(functionalLevel);

  const onPickClick = event => {
    const button = event.target.closest('[data-pick]');
    if (button) onPaintPick(button.getAttribute('aria-pressed') === 'true' ? null : button.dataset.pick);
  };
  plates.paint.list.addEventListener('click', onPickClick);
  const paintRoving = bindRoving(plates.paint.list);

  /*
   * A shown key takes a band off the framing rectangle, the right column it stands in or the top
   * strip down to its foot, whichever leaves the larger square for the anatomy; the orientation
   * letters frame what is left. Sizes come from the observer, so a sheet drag forces no layout.
   */
  let keySize = { width: 0, height: 0 };
  let keyInset = { top: 0, right: 0 };
  function fitKeys(size = keySize) {
    keySize = size;
    let next = { top: 0, right: 0 };
    if (size.width && size.height && lastRect?.width && lastRect.height) {
      const top = Math.round(gutter() + size.height);
      const right = Math.round(gutter() + size.width);
      const { width, height } = lastRect;
      next = Math.min(width, height - top) >= Math.min(width - right, height) ? { top, right: 0 } : { top: 0, right };
    }
    if (next.top === keyInset.top && next.right === keyInset.right) return false;
    keyInset = next;
    host.style.setProperty('--key-top', `${next.top}px`);
    host.style.setProperty('--key-right', `${next.right}px`);
    return true;
  }
  const keysObserver = globalThis.ResizeObserver
    ? new ResizeObserver(([entry]) => {
      const box = entry.borderBoxSize?.[0];
      if (fitKeys({ width: box?.inlineSize ?? keysHost.offsetWidth, height: box?.blockSize ?? keysHost.offsetHeight })) {
        fitHints();
        onDock?.();
      }
    })
    : null;
  keysObserver?.observe(keysHost);

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
    const text = withUnit(decimal(scale.millimetres, 1, currentLang, { trim: true }), 'mm', currentLang);
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

  /*
   * The hints sit at the top left and never reach the top letter, nor a key in the top band: on a
   * stage too narrow for one line beside them, a hint is not drawn. Widths are read once per wording.
   */
  const hintWidths = new Map();
  function fitHints() {
    if (!lastRect?.width) return;
    const room = keyInset.top
      ? lastRect.width - 3 * gutter() - keySize.width
      : (lastRect.width - keyInset.right) / 2 - gutter() - TOP_LETTER_ROOM_PX;
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

  // Keep all localized names in one grid cell so changing views never moves the other tools.
  const viewToolNames = ['', ...VIEW_KEYS].map(view => {
    const name = document.createElement('span');
    name.dataset.view = view;
    viewToolLabel.append(name);
    return name;
  });

  /** Name the held preset, or return to View once the reader moves the camera freely. */
  function paintViewTool() {
    const copy = t(currentLang, 'viewport');
    const names = t(currentLang, 'views');
    const shown = held && currentView ? currentView : '';
    for (const name of viewToolNames) {
      const text = name.dataset.view ? names[name.dataset.view] : copy.viewTool;
      if (name.textContent !== text) name.textContent = text;
      name.toggleAttribute('data-current', name.dataset.view === shown);
    }
    viewTool.setAttribute('aria-label', shown ? copy.viewToolAria(names[shown]) : copy.viewAria);
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

  const onPhoneChange = () => {
    // A phone's stage takes the sheet's narrower gutter.
    stageGutter = null;
    fitDockLayout();
    if (lastState) showKeys(lastState, !plates.direction.plate.hidden, lastLegend);
  };
  phone?.addEventListener('change', onPhoneChange);
  // Widths measured in a fallback face are wrong once Source Sans arrives.
  const onFontsLoaded = () => {
    sectionKey = '';
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
    const visible = node => node.checkVisibility?.() !== false;
    const letters = orientation.hidden ? [] : Object.entries(edges).map(([edge, node]) => {
      const box = local(node);
      const spot = { edge, text: node.textContent, x: box.x + box.width / 2, y: box.y + box.height / 2 };
      // Without the dock the top letter needs no room under a phone's scale bar; a key's band it keeps.
      if (edge === 'top' && !keyInset.top) spot.y = 12 + line / 2;
      // Hidden over a tall dock; on the image it keeps the line above the statement.
      if (edge === 'bottom' && host.dataset.dockTall === 'true') {
        Object.assign(spot, { x: crop.width / 2, y: crop.height - margin - line * 2 });
      }
      return spot;
    });
    // A key's words, title and the level shown included; a range measures the text, not its button.
    const words = node => {
      const range = document.createRange();
      range.selectNodeContents(node);
      const box = local(range);
      const style = getComputedStyle(node);
      return { text: node.textContent, x: box.x, y: box.y + box.height / 2, color: style.color,
        font: `${style.fontWeight} ${style.fontSize} ${style.fontFamily}` };
    };
    const keys = [...keysHost.querySelectorAll('.stage-key')].filter(node => !node.hidden).map(node => {
      const look = getComputedStyle(node);
      const box = local(node);
      // Rows scrolled out of a long list stay out of the image too.
      const inside = mark => mark.y >= box.y && mark.y <= box.y + box.height;
      return {
        box,
        fill: look.backgroundColor,
        edge: look.borderTopColor,
        // A folded key draws what it shows, its title; unfolded on screen, so is it in the image.
        swatches: [...node.querySelectorAll('.network-swatch')].filter(visible).map(swatch => {
          const style = getComputedStyle(swatch);
          return { ...local(swatch), color: style.backgroundColor, radius: parseFloat(style.borderTopLeftRadius) || 0 };
        }).filter(inside),
        texts: [...node.querySelectorAll('.stage-key-toggle > span:not(.stage-tool-chevron), [aria-pressed="true"], li > span:not(.network-swatch)')]
          .filter(visible).map(words).filter(inside),
      };
    });
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
      // A desktop resize reframes at once; a phone's sheet reframes when it settles on a detent.
      if (fitKeys() && !phone?.matches) onDock?.();
      fitDockLayout();
      fitChrome();
      fitDock();
      fitHints();
      settlePopovers();
    },

    update(state, { directionKey: showKey = false, legend = null } = {}) {
      currentLang = state.lang;
      lastState = state;
      lastLegend = legend;
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
      showKeys(state, showKey, legend);
      settlePopovers();
      const ready = state.status === 'ready' || state.status === 'switching';
      orientation.hidden = !ready;
      if (ready) paintScale(); else bar.hidden = true;

      paintEdges();

      if (state.status === 'context-lost') {
        stageMessage.textContent = t(state.lang, 'errors').contextLost;
        stageProgress.hidden = true;
        retry.hidden = true;
        return;
      }
      if (state.status === 'error') {
        stageMessage.textContent = state.error ? failureNotice(state.error, state.lang, 'start').text : i18nViewport.error;
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
        font: token('--font-ui'),
        palette: { ink: token('--overlay-ink'), halo: token('--overlay-halo'), haloCore: token('--overlay-halo-core') },
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
        `${Math.max(8, Math.min(position.x + 14, hoverBounds.width - hoverSize.width - 8))}px`;
      hover.style.top =
        `${Math.max(8, Math.min(position.y + 14, hoverBounds.height - hoverSize.height - 8))}px`;
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
      keysObserver?.disconnect();
      sectionObserver?.disconnect();
      roving.dispose();
      levelRoving.dispose();
      paintRoving.dispose();
      plates.paint.list.removeEventListener('click', onPickClick);
      phone?.removeEventListener('change', onPhoneChange);
      document.fonts?.removeEventListener('loadingdone', onFontsLoaded);
      popovers.dispose();
      snapshotButton?.removeEventListener('click', onSnapshotClick);
      fullscreenButton?.removeEventListener('click', onFullscreenClick);
      views.replaceChildren();
      viewToolLabel.replaceChildren();
      functionalLevel.removeEventListener('click', onLevelClick);
      keysHost.removeEventListener('click', onKeyToggle);
      plates.network.list.replaceChildren();
      plates.functional.list.replaceChildren();
      plates.paint.list.replaceChildren();
    },
  };
}
