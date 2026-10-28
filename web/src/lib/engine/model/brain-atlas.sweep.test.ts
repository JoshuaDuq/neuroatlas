/* oxlint-disable typescript/no-explicit-any -- the sweep drives the model through one untyped command surface */
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { Matrix4, Plane, Vector3 } from 'three';
import { visibilityOf } from '../../core/catalog/visibility.ts';
import { createMriUniforms } from '../render/mri-material.ts';
import { SURFACE_COLORS } from './brain-atlas.ts';
import { syntheticAtlas } from './test-support.ts';

type Stub = Record<string, any>;

/** mulberry32: a seeded PRNG, so every run draws the same commands. */
function prng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Random = ReturnType<typeof prng>;
const pick = <T>(random: Random, items: readonly T[]): T =>
  items[Math.floor(random() * items.length)]!;

const REGIONS = ['a-left', 'a-right', 'a-wall', 'b-left', 'stem', 'n-left'];
const MODES = [...SURFACE_COLORS, 'bogus'];

interface Command {
  name: string;
  args: any[];
  /** A command built from several model calls: a refusal part way through is not the model's to undo. */
  composite?: boolean;
}

function drawCommand(random: Random): Command {
  const ids = [...REGIONS, 'missing'];
  const subset = () =>
    Array.from({ length: 1 + Math.floor(random() * 5) }, () => pick(random, REGIONS));
  const planes = () =>
    Array.from({ length: Math.floor(random() * 3) }, () => ({
      normal: new Vector3(random() - 0.5, random() - 0.5, random() - 0.5).normalize().toArray(),
      constant: (random() - 0.5) * 0.2,
    }));
  const kinds: [number, () => Command][] = [
    [4, () => ({ name: 'setAtlas', args: [pick(random, ['a', 'b', 'missing'])] })],
    [3, () => ({ name: 'setDetail', args: [pick(random, ['aseg', 'missing'])] })],
    [5, () => ({ name: 'setHemisphere', args: [pick(random, ['both', 'left', 'right', 'up'])] })],
    [5, () => ({ name: 'setCortexVisible', args: [pick(random, [true, false, true, 'yes'])] })],
    [
      6,
      () => ({
        name: 'setCortexOpacity',
        args: [pick(random, [random(), 0, 1, 1, 1.5, -0.1, Number.NaN])],
      }),
    ],
    [4, () => ({ name: 'setInternalVisible', args: [pick(random, [true, false, true, 0])] })],
    [4, () => ({ name: 'setInternalSystem', args: [pick(random, [null, 'Imaginary system'])] })],
    [12, () => ({ name: 'setSurfaceColor', args: [pick(random, MODES)] })],
    [
      8,
      () => ({
        name: 'setPaint',
        args: [
          random() < 0.2
            ? null
            : random() < 0.05
              ? { id: 5, colors: new Map() }
              : {
                  id: pick(random, ['function:a', 'function:b', 'deficit:c']),
                  entries: subset().map((id) => [
                    id,
                    [0, 1, 2].map(() => Math.floor(random() * 256)),
                  ]),
                },
        ],
      }),
    ],
    [8, () => ({ name: 'select', args: [pick(random, [...ids, null])] })],
    [3, () => ({ name: 'isolate', args: [] })],
    [10, () => ({ name: 'selectAndIsolate', args: [pick(random, REGIONS)], composite: true })],
    [3, () => ({ name: 'clearIsolation', args: [] })],
    [
      5,
      () => ({ name: 'hideRegions', args: [random() < 0.1 ? [...subset(), 'missing'] : subset()] }),
    ],
    [3, () => ({ name: 'showRegions', args: [subset()] })],
    [2, () => ({ name: 'restoreHiddenRegions', args: [] })],
    [3, () => ({ name: 'undoDissection', args: [] })],
    [2, () => ({ name: 'loadHiddenRegions', args: [subset()] })],
    [5, () => ({ name: 'setClippingPlanes', args: [planes()] })],
    [1, () => ({ name: 'setClippingPlanes', args: [[{ normal: [2, 0, 0], constant: 0 }]] })],
    [
      4,
      () => ({
        name: 'setCutState',
        args: [{ atlas: pick(random, ['a', 'b', 'n', null]), active: random() < 0.6 }],
      }),
    ],
    [3, () => ({ name: 'setSpinalCordVisible', args: [pick(random, [true, false, true])] })],
    [1, () => ({ name: 'reset', args: [] })],
    [3, () => ({ name: 'centroidOf', args: [pick(random, ids)] })],
    [1, () => ({ name: 'update', args: [] })],
  ];
  const total = kinds.reduce((sum, [weight]) => sum + weight, 0);
  let at = random() * total;
  for (const [weight, make] of kinds) {
    at -= weight;
    if (at < 0) return make();
  }
  return kinds[0]![1]();
}

