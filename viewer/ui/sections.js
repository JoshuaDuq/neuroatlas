import { Vector3 } from 'three';
import { centeredFrame, pointOnFrame } from '../slices/coordinates.js';
import { t } from '../i18n/translations.js';
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
  CSF: 'Cerebrospinal fluid (CSF)',
  'Left-vessel': 'Cerebral vessel',
  'Right-vessel': 'Cerebral vessel',
  'WM-hypointensities': 'White matter hypointensities',
  ctx_lh_Medial_wall: 'Medial wall',
  ctx_rh_Medial_wall: 'Medial wall',
};

/** Cut controls and linked MRI sections; the controller owns all coordinates. */
export function createSectionControls(sections, { cutAtlases, onFaceView, onSelect }) {
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
  const readout = document.getElementById('mpr-readout');
  const width = document.getElementById('mri-window-width');
  const center = document.getElementById('mri-window-center');
  const mprOverlay = document.getElementById('mpr-overlay');
  const cutModeLabel = document.getElementById('cut-mode-label');
  const cutTiltLabel = document.getElementById('cut-tilt-label');
  const cutAzimuthLabel = document.getElementById('cut-azimuth-label');
  const cutReverseText = document.getElementById('cut-reverse-text');
  const cutMidlineBtn = document.getElementById('cut-midline');
  const cutFaceBtn = document.getElementById('cut-face-view');
  const mprOpenBtn = document.getElementById('mpr-open');
  const mprCloseBtn = document.getElementById('mpr-close');
  const mprTitle = document.getElementById('mpr-title');
  const mprSubtitle = document.getElementById('mpr-subtitle');
  const mriWidthText = document.getElementById('mri-window-width-text');
  const mriCenterText = document.getElementById('mri-window-center-text');
  const mprOverlayText = document.getElementById('mpr-overlay-text');
  const mprNote = document.getElementById('mpr-note');
  const listeners = [];
  const panels = new Map();
  let previousImage = null;
  let animation = null;
  let currentLang = 'en';

  function reportError(error) { status.textContent = error.message; console.error(error); }

  function listen(element, type, callback) {
    const listener = async event => {
      try { await callback(event); }
      catch (error) { reportError(error); }
    };
    element.addEventListener(type, listener);
    listeners.push([element, type, listener]);
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
  for (const atlas of cutAtlases) {
    const option = document.createElement('option');
    option.value = atlas.id;
    option.textContent = atlas.label;
    cutAtlas.append(option);
  }

  listen(mode, 'change', async () => {
    await sections.setMode(mode.value);
    if (sections.active) onFaceView();
  });
  listen(cutAtlas, 'change', () => sections.setCutAtlas(cutAtlas.value));
  listen(position, 'input', () => schedule(() => sections.setOffset(Number(position.value))));
  listen(number, 'change', () => sections.setOffset(Number(number.value)));
  listen(reverse, 'change', () => { sections.setDisplay({ reverse: reverse.checked }); onFaceView(); });
  listen(mprOverlay, 'change', () => sections.setDisplay({ overlay: mprOverlay.checked }));
  listen(tilt, 'input', () => schedule(() => sections.setAngles(Number(tilt.value), Number(azimuth.value))));
  listen(azimuth, 'input', () => schedule(() => sections.setAngles(Number(tilt.value), Number(azimuth.value))));
  listen(cutFaceBtn, 'click', onFaceView);
  listen(cutMidlineBtn, 'click', async () => {
    sections.setCrosshair([0, sections.state.crosshair[1], sections.state.crosshair[2]]);
    await sections.setMode('sagittal');
    onFaceView();
  });
  listen(mprOpenBtn, 'click', async () => {
    await sections.load();
    dialog.showModal();
    previousImage = null;
    update();
  });
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
    const slider = document.createElement('input');
    slider.type = 'range'; slider.min = '-128'; slider.max = '128'; slider.step = '1';
    const output = document.createElement('output');
    output.className = 'measure';
    const exportButton = document.createElement('button');
    exportButton.type = 'button';
    label.append(slider, output);
    article.append(heading, canvas, label, exportButton);
    grid.append(article);
    panels.set(name, { heading, canvas, label, slider, output, exportButton });
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
    listen(canvas, 'keydown', event => {
      if (!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const point = [...sections.state.crosshair];
      point[axis] = Math.max(-128,Math.min(128,point[axis]+(['ArrowUp','ArrowRight'].includes(event.key) ? 1 : -1)));
      selectPoint(point);
    });
    listen(exportButton, 'click', () => {
      const link = document.createElement('a');
      link.download = `fsaverage-${name}-${sections.state.crosshair[axis].toFixed(1)}mm.png`;
      link.href = canvas.toDataURL('image/png'); link.click();
    });
  }

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
    ctx.strokeStyle = '#6ce3da'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,size); ctx.moveTo(0,y); ctx.lineTo(size,y); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '16px system-ui'; ctx.textAlign = 'center';
    for (const [index, point] of [[size/2,22],[size-16,size/2],[size/2,size-14],[16,size/2]].entries()) {
      const edgeLetter = currentLang === 'fr' ? (FR_EDGE[frame.edges[index]] ?? frame.edges[index]) : frame.edges[index];
      ctx.fillText(edgeLetter, ...point);
    }
    ctx.font = '12px monospace'; ctx.textAlign = 'left';
    ctx.fillText(`${planeName} ${sections.state.crosshair[AXES[name]].toFixed(1)} mm`, 10, size-12);
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
    for (const opt of mode.options) {
      if (cutsI18n.modes[opt.value]) opt.textContent = cutsI18n.modes[opt.value];
    }
    mode.value = state.mode;
    document.getElementById('cut-axis').textContent = cutsI18n.axes[state.mode] ?? cutsI18n.axes.off;
    const offset = new Vector3(...state.crosshair).dot(sections.frame.normal);
    if (document.activeElement !== position) position.value = String(offset);
    if (document.activeElement !== number) number.value = offset.toFixed(1);
    number.setAttribute('aria-label', cutsI18n.exactPositionAria);
    reverse.checked = state.reverse;
    mprOverlay.checked = state.overlay;
    oblique.hidden = state.mode !== 'oblique';
    if (cutTiltLabel) cutTiltLabel.textContent = cutsI18n.tilt;
    if (cutAzimuthLabel) cutAzimuthLabel.textContent = cutsI18n.azimuth;
    if (cutReverseText) cutReverseText.textContent = cutsI18n.reverseSide;
    if (cutMidlineBtn) cutMidlineBtn.textContent = cutsI18n.midsagittal;
    if (cutFaceBtn) cutFaceBtn.textContent = cutsI18n.faceCut;
    if (mprOpenBtn) mprOpenBtn.textContent = cutsI18n.openMpr;

    tilt.value = state.tilt; azimuth.value = state.azimuth;
    document.getElementById('cut-angles').textContent = `${state.tilt}° / ${state.azimuth}°`;
    for (const element of [position,number,reverse,cutFaceBtn]) {
      element.disabled = !sections.active;
    }

    if (cutAtlasLabel) cutAtlasLabel.textContent = cutsI18n.cutLabels;
    const atlasDict = t(currentLang, 'atlases');
    for (const option of cutAtlas.options) {
      option.textContent = atlasDict[option.value] ?? option.textContent;
    }
    cutAtlas.value = state.cutAtlas;
    const atlasLabel = {
      'hcp-mmp': cutsI18n.hcpDerived,
      destrieux: cutsI18n.destrieuxNative,
      nextbrain: cutsI18n.nextbrainWarped,
    }[state.cutAtlas] ?? state.cutAtlas;
    status.textContent = state.status === 'loading' ? cutsI18n.statusPreparing
      : state.error || (sections.active ? cutsI18n.statusActive(offset.toFixed(1), atlasLabel) : cutsI18n.statusFull);

    if (mprTitle) mprTitle.textContent = mprI18n.title;
    if (mprSubtitle) mprSubtitle.textContent = mprI18n.subtitle;
    if (mprCloseBtn) mprCloseBtn.textContent = mprI18n.close;
    if (mriWidthText) mriWidthText.textContent = mprI18n.contrastWindow;
    if (mriCenterText) mriCenterText.textContent = mprI18n.windowCenter;
    if (mprOverlayText) mprOverlayText.textContent = mprI18n.segmentationOverlay;
    if (mprNote) mprNote.textContent = mprI18n.note;

    for (const [name, panel] of panels) {
      const planeName = mprI18n.labels[name] ?? name;
      panel.heading.textContent = planeName;
      panel.canvas.setAttribute('aria-label', mprI18n.sliceAria(planeName));
      panel.label.childNodes[0].nodeValue = `${mprI18n.positionLabel(planeName)} `;
      panel.slider.setAttribute('aria-label', mprI18n.sliderAria(planeName));
      panel.exportButton.textContent = mprI18n.savePng;
    }

    if (!dialog.open || !sections.volumes) return;
    width.value = sections.display.windowWidth; center.value = sections.display.windowCenter;
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
      drawPanel(name,panel);
    }
  }

  return { update, dispose() {
    if (animation !== null) cancelAnimationFrame(animation);
    for (const [element,type,listener] of listeners) element.removeEventListener(type,listener);
    grid.replaceChildren();
    dialog.close();
  } };
}
