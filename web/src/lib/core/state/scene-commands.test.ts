import assert from 'node:assert/strict';
import { onTestFinished, test, vi } from 'vitest';
import { createSceneCommands } from './scene-commands.ts';
import { createSession } from './session.ts';

const REGIONS = [
  { id: 'destrieux:left:12', atlas: 'destrieux', kind: 'cortex', hemisphere: 'left' },
  { id: 'hcp-mmp:left:44', atlas: 'hcp-mmp', kind: 'cortex', hemisphere: 'left' },
  { id: 'aseg:left:11', atlas: 'aseg', kind: 'structure', hemisphere: 'left' },
  { id: 'nextbrain:left:458', atlas: 'nextbrain', kind: 'structure', hemisphere: 'left' },
];

/**
 * A model with BrainAtlas's own request rule: a layer switch that a later one
 * overtook does not apply when its download lands. Downloads finish on demand.
 */
function fixture({ atlas = 'hcp-mmp', detail = 'aseg', cord = true } = {}) {
  const downloads = new Map();
  const shown = [];
  const model = {
    disposed: false,
    manifest: { supplemental_layers: cord ? [{ id: 'zanatomy', file: 'spinal-cord.glb' }] : [] },
    envelopes: null,
    spinalCordLoadState: 'unloaded',
    spinalCordVisible: false,
    layers: new Map([[atlas, {}], [detail, {}]]),
    regions: new Map(REGIONS.map(region => [region.id, region])),
    cabNp: { atlas: 'hcp-mmp' },
    functionalRegions: { atlas: 'hcp-mmp' },
    atlasId: atlas,
    detailId: detail,
    surfaceColor: 'atlas',
    internalVisible: true,
    selectedId: 'aseg:left:11',
    atlasRequest: 0,
    detailRequest: 0,
    get settings() {
      return { atlas: this.atlasId, detail: this.detailId, surfaceColor: this.surfaceColor,
        cortexOpacity: 1, internalVisible: this.internalVisible };
    },
    hasLayer(id) { return this.layers.has(id); },
    get envelopesLoaded() { return Boolean(this.envelopes); },
    get spinalCordLoad() { return this.spinalCordLoadState; },
    loadLayer(id, progress) {
      if (this.layers.has(id)) return Promise.resolve();
      if (!downloads.has(id)) {
        const entry = { progress };
        entry.promise = new Promise((resolve, reject) => Object.assign(entry, { resolve, reject }));
        downloads.set(id, entry);
      }
      return downloads.get(id).promise;
    },
    async setAtlas(id, progress) {
      const request = ++this.atlasRequest;
      await this.loadLayer(id, progress);
      if (request !== this.atlasRequest) return;
      this.atlasId = id;
      if (this.surfaceColor === 'cab-np' && id !== this.cabNp.atlas) this.surfaceColor = 'atlas';
      this.selectedId = null;
    },
    async setDetail(id, progress) {
      const request = ++this.detailRequest;
      await this.loadLayer(id, progress);
      if (request !== this.detailRequest) return;
      this.detailId = id;
    },
    async ensureEnvelopes(progress) {
      if (this.envelopes) return this.envelopes;
      await this.loadLayer('envelopes', progress);
      this.envelopes ??= [];
      return this.envelopes;
    },
    async ensureSpinalCord(progress) {
      if (!cord) throw new Error('This anatomy does not publish a spinal cord.');
      await this.loadLayer('zanatomy', progress);
      this.spinalCordLoadState = 'ready';
    },
    async setSpinalCordVisible(visible, progress) {
      if (visible) await this.ensureSpinalCord(progress);
      this.spinalCordVisible = visible;
    },
    clearIsolation() {},
    setInternalSystem() {},
    setHemisphere() {},
    setCortexVisible() {},
    setCortexOpacity() {},
    setInternalVisible(value) { this.internalVisible = value; },
    showRegions(ids) { shown.push(ids); },
    select(id) { this.selectedId = id; },
  };
  // BrainSections' own rule: a later colour, or the command's own intent check, overtakes one still loading.
  const sections = {
    mode: 'off',
    appearanceRequest: 0,
    get solidsReady() { return Boolean(model.envelopes); },
    async setMode(mode) {
      if (mode !== 'off') await model.ensureEnvelopes();
      this.mode = mode;
    },
    async setSurfaceColor(value, current = () => true) {
      const request = ++this.appearanceRequest;
      if (value === 'cab-np' && model.atlasId !== model.cabNp.atlas) throw new Error('CAB-NP needs HCP-MMP first');
      if (value === 'functional') await model.ensureEnvelopes();
      if (value === 'mri') await model.loadLayer('mri');
      if (request !== this.appearanceRequest || !current()) return;
      model.surfaceColor = value;
    },
  };
  const session = createSession({ views: ['oblique'] });
  session.setStatus('ready');
  let renders = 0;
  const commands = createSceneCommands({ model, sections, session, render: () => { renders += 1; } });
  const settle = () => new Promise(resolve => setImmediate(resolve));
  return {
    model, sections, session, commands, shown, settle,
    get renders() { return renders; },
    tick(id, loaded, total) { downloads.get(id).progress?.({ loaded, total }); },
    async finish(id) {
      const entry = downloads.get(id);
      downloads.delete(id);
      model.layers.set(id, {});
      entry.resolve();
      await settle();
    },
    async fail(id, error) {
      downloads.get(id).reject(error);
      downloads.delete(id);
      await settle();
    },
  };
}