function run(model: Stub, command: Command) {
  const [first] = command.args;
  switch (command.name) {
    case 'setPaint':
      return model.setPaint(
        first && first.entries ? { id: first.id, colors: new Map(first.entries) } : first,
      );
    case 'setClippingPlanes':
      return model.setClippingPlanes(
        first.map(({ normal, constant }: Stub) => new Plane(new Vector3(...normal), constant)),
      );
    case 'loadHiddenRegions':
      return model.loadHiddenRegions(
        first.filter((id: string) => id !== model.dissectionSelection.isolatedId),
      );
    case 'selectAndIsolate':
      model.select(first);
      return model.isolate();
    case 'centroidOf':
      return model.centroidOf(first);
    default:
      return model[command.name](...command.args);
  }
}

/** Everything the display is made of, as plain data. */
function displayOf(model: Stub, events: string[]) {
  return JSON.stringify({
    settings: {
      ...model.settings,
      internalConstituents: [...model.settings.internalConstituents],
      hiddenRegions: [...model.settings.hiddenRegions],
    },
    selected: model.selectedId,
    layers: [...model.layers].map(([id, layer]: [string, Stub]) => [
      id,
      layer.scene.visible,
      layer.meshes.map((mesh: Stub) => [
        mesh.userData.region_id,
        mesh.visible,
        mesh.material.color.getHex(),
        mesh.material.opacity,
        mesh.material.transparent,
        mesh.material.depthWrite,
      ]),
    ]),
    planes: model.clippingPlanes.map((plane: Plane) => [...plane.normal.toArray(), plane.constant]),
    events,
  });
}

