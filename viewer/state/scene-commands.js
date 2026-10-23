import { clinicalLayers, showClinicalRegions } from '../clinical/navigation.js';
import { failureNotice } from '../i18n/errors.js';
import { atlasSwitchLabel, t } from '../i18n/translations.js';

/** Whether a subject publishes the spinal cord; a scan ending inside the medulla does not. */
export const publishesSpinalCord = manifest => (manifest.supplemental_layers ?? []).some(layer => layer.id === 'zanatomy');

/** Colours that are defined on one atlas's areas, and so need that atlas shown. */
export const requiredAtlas = ({ cabNp, functionalRegions }, colour) => (colour === 'cab-np' ? cabNp?.atlas
  : colour === 'functional' ? functionalRegions?.atlas : null);

/**
 * The scene changes that wait on downloads: layer switches, surface colours and
 * drawing a set of regions. One intent token orders them: a command takes
 * `const current = begin()` and, after every await, stops once `current()` is
 * false, because a later command now owns the scene. Downloads report in the
 * status bar as the masthead's switches always have; failures become notices.
 */
export function createSceneCommands({ model, sections, session, render }) {
  let intent = 0;
  const downloads = new Map();
  // The layer each switch through these commands last asked the model for, while it loads.
  let atlasWanted = null;
  let detailWanted = null;

  function begin() {
    const mine = ++intent;
    return () => mine === intent && !model.disposed;
  }

  const lang = () => session.assemble({}).lang;

  function fail(operation, error, subject) {
    console.error(error);
    session.notify(failureNotice(error, lang(), operation, subject));
    render();
  }

  /** A failure is the reader's to hear only while its command still owns the scene. */
  function failIfCurrent(current, operation, error, subject) {
    if (current()) fail(operation, error, subject);
    else console.error(error);
  }

  function showProgress() {
    const known = [...downloads.values()].filter(Boolean);
    if (!downloads.size) session.endSwitching();
    else {
      session.setSwitching(known.length ? {
        loaded: known.reduce((sum, progress) => sum + progress.loaded, 0),
        total: known.reduce((sum, progress) => sum + progress.total, 0),
      } : null);
    }
    render();
  }

  async function download(load) {
    const key = Symbol('download');
    downloads.set(key, null);
    showProgress();
    try {
      return await load(progress => {
        if (!progress?.total) return;
        downloads.set(key, progress);
        showProgress();
      });
    } finally {
      downloads.delete(key);
      showProgress();
    }
  }

  const fetching = (id, load) => (model.layers.has(id) ? load() : download(load));

  /**
   * Show this atlas. Asking for the one on screen while another is still
   * loading re-asks the model for it, so the older switch does not land later.
   */
  async function loadAtlas(id, current) {
    if (id === model.settings.atlas && (atlasWanted ?? id) === id) return;
    atlasWanted = id;
    try {
      await fetching(id, progress => model.setAtlas(id, progress));
    } finally {
      if (atlasWanted === id) atlasWanted = null;
    }
    if (current() && model.settings.atlas !== id) throw new Error(`Atlas not applied: ${id}`);
  }

  async function loadDetail(id, current) {
    if (id === model.settings.detail && (detailWanted ?? id) === id) return;
    detailWanted = id;
    try {
      await fetching(id, progress => model.setDetail(id, progress));
    } finally {
      if (detailWanted === id) detailWanted = null;
    }
    if (current() && model.settings.detail !== id) throw new Error(`Detail level not applied: ${id}`);
  }

  const hasSpinalCord = () => publishesSpinalCord(model.manifest);

  // The model shares each download; asking first, with progress, is what puts it in the status bar.
  const envelopes = () => (model.envelopes ? null : download(progress => model.ensureEnvelopes(progress)));
  const spinalCord = () => (model.spinalCordLoadState === 'ready' ? null
    : download(progress => model.ensureSpinalCord(progress)));

  /** Colour the surface, first showing the atlas a network colouring is defined on. */
  async function applySurfaceColor(value, current) {
    const atlas = requiredAtlas(model, value);
    if (atlas) await loadAtlas(atlas, current);
    if (!current()) return false;
    // Through the sections even when the colour is already shown, so an older colour still loading is overtaken.
    const colour = () => sections.setSurfaceColor(value, current);
    // The scan and the glass solids, cut from the envelopes, are downloads of their own.
    if (value === 'functional' && value !== model.settings.surfaceColor) {
      await Promise.all([envelopes(), download(colour)]);
    } else if (value === 'mri' && value !== model.settings.surfaceColor) await download(colour);
    else await colour();
    return current();
  }

  /** Show or hide the spinal cord; its first showing downloads it. */
  async function showSpinalCord(visible, current) {
    if (visible && !hasSpinalCord()) throw new Error('This anatomy does not publish a spinal cord.');
    await (visible && model.spinalCordLoadState !== 'ready'
      ? download(progress => model.setSpinalCordVisible(true, progress))
      : model.setSpinalCordVisible(visible));
    return current();
  }

  /** The first cut downloads the tissue envelopes it caps, and the cord where one is published. */
  async function prepareCut(current) {
    if (!sections.solidsReady) await Promise.all([envelopes(), hasSpinalCord() ? spinalCord() : null]);
    return current();
  }

  async function cut(mode, current) {
    if (mode === 'off' || sections.solidsReady) await sections.setMode(mode);
    else await Promise.all([prepareCut(current), download(() => sections.setMode(mode))]);
    return current();
  }

  /** Draw cited regions together on the layers that hold most of them, without a misleading cut. */
  async function revealRegions(ids, current) {
    const layers = clinicalLayers(model, ids);
    if (!ids.length) return current();
    await loadAtlas(layers.atlas ?? model.settings.atlas, current);
    if (!current()) return false;
    await loadDetail(layers.detail ?? model.settings.detail, current);
    if (!current()) return false;
    await sections.setMode('off');
    if (!current()) return false;
    showClinicalRegions(model, ids);
    return true;
  }

  async function openRegion(id, current) {
    if (!(await revealRegions([id], current))) return false;
    model.select(id);
    return true;
  }

  /**
   * The masthead's atlas field. A colouring the new atlas cannot carry is dropped; the option
   * said so before it was chosen. Each masthead choice retires the notice an earlier one left.
   */
  async function chooseAtlas(id) {
    if (id === model.settings.atlas && atlasWanted === null) return;
    const current = begin();
    session.notify(null);
    try {
      await loadAtlas(id, current);
    } catch (error) {
      failIfCurrent(current, 'layer', error, atlasSwitchLabel(id, lang()));
      return;
    }
    if (current()) render();
  }

  async function chooseDetail(id) {
    if (id === model.settings.detail && detailWanted === null) return;
    const current = begin();
    session.notify(null);
    try {
      await loadDetail(id, current);
    } catch (error) {
      failIfCurrent(current, 'layer', error, atlasSwitchLabel(id, lang()));
      return;
    }
    if (current()) render();
  }

  /** The masthead's colour field; an atlas it switches to was named in the option. */
  async function chooseSurfaceColor(value) {
    const current = begin();
    session.notify(null);
    const entering = value === 'functional' && model.settings.surfaceColor !== 'functional';
    try {
      if (!(await applySurfaceColor(value, current))) return;
    } catch (error) {
      failIfCurrent(current, 'colour', error, t(lang(), 'display').surfaceColors[value]);
      return;
    }
    // The glass brain shows the cortex alone; the reader is told how to bring the internal anatomy back.
    if (entering && model.settings.internalVisible) {
      model.setInternalVisible(false);
      session.notify({ text: t(lang(), 'app').functionalHidesInternal });
    }
    render();
  }

  return {
    begin, fail, failIfCurrent, download, loadAtlas, loadDetail, applySurfaceColor, showSpinalCord,
    prepareCut, cut, revealRegions, openRegion,
    chooseAtlas, chooseDetail, chooseSurfaceColor,
  };
}