/** What `openDeficit` does with the scene: begin, then reveal the mapped regions. */
const openDeficit = (commands, ids) => {
  const current = commands.begin();
  return commands.revealRegions(ids, current);
};

test('opening deficit A then B quickly leaves B’s scene when A’s download lands later', async () => {
  const scene = fixture();
  const a = openDeficit(scene.commands, ['destrieux:left:12']);
  await scene.settle();
  const b = openDeficit(scene.commands, ['aseg:left:11']);
  assert.equal(await b, true);
  await scene.finish('destrieux');
  assert.equal(await a, false, 'A was overtaken');
  assert.equal(scene.model.atlasId, 'hcp-mmp', 'A’s atlas did not land over B');
  assert.deepEqual(scene.shown, [['aseg:left:11']], 'only B’s regions were drawn');
});

test('when both deficits download, B’s layer lands and A’s does not', async () => {
  const scene = fixture();
  const a = openDeficit(scene.commands, ['aseg:left:11', 'destrieux:left:12']);
  await scene.settle();
  const b = openDeficit(scene.commands, ['nextbrain:left:458']);
  await scene.settle();
  await scene.finish('destrieux');
  await scene.finish('nextbrain');
  assert.deepEqual([await a, await b], [false, true]);
  assert.equal(scene.model.atlasId, 'hcp-mmp');
  assert.equal(scene.model.detailId, 'nextbrain');
  assert.deepEqual(scene.shown, [['nextbrain:left:458']]);
});

test('a deficit’s downloads report in the status bar like the masthead’s switches, then step aside', async () => {
  const scene = fixture();
  const opening = openDeficit(scene.commands, ['destrieux:left:12']);
  await scene.settle();
  assert.equal(scene.session.assemble({}).status, 'switching');
  scene.tick('destrieux', 4, 16);
  assert.deepEqual(scene.session.assemble({}).progress, { loaded: 4, total: 16 });
  await scene.finish('destrieux');
  assert.equal(await opening, true);
  assert.equal(scene.session.assemble({}).status, 'ready');
  assert.equal(scene.model.atlasId, 'destrieux');
});

test('the other detail level is fetched with progress before a hidden region is shown', async () => {
  const scene = fixture({ detail: 'learning' });
  const current = scene.commands.begin();
  const loading = scene.commands.loadDetail('aseg', current);
  await scene.settle();
  assert.equal(scene.session.assemble({}).status, 'switching');
  await scene.finish('aseg');
  await loading;
  assert.equal(scene.model.detailId, 'aseg');
  assert.equal(scene.session.assemble({}).status, 'ready');
});

test('a colour chosen while CAB-NP waits on its atlas is not overwritten when the atlas arrives', async () => {
  const scene = fixture({ atlas: 'destrieux' });
  const cabNp = scene.commands.chooseSurfaceColor('cab-np');
  await scene.settle();
  await scene.commands.chooseSurfaceColor('tissue');
  await scene.finish('hcp-mmp');
  await cabNp;
  assert.equal(scene.model.surfaceColor, 'tissue');
});

test('CAB-NP, chosen or restored from a link, first shows the atlas it colours', async () => {
  const scene = fixture({ atlas: 'destrieux' });
  const choosing = scene.commands.chooseSurfaceColor('cab-np');
  await scene.settle();
  await scene.finish('hcp-mmp');
  await choosing;
  assert.deepEqual([scene.model.atlasId, scene.model.surfaceColor], ['hcp-mmp', 'cab-np']);
  const linked = fixture({ atlas: 'destrieux' });
  const restoring = linked.commands.applySurfaceColor('cab-np', linked.commands.begin());
  await linked.settle();
  await linked.finish('hcp-mmp');
  assert.equal(await restoring, true);
  assert.deepEqual([linked.model.atlasId, linked.model.surfaceColor], ['hcp-mmp', 'cab-np']);
});

test('entering the glass brain hides the internal anatomy and says how to show it; restoring it does not', async () => {
  const scene = fixture();
  scene.model.envelopes = [];
  await scene.commands.chooseSurfaceColor('functional');
  assert.equal(scene.model.internalVisible, false);
  assert.match(scene.session.assemble({}).notice.text, /^Internal anatomy is hidden/);
  const linked = fixture();
  linked.model.envelopes = [];
  await linked.commands.applySurfaceColor('functional', linked.commands.begin());
  assert.equal(linked.model.internalVisible, true);
});