test('ATLAS-21, ATLAS-22 and ATLAS-33 after each of 300 seeded commands, meshes follow the shared rule, a refusal changes nothing and the feather follows the display', async () => {
  const model = syntheticAtlas() as unknown as Stub;
  await model.initialize('a');
  const events: string[] = [];
  model.addEventListener('change', () => events.push('change'));
  model.addEventListener('selectionchange', (event: Stub) =>
    events.push(`selectionchange:${event.detail?.id ?? null}`),
  );
  // A scan, so the sweep reaches the states that need it.
  model.setMriAnatomy({
    mriUniforms: createMriUniforms({
      texture: null,
      worldToVoxel: new Matrix4(),
      volume: { shape: [2, 2, 2] },
    } as never),
  });

  const random = prng(0xe4b);
  const seen = {
    colors: new Set<string>(),
    hemispheres: new Set<string>(),
    refused: 0,
    changed: 0,
    hidden: 0,
    isolated: new Set<string>(),
  };
  let previous = displayOf(model, []);
  for (let index = 0; index < 300; index++) {
    const command = drawCommand(random);
    const before = displayOf(model, events);
    let refused = false;
    try {
      await run(model, command);
      while (model.pending.size) await Promise.allSettled(model.pending.values());
    } catch {
      refused = true;
      seen.refused += 1;
    }
    const label = `#${index} ${command.name} ${JSON.stringify(command.args)}`;
    if (refused && !command.composite)
      assert.equal(displayOf(model, events), before, `ATLAS-22: ${label} changed the display`);

    for (const [id, layer] of model.layers as Map<string, Stub>) {
      for (const mesh of layer.meshes as Stub[]) {
        const region = model.regions.get(mesh.userData.region_id)!;
        assert.equal(
          mesh.visible && layer.scene.visible,
          visibilityOf(region, model.settings).visible,
          `ATLAS-21: ${id}/${region.id} after ${label}`,
        );
      }
      if (layer.featherPalette) {
        const data = layer.featherPalette.image.data as Float32Array;
        (layer.meshes as Stub[]).forEach((mesh, slot) => {
          const { r, g, b } = mesh.material.color;
          assert.deepEqual(
            Array.from(data.slice(slot * 4, slot * 4 + 4)),
            [r, g, b, mesh.visible ? 1 : 0].map(Math.fround),
            `ATLAS-33: slot ${slot} after ${label}`,
          );
        });
      } else {
        assert.equal(
          id === 'aseg' || layer.meshes.every((mesh: Stub) => mesh.userData.kind !== 'cortex'),
          true,
          `${id} is not feathered`,
        );
      }
    }
    const now = displayOf(model, []);
    if (now !== previous) seen.changed += 1;
    previous = now;
    seen.colors.add(model.surfaceColor);
    seen.hemispheres.add(model.hemisphere);
    seen.hidden = Math.max(seen.hidden, model.state.hiddenRegions.size);
    if (model.settings.isolatedRegion) seen.isolated.add(model.settings.isolatedRegion);
  }
  // The script has to reach the states it claims to sweep, or agreement proves little.
  assert.deepEqual([...seen.hemispheres].sort(), ['both', 'left', 'right']);
  assert.ok(seen.colors.size >= 4, [...seen.colors].join());
  assert.ok(seen.hidden >= 2, 'regions are dissected');
  assert.ok(seen.isolated.size >= 2, `isolated: ${[...seen.isolated]}`);
  assert.ok(seen.changed >= 100, `${seen.changed} commands changed the display`);
  assert.ok(seen.refused >= 10, `${seen.refused} commands were refused`);
  model.dispose();
});

async function opened() {
  const model = syntheticAtlas() as unknown as Stub;
  await model.initialize('a');
  const events: string[] = [];
  model.addEventListener('change', () => events.push('change'));
  model.addEventListener('selectionchange', (event: Stub) =>
    events.push(`selectionchange:${event.detail?.id ?? null}`),
  );
  return { model, events };
}

test('ATLAS-13 changing the atlas drops the selection and the isolation', async () => {
  const { model, events } = await opened();
  model.select('a-right');
  model.isolate();
  events.length = 0;
  await model.setAtlas('b');
  assert.equal(model.state.selectedRegion, null);
  assert.equal(model.state.isolatedRegion, null);
  assert.equal(events.filter((event) => event.startsWith('selectionchange')).length, 1);
  assert.ok(events.includes('selectionchange:null'));
  model.dispose();
});

test('ATLAS-22 each refused command names its fault and changes nothing', async () => {
  const { model, events } = await opened();
  const refusals: [() => unknown, RegExp][] = [
    [() => model.setSurfaceColor('bogus'), /Unknown surface colour: bogus/],
    [
      () => model.setPaint({ id: 5, colors: new Map() } as never),
      /A paint needs an id and a Map of region colours/,
    ],
    [
      () => model.setPaint({ id: 'x', colors: {} } as never),
      /A paint needs an id and a Map of region colours/,
    ],
    [
      () => model.setClippingPlanes([new Plane(new Vector3(2, 0, 0), 0)]),
      /Clipping requires normalized, finite Three.js planes/,
    ],
    [() => model.isolate(), /Select a region before isolating/],
  ];
  const before = displayOf(model, events);
  for (const [command, message] of refusals) {
    assert.throws(command, message);
    assert.equal(displayOf(model, events), before, String(message));
  }
  await assert.rejects(model.setSpinalCordVisible('yes' as never), {
    name: 'TypeError',
    message: 'Spinal cord visibility must be boolean.',
  });
  assert.equal(displayOf(model, events), before);
  model.dispose();
});

