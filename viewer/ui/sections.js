import { Vector3 } from 'three';
import { centeredFrame, pointOnFrame } from '../slices/coordinates.js';

const AXES = { sagittal: 0, coronal: 1, axial: 2 };
const LABELS = { sagittal: 'Sagittal', coronal: 'Coronal', axial: 'Axial' };

/** Cut controls and linked MRI sections; the controller owns all coordinates. */
export function createSectionControls(sections, { onFaceView, onSelect }) {
  const mode = document.getElementById('cut-mode');
  const position = document.getElementById('cut-position');
  const number = document.getElementById('cut-number');
  const reverse = document.getElementById('cut-reverse');
  const mri = document.getElementById('cut-mri');
  const overlay = document.getElementById('cut-overlay');
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
  const listeners = [];
  const panels = new Map();
  let previousImage = null;
  let animation = null;

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

  listen(mode, 'change', async () => {
    await sections.setMode(mode.value);
    if (sections.active) onFaceView();
  });
  listen(position, 'input', () => schedule(() => sections.setOffset(Number(position.value))));
  listen(number, 'change', () => sections.setOffset(Number(number.value)));
  listen(reverse, 'change', () => { sections.setDisplay({ reverse: reverse.checked }); onFaceView(); });
  listen(mri, 'change', () => sections.setDisplay({ showMRI: mri.checked }));
  listen(overlay, 'change', () => sections.setDisplay({ overlay: overlay.checked }));
  listen(mprOverlay, 'change', () => sections.setDisplay({ overlay: mprOverlay.checked }));
  listen(tilt, 'input', () => schedule(() => sections.setAngles(Number(tilt.value), Number(azimuth.value))));
  listen(azimuth, 'input', () => schedule(() => sections.setAngles(Number(tilt.value), Number(azimuth.value))));
  listen(document.getElementById('cut-face-view'), 'click', onFaceView);
  listen(document.getElementById('cut-midline'), 'click', async () => {
    sections.setCrosshair([0, sections.state.crosshair[1], sections.state.crosshair[2]]);
    await sections.setMode('sagittal');
    onFaceView();
  });
  listen(document.getElementById('mpr-open'), 'click', async () => {
    await sections.load();
    dialog.showModal();
    previousImage = null;
    update();
  });
  listen(document.getElementById('mpr-close'), 'click', () => dialog.close());
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
    heading.textContent = LABELS[name];
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `${LABELS[name]} MRI. Click to place crosshair; arrow keys change slice.`);
    const label = document.createElement('label');
    label.textContent = `${LABELS[name]} position (mm)`;
    const slider = document.createElement('input');
    slider.type = 'range'; slider.min = '-128'; slider.max = '128'; slider.step = '1';
    slider.setAttribute('aria-label', `${LABELS[name]} MRI position`);
    const output = document.createElement('output');
    output.className = 'measure';
    const exportButton = document.createElement('button');
    exportButton.type = 'button'; exportButton.textContent = 'Save PNG';
    label.append(slider, output);
    article.append(heading, canvas, label, exportButton);
    grid.append(article);
    panels.set(name, { canvas, slider, output });
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
      ctx.fillText(frame.edges[index], ...point);
    }
    ctx.font = '12px monospace'; ctx.textAlign = 'left';
    ctx.fillText(`${LABELS[name]} ${sections.state.crosshair[AXES[name]].toFixed(1)} mm`, 10, size-12);
  }

  function update() {
    const state = sections.state;
    mode.value = state.mode;
    document.getElementById('cut-axis').textContent = {
      off: 'Position (mm)', sagittal: 'R coordinate (mm): − left / + right',
      coronal: 'A coordinate (mm): − posterior / + anterior',
      axial: 'S coordinate (mm): − inferior / + superior', oblique: 'Normal offset from origin (mm)',
    }[state.mode];
    const offset = new Vector3(...state.crosshair).dot(sections.frame.normal);
    if (document.activeElement !== position) position.value = String(offset);
    if (document.activeElement !== number) number.value = offset.toFixed(1);
    reverse.checked = state.reverse; mri.checked = state.showMRI;
    overlay.checked = state.overlay; mprOverlay.checked = state.overlay;
    oblique.hidden = state.mode !== 'oblique';
    tilt.value = state.tilt; azimuth.value = state.azimuth;
    document.getElementById('cut-angles').textContent = `${state.tilt}° / ${state.azimuth}°`;
    for (const element of [position,number,reverse,mri,document.getElementById('cut-face-view')]) {
      element.disabled = !sections.active;
    }
    status.textContent = state.status === 'loading' ? 'Loading source MRI…'
      : state.error || (sections.active ? `Cut at ${offset.toFixed(1)} mm · source grid 1 mm` : 'Full brain · no cut');
    if (!dialog.open || !sections.volumes) return;
    width.value = sections.display.windowWidth; center.value = sections.display.windowCenter;
    const sample = sections.sample(state.crosshair);
    readout.textContent = `R ${state.crosshair[0].toFixed(1)} · A ${state.crosshair[1].toFixed(1)} · S ${state.crosshair[2].toFixed(1)} mm — ${sample.name} (label ${sample.labelId})`;
    const imageKey = JSON.stringify([state.crosshair,state.overlay,sections.display.windowCenter,sections.display.windowWidth]);
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