test('the glass brain’s envelope download reports its bytes like a layer switch', async () => {
  const scene = fixture();
  const choosing = scene.commands.chooseSurfaceColor('functional');
  await scene.settle();
  scene.tick('envelopes', 5, 15);
  assert.deepEqual(scene.session.assemble({}).progress, { loaded: 5, total: 15 });
  await scene.finish('envelopes');
  await choosing;
  assert.equal(scene.model.surfaceColor, 'functional');
  assert.equal(scene.session.assemble({}).status, 'ready');
});

test('the first showing of the cord is a download with progress; an anatomy without one refuses', async () => {
  const scene = fixture();
  const showing = scene.commands.showSpinalCord(true, scene.commands.begin());
  await scene.settle();
  scene.tick('zanatomy', 1, 4);
  assert.deepEqual(scene.session.assemble({}).progress, { loaded: 1, total: 4 });
  await scene.finish('zanatomy');
  assert.equal(await showing, true);
  assert.equal(scene.model.spinalCordVisible, true);
  const without = fixture({ cord: false });
  await assert.rejects(without.commands.showSpinalCord(true, without.commands.begin()), /does not publish a spinal cord/);
  assert.equal(await without.commands.showSpinalCord(false, without.commands.begin()), true);
});

test('the first cut downloads the envelopes and the cord, and a later command overtakes it', async () => {
  const scene = fixture();
  const cutting = scene.commands.cut('axial', scene.commands.begin());
  await scene.settle();
  assert.equal(scene.session.assemble({}).status, 'switching');
  scene.commands.begin();
  await scene.finish('envelopes');
  await scene.finish('zanatomy');
  assert.equal(await cutting, false, 'overtaken: the caller must not face the cut');
  assert.equal(scene.session.assemble({}).status, 'ready');
  const ready = fixture({ cord: false });
  ready.model.envelopes = [];
  assert.equal(await ready.commands.cut('coronal', ready.commands.begin()), true);
  assert.equal(ready.sections.mode, 'coronal');
});

test('a failed atlas switch leaves one translated notice; an overtaken one says nothing', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const scene = fixture();
  scene.session.setLang('fr');
  const switching = scene.commands.chooseAtlas('destrieux');
  await scene.settle();
  await scene.fail('destrieux', Object.assign(new Error('HTTP 503'), { code: 'asset-fetch' }));
  await switching;
  const { notice, status } = scene.session.assemble({});
  assert.equal(status, 'ready');
  assert.match(notice.text, /^Impossible de charger Destrieux\. Un fichier n’a pas pu être téléchargé/);
  const quiet = fixture();
  const overtaken = quiet.commands.chooseAtlas('destrieux');
  await quiet.settle();
  quiet.commands.begin();
  await quiet.fail('destrieux', new Error('HTTP 503'));
  await overtaken;
  assert.equal(quiet.session.assemble({}).notice, null);
});

test('switching away from HCP-MMP drops CAB-NP, which its option named, and retires the standing notice', async () => {
  const scene = fixture();
  scene.model.surfaceColor = 'cab-np';
  scene.session.notify({ text: 'An earlier notice.' });
  const switching = scene.commands.chooseAtlas('destrieux');
  await scene.settle();
  await scene.finish('destrieux');
  await switching;
  assert.equal(scene.model.surfaceColor, 'atlas');
  assert.equal(scene.session.assemble({}).notice, null);
});

test('a colour that switches the atlas retires a notice the screen no longer bears out', async () => {
  const scene = fixture({ atlas: 'destrieux' });
  scene.session.notify({ text: 'CAB-NP colours HCP-MMP areas only, so Destrieux shows its own region colours.' });
  const choosing = scene.commands.chooseSurfaceColor('cab-np');
  await scene.settle();
  await scene.finish('hcp-mmp');
  await choosing;
  assert.deepEqual([scene.model.atlasId, scene.model.surfaceColor], ['hcp-mmp', 'cab-np']);
  assert.equal(scene.session.assemble({}).notice, null);
});

test('asking for the atlas on screen is free, unless another is still on its way', async () => {
  const scene = fixture();
  const current = scene.commands.begin();
  await scene.commands.loadAtlas('hcp-mmp', current);
  assert.equal(scene.model.atlasRequest, 0);
  const away = scene.commands.loadAtlas('destrieux', current);
  await scene.settle();
  await scene.commands.loadAtlas('hcp-mmp', scene.commands.begin());
  await scene.finish('destrieux');
  await away;
  assert.equal(scene.model.atlasId, 'hcp-mmp');
});

test('a colour still downloading does not land after the reader keeps the one shown, resets or opens a link', async () => {
  for (const overtake of [
    scene => scene.commands.chooseSurfaceColor('atlas'),
    scene => { scene.commands.begin(); scene.model.surfaceColor = 'atlas'; },
    scene => scene.commands.applySurfaceColor('atlas', scene.commands.begin()),
  ]) {
    const scene = fixture();
    const choosing = scene.commands.chooseSurfaceColor('mri');
    await scene.settle();
    await overtake(scene);
    await scene.finish('mri');
    await choosing;
    assert.equal(scene.model.surfaceColor, 'atlas');
    assert.equal(scene.session.assemble({}).status, 'ready');
  }
});
