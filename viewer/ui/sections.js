import { Vector3 } from 'three';
import { centeredFrame, offsetThrough, pointOnFrame } from '../slices/coordinates.js';
import { atlasSwitchLabel, t } from '../i18n/translations.js';
import { PHONE_QUERY } from '../render/device.js';
import { STRUCTURE_LABELS } from '../catalog/structure-groups.js';
import { STRUCTURE_LABELS_FR } from '../catalog/structure-groups.fr.js';
import { DESTRIEUX_LABELS } from '../catalog/destrieux-labels.js';
import { DESTRIEUX_LABELS_FR } from '../catalog/destrieux-labels.fr.js';

const AXES = { sagittal: 0, coronal: 1, axial: 2 };
const FR_EDGE = { R: 'D', L: 'G', S: 'S', I: 'I', P: 'P', A: 'A' };

const TISSUE_NAMES_FR = {
  Unknown: 'Non étiqueté',
  '???': 'Non étiqueté',
  'Left-Cerebral-White-Matter': 'Substance blanche cérébrale',
  'Right-Cerebral-White-Matter': 'Substance blanche cérébrale',
  'Left-Cerebral-Cortex': 'Cortex cérébral gauche',
  'Right-Cerebral-Cortex': 'Cortex cérébral droit',
  CSF: 'Liquide cérébro-spinal (LCS)',
  'Left-vessel': 'Vaisseau cérébral',
  'Right-vessel': 'Vaisseau cérébral',
  'WM-hypointensities': 'Hypointensités de la substance blanche',
  ctx_lh_Medial_wall: 'Paroi médiale',
  ctx_rh_Medial_wall: 'Paroi médiale',
};

const TISSUE_NAMES_EN = {
  Unknown: 'Unlabelled',
  '???': 'Unlabelled',
  'Left-Cerebral-White-Matter': 'Cerebral white matter',
  'Right-Cerebral-White-Matter': 'Cerebral white matter',
  'Left-Cerebral-Cortex': 'Left cerebral cortex',
  'Right-Cerebral-Cortex': 'Right cerebral cortex',
  CSF: 'Cerebrospinal fluid (CSF)',
  'Left-vessel': 'Cerebral vessel',
  'Right-vessel': 'Cerebral vessel',
  'WM-hypointensities': 'White matter hypointensities',
  ctx_lh_Medial_wall: 'Medial wall',
  ctx_rh_Medial_wall: 'Medial wall',
};