test('ATLAS-33 under CAB-NP colour a parcel is feathered in its network colour, and stops at a hidden one', async () => {
  const { model } = await opened();
  const texel = (id: string) => {
    const layer = model.layers.get('a') as Stub;
    const slot = layer.meshes.findIndex((mesh: Stub) => mesh.userData.region_id === id);
    return Array.from(
      (layer.featherPalette.image.data as Float32Array).slice(slot * 4, slot * 4 + 4),
    );
  };
  assert.equal((model.layers.get('aseg') as Stub).featherPalette, null);
  model.setSurfaceColor('cab-np');
  assert.deepEqual(texel('a-left'), [1, 0, 0, 1]);
  model.hideRegions(['a-left']);
  assert.equal(texel('a-left')[3], 0);
  model.dispose();
});

test('ATLAS-40 reset keeps the atlas, the detail level and the paint, and cancels a cord shown but not yet loaded', async () => {
  const { model, events } = await opened();
  model.setPaint({ id: 'function:a', colors: new Map([['a-left', [1, 2, 3]]]) } as never);
  model.setHemisphere('left');
  model.setCortexOpacity(0.4);
  model.select('a-left');
  model.isolate();
  events.length = 0;
  model.reset();
  assert.equal(model.settings.paint?.id, 'function:a');
  assert.equal(model.settings.atlas, 'a');
  assert.equal(model.settings.hemisphere, 'both');
  assert.equal(model.settings.cortexOpacity, 1);
  assert.equal(model.settings.isolatedRegion, null);
  assert.equal(model.state.visibleMeshCount, 4);
  assert.equal(events.filter((event) => event === 'selectionchange:null').length, 1);
  model.dispose();
});

test('ATLAS-46 a centroid is the box centre in surface RAS millimetres, computed once, and absent for no mesh', async () => {
  const { model } = await opened();
  assert.deepEqual(
    model.centroidOf('a-left')!.map((value: number) => value + 0),
    [0, 0, 0],
  );
  const right = model.centroidOf('a-right');
  assert.deepEqual(
    right!.map((value: number) => value + 0),
    [30, 0, 0],
  );
  assert.equal(model.centroidOf('a-right'), right);
  for (const id of ['n-left', 'nonexistent', null]) assert.equal(model.centroidOf(id), null);
  model.dispose();
});

test('ATLAS-36 a change of view releases the isolation; opacity, colour, paint and planes keep it', async () => {
  const releasing: [string, (model: Stub) => unknown][] = [
    ['setAtlas', (model) => model.setAtlas('b')],
    ['setHemisphere', (model) => model.setHemisphere('left')],
    ['setCortexVisible', (model) => model.setCortexVisible(false)],
    ['setInternalVisible', (model) => model.setInternalVisible(false)],
    ['clearIsolation', (model) => model.clearIsolation()],
  ];
  for (const [name, command] of releasing) {
    const { model } = await opened();
    model.select('a-right');
    model.isolate();
    assert.equal(model.settings.isolatedRegion, 'a-right', name);
    await command(model);
    assert.equal(model.settings.isolatedRegion, null, `${name} releases the isolation`);
    model.dispose();
  }
  const keeping: [string, (model: Stub) => unknown][] = [
    ['setCortexOpacity', (model) => model.setCortexOpacity(0.5)],
    ['setSurfaceColor', (model) => model.setSurfaceColor('cab-np')],
    [
      'setPaint',
      (model) => model.setPaint({ id: 'function:a', colors: new Map([['a-right', [1, 2, 3]]]) }),
    ],
    ['setClippingPlanes', (model) => model.setClippingPlanes([new Plane(new Vector3(0, 0, 1), 1)])],
  ];
  for (const [name, command] of keeping) {
    const { model } = await opened();
    model.select('a-right');
    model.isolate();
    await command(model);
    assert.equal(model.settings.isolatedRegion, 'a-right', `${name} keeps the isolation`);
    assert.equal(model.state.selectedRegion?.id, 'a-right', name);
    model.dispose();
  }
});

