import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { createSession } from '../state/session.js';

const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const chooseExplorer = app.match(/  function chooseExplorer\(value\) \{[\s\S]*?\n  \}/)[0];

// Exercise the app's command without constructing its WebGL scene or downloading anatomy.
function navigation(opacity = 1, anatomy = 'bert') {
  const session = createSession({ views: [] });
  const model = {
    state: { cortexOpacity: opacity },
    setCortexOpacity(value) { this.state.cortexOpacity = value; },
  };
  const nativeTracts = {
    anatomy: 'bert', defaultOpacity: 0.16, visible: false,
    enableOverlay() { this.visible = true; },
    disableOverlay() { this.visible = false; },
  };
  const choose = runInNewContext(`let beforeTractsOpacity = null;
    ${chooseExplorer}
    chooseExplorer;`, { session, model, nativeTracts, anatomy, render() {} });
  return { choose, model, nativeTracts };
}

for (const tab of ['anatomy', 'deficits', 'circuits']) {
  test(`leaving Tracts for ${tab} restores opacity and removes the overlay`, () => {
    const { choose, model, nativeTracts } = navigation();
    choose('diffusion');
    assert.equal(model.state.cortexOpacity, 0.16);
    assert.equal(nativeTracts.visible, true);
    choose(tab);
    assert.equal(model.state.cortexOpacity, 1);
    assert.equal(nativeTracts.visible, false);
  });
}

test('a custom opacity returns even after adjusting it in Tracts or choosing Tracts again', () => {
  const { choose, model, nativeTracts } = navigation(0.64);
  choose('diffusion');
  assert.equal(model.state.cortexOpacity, 0.64);
  model.setCortexOpacity(0.22);
  choose('diffusion');
  choose('anatomy');
  assert.equal(model.state.cortexOpacity, 0.64);
  assert.equal(nativeTracts.visible, false);
});

test('each visit returns to the opacity from that visit, including zero', () => {
  const { choose, model } = navigation();
  choose('diffusion');
  choose('anatomy');
  model.setCortexOpacity(0);
  choose('diffusion');
  model.setCortexOpacity(0.4);
  choose('anatomy');
  assert.equal(model.state.cortexOpacity, 0);
});

test('Tracts on another subject leaves the anatomy opacity alone', () => {
  const { choose, model, nativeTracts } = navigation(0.7, 'aomic');
  choose('diffusion');
  assert.equal(nativeTracts.visible, false);
  choose('anatomy');
  assert.equal(model.state.cortexOpacity, 0.7);
});