/** Cut controls and linked MRI sections; the controller owns all coordinates. */
export function createSectionControls(sections, { anatomy, cutAtlases, onFaceView, onSelect, getSelectedRegion, centroidOf }) {
  const mode = document.getElementById('cut-mode');
  const cutAtlas = document.getElementById('cut-atlas');
  const cutAtlasLabel = document.getElementById('cut-atlas-label');
  const position = document.getElementById('cut-position');
  const number = document.getElementById('cut-number');
  const reverse = document.getElementById('cut-reverse');
  const tilt = document.getElementById('cut-tilt');
  const azimuth = document.getElementById('cut-azimuth');
  const oblique = document.getElementById('cut-oblique');
  const status = document.getElementById('cut-status');
  const dialog = document.getElementById('mpr-dialog');
  const grid = document.getElementById('mpr-grid');
  const planeSwitch = document.getElementById('mpr-planes');
  const readout = document.getElementById('mpr-readout');
  const width = document.getElementById('mri-window-width');
  const center = document.getElementById('mri-window-center');
  const mprOverlay = document.getElementById('mpr-overlay');
  const cutModeLabel = document.getElementById('cut-mode-label');
  const cutTiltLabel = document.getElementById('cut-tilt-label');
  const cutTiltValue = document.getElementById('cut-tilt-value');
  const cutAzimuthLabel = document.getElementById('cut-azimuth-label');
  const cutAzimuthValue = document.getElementById('cut-azimuth-value');
  const cutReverseText = document.getElementById('cut-reverse-text');
  const mprOpenBtn = document.getElementById('mpr-open');
  const regionMpr = document.getElementById('region-mpr');
  const mprCloseBtn = document.getElementById('mpr-close');
  const mprTitle = document.getElementById('mpr-title');
  const mprSubtitle = document.getElementById('mpr-subtitle');
  const mriWidthText = document.getElementById('mri-window-width-text');
  const mriCenterText = document.getElementById('mri-window-center-text');
  const mriWidthValue = document.getElementById('mri-window-width-value');
  const mriCenterValue = document.getElementById('mri-window-center-value');
  const mprOverlayText = document.getElementById('mpr-overlay-text');
  const mprNote = document.getElementById('mpr-note');
  const listeners = [];
  const panels = new Map();
  let previousImage = null;
  let animation = null;
  let currentLang = 'en';

  function reportError(error) { status.textContent = error.message; console.error(error); }

  function listen(element, type, callback, options) {
    const listener = async event => {
      try { await callback(event); }
      catch (error) { reportError(error); }
    };
    element.addEventListener(type, listener, options);
    listeners.push([element, type, listener, options]);
  }

  function schedule(callback) {
    if (animation !== null) cancelAnimationFrame(animation);
    animation = requestAnimationFrame(() => {
      animation = null;
      try { callback(); } catch (error) { reportError(error); }
    });
  }

  // Populated from the manifest: a build without the optional NextBrain volume
  // simply offers fewer choices, with no code path of its own.
  const nextbrainSegmented =
    cutAtlases.find(atlas => atlas.id === 'nextbrain')?.procedure === 'subject-segmentation';
  for (const atlas of cutAtlases) {
    const option = document.createElement('option');
    option.value = atlas.id;
    option.textContent = atlasSwitchLabel(atlas.id);
    option.title = atlas.label;
    cutAtlas.append(option);
  }

  listen(mode, 'click', async event => {
    const button = event.target.closest('[data-cut-mode]');
    if (!button || button.dataset.cutMode === sections.state.mode) return;
    await sections.setMode(button.dataset.cutMode);
    if (sections.active) {
      // A region is already chosen. The new plane should meet it, not the
      // midline the slider was left on.
      const region = getSelectedRegion?.();
      const coords = region && centroidOf?.(region.id);
      if (coords) {
        sections.setOffset(offsetThrough(coords, sections.frame.normal, sections.offsetRange));
      }
      onFaceView();
    }
  });
  listen(cutAtlas, 'change', () => sections.setCutAtlas(cutAtlas.value));
  listen(position, 'input', () => schedule(() => sections.setOffset(Number(position.value))));
  listen(number, 'change', () => sections.setOffset(Number(number.value)));
  listen(reverse, 'change', () => { sections.setDisplay({ reverse: reverse.checked }); onFaceView(); });
  listen(mprOverlay, 'change', () => sections.setDisplay({ overlay: mprOverlay.checked }));
  listen(tilt, 'input', () => schedule(() => sections.setAngles(Number(tilt.value), Number(azimuth.value))));
  listen(azimuth, 'input', () => schedule(() => sections.setAngles(Number(tilt.value), Number(azimuth.value))));
  async function openMpr({ atRegion = false } = {}) {
    const region = getSelectedRegion?.();
    if (atRegion && region) {
      const coords = centroidOf?.(region.id);
      if (coords) sections.setCrosshair(coords);
    } else if (region) {
      const coords = centroidOf?.(region.id);
      if (coords) {
        const [x, y, z] = sections.state.crosshair;
        if (Math.abs(x) < 1e-3 && Math.abs(y) < 1e-3 && Math.abs(z) < 1e-3) {
          sections.setCrosshair(coords);
        }
      }
    }
    await sections.load();
    dialog.showModal();
    previousImage = null;
    update();
  }
  listen(mprOpenBtn, 'click', () => openMpr());
  if (regionMpr) listen(regionMpr, 'click', () => openMpr({ atRegion: true }));
  listen(mprCloseBtn, 'click', () => dialog.close());
  listen(width, 'input', () => schedule(() => sections.setWindow(Number(center.value), Number(width.value))));
  listen(center, 'input', () => schedule(() => sections.setWindow(Number(center.value), Number(width.value))));

  function selectPoint(point) {
    sections.setCrosshair(point);
    const sample = sections.sample(point);
    if (sample.region && sections.model.visibleMeshes.some(mesh => mesh.userData.region_id === sample.region.id)) {
      onSelect(sample.region.id);
    }
  }

  for (const [name, axis] of Object.entries(AXES)) {
    const article = document.createElement('article');
    const heading = document.createElement('h3');
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img');
    const label = document.createElement('label');
    const caption = document.createElement('span');
    const slider = document.createElement('input');
    slider.type = 'range'; slider.min = '-128'; slider.max = '128'; slider.step = '1';
    const output = document.createElement('output');
    output.className = 'measure';
    const exportButton = document.createElement('button');
    exportButton.type = 'button';
    exportButton.className = 'button-quiet';
    label.append(caption, output, slider);
    article.append(heading, canvas, label, exportButton);
    grid.append(article);
    panels.set(name, { article, heading, canvas, label, caption, slider, output, exportButton });
    listen(slider, 'input', () => schedule(() => {
      const point = [...sections.state.crosshair]; point[axis] = Number(slider.value);
      selectPoint(point);
    }));
    listen(canvas, 'click', event => {
      const rect = canvas.getBoundingClientRect();
      const frame = centeredFrame(name, sections.state.crosshair);
      selectPoint(pointOnFrame(frame, (event.clientX-rect.left)/rect.width,
        (event.clientY-rect.top)/rect.height, sections.display.fieldOfView));
    });
    listen(canvas, 'wheel', event => {
      event.preventDefault();
      const delta = Math.sign(event.deltaY);
      const point = [...sections.state.crosshair];
      point[axis] = Math.max(-128, Math.min(128, point[axis] - delta));
      selectPoint(point);
    }, { passive: false });
    listen(canvas, 'keydown', event => {
      if (!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const point = [...sections.state.crosshair];
      point[axis] = Math.max(-128,Math.min(128,point[axis]+(['ArrowUp','ArrowRight'].includes(event.key) ? 1 : -1)));
      selectPoint(point);
    });
    listen(exportButton, 'click', () => {
      const link = document.createElement('a');
      link.download = `${anatomy.subject}-${name}-${sections.state.crosshair[axis].toFixed(1)}mm.png`;
      link.href = canvas.toDataURL('image/png'); link.click();
    });
  }

  /*
   * Three sections stacked at 375px is a very long scroll with the crosshair
   * off screen, so a phone shows one plane at a time. The crosshair stays
   * linked across all three — only the drawing is deferred, and skipping two
   * canvases spares a phone two 512-square resamples on every crosshair move.
   */
  const phoneQuery = globalThis.matchMedia?.(PHONE_QUERY)
    ?? { matches: false, addEventListener() {}, removeEventListener() {} };
  let activePlane = 'axial';

  const planeButtons = Object.keys(AXES).map(name => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.plane = name;
    listen(button, 'click', () => { activePlane = name; applyPlaneMode(); });
    planeSwitch.append(button);
    return button;
  });

  const planeVisible = name => !phoneQuery.matches || name === activePlane;

  function applyPlaneMode() {
    const onePlane = phoneQuery.matches;
    planeSwitch.hidden = !onePlane;
    for (const [name, panel] of panels) {
      panel.article.hidden = !planeVisible(name);
    }
    for (const button of planeButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.plane === activePlane));
    }
    // The newly shown plane has not been drawn while it was hidden.
    previousImage = null;
    update();
  }
  phoneQuery.addEventListener('change', applyPlaneMode);

  function drawPanel(name, panel) {
    const frame = centeredFrame(name, sections.state.crosshair);
    const { size, fieldOfView } = sections.display;
    const pixels = sections.pixels(frame);
    const ctx = panel.canvas.getContext('2d');
    const mprI18n = t(currentLang, 'mpr');
    const planeName = mprI18n.labels[name] ?? name;
    panel.canvas.width = size; panel.canvas.height = size;
    // The MRI reference retains all source intensities, including unsegmented voxels.
    for (let index=3; index<pixels.length; index+=4) {
      pixels[index]=255;
    }
    ctx.putImageData(new ImageData(pixels, size, size),0,0);
    const displacement = new Vector3(...sections.state.crosshair).sub(frame.center);
    const x = (displacement.dot(frame.u)/fieldOfView+.5)*size;
    const y = (.5-displacement.dot(frame.v)/fieldOfView)*size;
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,size); ctx.moveTo(0,y); ctx.lineTo(size,y);
    ctx.strokeStyle = '#0e1116'; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = '#4fb6e0'; ctx.lineWidth = 1; ctx.stroke();
    ctx.textAlign = 'center';
    ctx.font = '600 15px ui-sans-serif, system-ui, sans-serif';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#0e1116';
    ctx.fillStyle = '#f2f6fa';
    for (const [index, point] of [[size/2,22],[size-16,size/2],[size/2,size-14],[16,size/2]].entries()) {
      const edgeLetter = currentLang === 'fr' ? (FR_EDGE[frame.edges[index]] ?? frame.edges[index]) : frame.edges[index];
      ctx.strokeText(edgeLetter, ...point);
      ctx.fillText(edgeLetter, ...point);
    }
    const annotation = `${planeName} ${sections.state.crosshair[AXES[name]].toFixed(1)} mm`;
    ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'left';
    ctx.strokeStyle = '#0e1116';
    ctx.strokeText(annotation, 10, size - 12);
    ctx.fillText(annotation, 10, size - 12);
  }

  function sampleDisplayName(sample) {
    if (!sample?.name) return '';
    const rawName = sample.name;
    if (currentLang === 'fr') {
      if (TISSUE_NAMES_FR[rawName]) return TISSUE_NAMES_FR[rawName];
      if (STRUCTURE_LABELS_FR[rawName]) return STRUCTURE_LABELS_FR[rawName].name;
      const clean = rawName.replace(/^ctx_[lr]h_/, '');
      if (DESTRIEUX_LABELS_FR[clean]) return DESTRIEUX_LABELS_FR[clean].name;
      if (rawName.endsWith('_ROI')) return rawName.replace(/^[LR]_/, '').replace(/_ROI$/, '');
      return rawName;
    }
    if (TISSUE_NAMES_EN[rawName]) return TISSUE_NAMES_EN[rawName];
    if (STRUCTURE_LABELS[rawName]) return STRUCTURE_LABELS[rawName].name;
    const clean = rawName.replace(/^ctx_[lr]h_/, '');
    if (DESTRIEUX_LABELS[clean]) return DESTRIEUX_LABELS[clean].name;
    if (rawName.endsWith('_ROI')) return rawName.replace(/^[LR]_/, '').replace(/_ROI$/, '');
    return rawName;
  }

  function update(appState) {
    if (appState?.lang) currentLang = appState.lang;
    const cutsI18n = t(currentLang, 'cuts');
    const mprI18n = t(currentLang, 'mpr');
    const state = sections.state;

    if (cutModeLabel) cutModeLabel.textContent = cutsI18n.cuttingPlane;
    if (cutModeLabel) mode.setAttribute('aria-labelledby', cutModeLabel.id);
    for (const button of mode.querySelectorAll('[data-cut-mode]')) {
      const id = button.dataset.cutMode;
      button.textContent = cutsI18n.modeShort[id] ?? cutsI18n.modes[id] ?? id;
      button.title = cutsI18n.modes[id] ?? id;
      button.setAttribute('aria-pressed', String(id === state.mode));
    }
    document.getElementById('cut-axis').textContent = cutsI18n.axes[state.mode] ?? cutsI18n.axes.off;
    const offset = new Vector3(...state.crosshair).dot(sections.frame.normal);
    for (const control of [position, number]) {
      [control.min, control.max] = sections.offsetRange.map(String);
    }
    if (document.activeElement !== position) position.value = String(offset);
    if (document.activeElement !== number) number.value = offset.toFixed(1);
    number.setAttribute('aria-label', cutsI18n.exactPositionAria);
    reverse.checked = state.reverse;
    mprOverlay.checked = state.overlay;
    oblique.hidden = state.mode !== 'oblique';
    if (cutTiltLabel) cutTiltLabel.textContent = cutsI18n.tilt;
    if (cutAzimuthLabel) cutAzimuthLabel.textContent = cutsI18n.azimuth;
    if (cutReverseText) cutReverseText.textContent = cutsI18n.reverseSide;
    if (mprOpenBtn) {
      mprOpenBtn.textContent = cutsI18n.openMpr;
      mprOpenBtn.title = cutsI18n.openMprTitle;
      mprOpenBtn.setAttribute('aria-label', cutsI18n.openMprTitle);
    }
    if (regionMpr) {
      regionMpr.textContent = cutsI18n.openMpr;
      regionMpr.title = cutsI18n.openMprTitle;
      regionMpr.setAttribute('aria-label', cutsI18n.openMprTitle);
    }

    tilt.value = state.tilt; azimuth.value = state.azimuth;
    if (cutTiltValue) cutTiltValue.textContent = `${state.tilt}°`;
    if (cutAzimuthValue) cutAzimuthValue.textContent = `${state.azimuth}°`;
    for (const element of [position, number, reverse]) {
      element.disabled = !sections.active;
    }

    if (cutAtlasLabel) cutAtlasLabel.textContent = cutsI18n.cutLabels;
    const atlasDict = t(currentLang, 'atlases');
    for (const option of cutAtlas.options) {
      option.textContent = atlasSwitchLabel(option.value, currentLang);
      option.title = atlasDict[option.value] ?? option.textContent;
    }
    cutAtlas.value = state.cutAtlas;
    const atlasLabel = {
      'hcp-mmp': cutsI18n.hcpDerived,
      destrieux: cutsI18n.destrieuxNative,
      nextbrain: nextbrainSegmented ? cutsI18n.nextbrainSegmented : cutsI18n.nextbrainWarped,
    }[state.cutAtlas] ?? state.cutAtlas;
    // The label grid's own spacing: NextBrain's cut samples 0.8 mm blocks.
    const spacing = sections.tissues?.metadata?.atlases?.[state.cutAtlas]?.voxel_spacing_mm?.[0] ?? 1;
    // A cut is sampled from a label volume, so its network colour is per parcel
    // while the surface's is per vertex. Said here rather than left to be found.
    // `state` in this function is the cut's own state; the surface mode is on
    // the app state, which some callers do not pass at all.
    const byNetwork = appState?.surfaceColor === 'network';
    const describeCut = appState?.surfaceColor === 'mri' ? cutsI18n.statusMri : cutsI18n.statusActive;
    const activeStatus = describeCut(offset.toFixed(1), atlasLabel, +spacing.toFixed(2))
      + (byNetwork ? ` · ${cutsI18n.networkByRegion}` : '');
    status.textContent = state.status === 'loading' ? cutsI18n.statusPreparing
      : state.error || (sections.active ? activeStatus : cutsI18n.statusFull);

    if (mprTitle) mprTitle.textContent = mprI18n.title;
    if (mprSubtitle) mprSubtitle.textContent = mprI18n.subtitle;
    if (mprCloseBtn) mprCloseBtn.textContent = mprI18n.close;
    if (mriWidthText) mriWidthText.textContent = mprI18n.contrastWindow;
    if (mriCenterText) mriCenterText.textContent = mprI18n.windowCenter;
    if (mprOverlayText) mprOverlayText.textContent = mprI18n.segmentationOverlay;
    if (mprNote) mprNote.textContent = mprI18n.note(anatomy);

    for (const [name, panel] of panels) {
      const planeName = mprI18n.labels[name] ?? name;
      panel.heading.textContent = planeName;
      panel.canvas.setAttribute('aria-label', mprI18n.sliceAria(planeName));
      panel.caption.textContent = mprI18n.positionLabel(planeName);
      panel.slider.setAttribute('aria-label', mprI18n.sliderAria(planeName));
      panel.exportButton.textContent = mprI18n.savePng;
    }
    planeSwitch.setAttribute('aria-label', mprI18n.planes);
    for (const button of planeButtons) {
      button.textContent = mprI18n.labels[button.dataset.plane] ?? button.dataset.plane;
    }

    if (!dialog.open || !sections.volumes) return;
    width.value = sections.display.windowWidth; center.value = sections.display.windowCenter;
    if (mriWidthValue) mriWidthValue.textContent = Math.round(sections.display.windowWidth);
    if (mriCenterValue) mriCenterValue.textContent = Math.round(sections.display.windowCenter);
    const sample = sections.sample(state.crosshair);
    const displayName = sampleDisplayName(sample);
    readout.textContent = mprI18n.readout(
      state.crosshair[0].toFixed(1),
      state.crosshair[1].toFixed(1),
      state.crosshair[2].toFixed(1),
      displayName,
      sample.labelId,
    );
    const imageKey = JSON.stringify([state.crosshair,state.overlay,sections.display.windowCenter,sections.display.windowWidth,currentLang]);
    if (imageKey === previousImage) return;
    previousImage = imageKey;
    for (const [name, panel] of panels) {
      const coordinate = state.crosshair[AXES[name]];
      panel.slider.value = coordinate;
      panel.output.textContent = `${coordinate.toFixed(1)} mm`;
      // A plane nobody can see is not resampled; it redraws when it is shown.
      if (planeVisible(name)) drawPanel(name, panel);
    }
  }

  applyPlaneMode();

  return { update, dispose() {
    if (animation !== null) cancelAnimationFrame(animation);
    phoneQuery.removeEventListener('change', applyPlaneMode);
    planeSwitch.replaceChildren();
    for (const [element,type,listener,options] of listeners) element.removeEventListener(type,listener,options);
    grid.replaceChildren();
    dialog.close();
  } };
}