test('ATLAS-17 the cortex and internal switches take only a boolean, and drop the meshes they hide', async () => {
  const { model } = await opened();
  assert.throws(() => model.setCortexVisible('yes'), {
    name: 'TypeError',
    message: 'Cortex visibility must be boolean.',
  });
  assert.throws(() => model.setInternalVisible(0), {
    name: 'TypeError',
    message: 'Internal anatomy visibility must be boolean.',
  });
  model.setInternalVisible(false);
  assert.equal(model.state.visibleMeshCount, 3);
  model.setInternalVisible(true);
  assert.equal(model.state.visibleMeshCount, 4);
  model.setCortexVisible(false);
  assert.deepEqual(
    model.visibleMeshes.map((mesh: Stub) => mesh.userData.region_id),
    ['stem'],
  );
  model.dispose();
});

test('ATLAS-18 a see-through cortex is drawn transparent without depth writes, spares the structures and keeps the isolation', async () => {
  const { model } = await opened();
  model.select('a-right');
  model.isolate();
  model.setCortexOpacity(0.3);
  const material = (id: string) =>
    [...(model.layers as Map<string, Stub>).values()]
      .flatMap((layer) => layer.meshes as Stub[])
      .find((mesh) => mesh.userData.region_id === id)!.material;
  const right = material('a-right');
  assert.deepEqual([right.opacity, right.transparent, right.depthWrite], [0.3, true, false]);
  assert.equal(material('stem').opacity, 1);
  assert.equal(model.settings.isolatedRegion, 'a-right');
  for (const bad of [1.1, -0.1, NaN]) {
    assert.throws(() => model.setCortexOpacity(bad), {
      name: 'RangeError',
      message: 'Cortex opacity must be between 0 and 1.',
    });
  }
  model.dispose();
});

test('ATLAS-30 under a paint a painted area stays opaque while the unpainted cortex takes the cortex opacity', async () => {
  const { model } = await opened();
  model.setCortexOpacity(0.5);
  model.setPaint({ id: 'deficit:aphasia', colors: new Map([['a-left', [255, 0, 0]]]) });
  const opacity = (id: string) =>
    (model.layers.get('a') as Stub).meshes.find((mesh: Stub) => mesh.userData.region_id === id)
      .material.opacity;
  assert.deepEqual([opacity('a-left'), opacity('a-right')], [1, 0.5]);
  model.dispose();
});

test('ATLAS-19 reporting the same cut state again changes nothing', async () => {
  const { model, events } = await opened();
  model.setCutState({ atlas: 'n', active: true });
  events.length = 0;
  model.setCutState({ atlas: 'n', active: true });
  assert.deepEqual(events, []);
  model.setCutState({ atlas: 'n', active: false });
  assert.deepEqual(events, ['change']);
  model.dispose();
});

test('ATLAS-32 a scan is attached once, another is refused, and a paint turns the scan off', async () => {
  const { model } = await opened();
  const scan = () => ({
    mriUniforms: createMriUniforms({
      texture: null,
      worldToVoxel: new Matrix4(),
      volume: { shape: [2, 2, 2] },
    } as never),
  });
  assert.throws(() => model.setMriAnatomy(null), { message: 'MRI anatomy has not loaded.' });
  const first = scan();
  model.setMriAnatomy(first);
  model.setMriAnatomy(first);
  assert.throws(() => model.setMriAnatomy(scan()), { message: 'MRI anatomy is already attached.' });
  model.setSurfaceColor('mri');
  assert.equal(first.mriUniforms.scanEnabled.value, true);
  model.setPaint({ id: 'function:a', colors: new Map([['a-left', [1, 2, 3]]]) });
  assert.equal(first.mriUniforms.scanEnabled.value, false);
  model.dispose();
});
