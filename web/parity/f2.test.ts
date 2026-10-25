import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { Group } from 'three';
import manifest from '../../public/models/cdmd/manifest.json' with { type: 'json' };
import { BrainAtlas } from '../../viewer/model/brain-atlas.js';
import { BrainSections } from '../../viewer/slices/sections.js';
import type { Manifest } from '../src/lib/types/index.ts';
import { createFakeEngine } from '../src/lib/engine/fake.ts';

/**
 * The fake engine against the legacy `BrainAtlas` and `BrainSections` it stands in for. The legacy classes run
 * on the published manifest with no meshes and no tissue envelopes, driven by a seeded sequence of operations;
 * after every one the two must agree on whether it threw (and with what), and on the display settings, the
 * selection and the cut. Operations the fake claims to model are driven; downloads and drawing are not.
 */

const published = manifest as unknown as Manifest;
const regionIds = published.regions.map((region) => region.id);

/** mulberry32: a 32-bit seeded generator, so a failure replays. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(random: () => number, items: readonly T[]) =>
  items[Math.floor(random() * items.length)]!;

/** A legacy model with its first atlas and default detail "loaded" but no meshes. */
function legacyModel() {
  const loader = { loadAsync: () => new Promise(() => {}) };
  const model = new BrainAtlas(published, loader);
  model.atlasId = published.atlases[0]!.id;
  model.detailId = model.defaultDetail;
  model.layers.set(model.atlasId, { scene: new Group(), meshes: [] });
  model.layers.set(model.detailId, { scene: new Group(), meshes: [] });
  return model;
}

function fakeEngine() {
  return createFakeEngine({ manifest: published });
}

const plain = (settings: Record<string, unknown>) =>
  JSON.parse(
    JSON.stringify(settings, (_key, value: unknown) =>
      value instanceof Set ? [...value].sort() : value instanceof Map ? [...value] : value,
    ),
  ) as unknown;

/** Run an operation, reporting a throw as its class and message. */
function outcome(run: () => unknown) {
  try {
    run();
    return null;
  } catch (error) {
    return `${(error as Error).constructor.name}: ${(error as Error).message}`;
  }
}

const hemisphereChoices: string[] = ['both', 'left', 'right', 'up', ''];
const levelChoices = ['named', 'sections', 'deep'];

describe('F2 parity: the fake model against BrainAtlas', () => {
  it('agrees with BrainAtlas over a seeded sequence of display operations', () => {
    const random = seeded(20261025);
    const legacy = legacyModel();
    const fake = fakeEngine().model;
    const systems = [
      ...new Set(
        published.regions
          .filter((region) => region.kind === 'structure' && region.system_names)
          .map((region) => region.system_names!.en!),
      ),
      'No such system',
      null,
    ];
    const operations: ((model: typeof fake | typeof legacy) => void)[] = [];
    const add = (op: (model: typeof fake | typeof legacy) => void) => operations.push(op);
    for (let step = 0; step < 600; step++) {
      const id = pick(random, regionIds);
      const ids = [pick(random, regionIds), pick(random, regionIds)];
      const choice = random();
      if (choice < 0.2) add((model) => model.select(id));
      else if (choice < 0.25) add((model) => model.select(null));
      else if (choice < 0.32) {
        const hemisphere = pick(random, hemisphereChoices);
        add((model) => model.setHemisphere(hemisphere as 'both'));
      } else if (choice < 0.38) {
        const opacity = pick(random, [0, 0.4, 1, -0.1, 1.2, Number.NaN]);
        add((model) => model.setCortexOpacity(opacity));
      } else if (choice < 0.44) {
        const visible = pick(random, [true, false, 'no']);
        add((model) => model.setCortexVisible(visible as boolean));
      } else if (choice < 0.5) {
        const visible = pick(random, [true, false, 0]);
        add((model) => model.setInternalVisible(visible as boolean));
      } else if (choice < 0.55) add((model) => model.isolate());
      else if (choice < 0.59) add((model) => model.clearIsolation());
      else if (choice < 0.67) add((model) => model.hideRegions(ids));
      else if (choice < 0.73) add((model) => model.showRegions(ids));
      else if (choice < 0.77) add((model) => model.undoDissection());
      else if (choice < 0.8) add((model) => model.restoreHiddenRegions());
      else if (choice < 0.83) add((model) => model.loadHiddenRegions(ids));
      else if (choice < 0.87) {
        const level = pick(random, levelChoices);
        add((model) => model.setFunctionalLevel(level as 'named'));
      } else if (choice < 0.92) {
        const system = pick(random, systems);
        add((model) => model.setInternalSystem(system));
      } else if (choice < 0.97) {
        const paint = pick(random, [
          null,
          { id: 'function:a', colors: new Map([[id, [1, 2, 3]]]) },
          { id: 'b' },
        ]);
        add((model) => model.setPaint(paint as never));
      } else add((model) => model.reset());
    }
    let threw = 0;
    let selecting = 0;
    for (const [index, operation] of operations.entries()) {
      const failure = outcome(() => operation(legacy));
      assert.equal(
        outcome(() => operation(fake)),
        failure,
        `step ${index}: outcome`,
      );
      if (failure) threw++;
      if (legacy.state.selectedRegion) selecting++;
      const expected = plain({
        ...legacy.settings,
        selected: legacy.state.selectedRegion?.id ?? null,
      });
      const actual = plain({ ...fake.settings, selected: fake.state.selectedRegion?.id ?? null });
      assert.deepStrictEqual(actual, expected, `step ${index}: state`);
    }
    // The sequence must reach both the refusals and the selections it compares.
    assert.ok(
      threw > 50 && selecting > 20,
      `${threw} refusals, ${selecting} steps with a selection`,
    );
    legacy.dispose();
  });

  it('agrees with BrainAtlas on which regions can be selected under every hemisphere and cortex setting', () => {
    const legacy = legacyModel();
    const fake = fakeEngine().model;
    for (const hemisphere of ['both', 'left', 'right'] as const) {
      for (const cortex of [true, false]) {
        for (const internal of [true, false]) {
          for (const model of [legacy, fake]) {
            model.setHemisphere(hemisphere);
            model.setCortexVisible(cortex);
            model.setInternalVisible(internal);
          }
          for (const region of published.regions) {
            assert.equal(
              fake.canSelect(fake.regions.get(region.id)!),
              legacy.canSelect(legacy.regions.get(region.id)),
              `${region.id} under ${hemisphere}, cortex ${cortex}, internal ${internal}`,
            );
          }
        }
      }
    }
    legacy.dispose();
  });
});

/** Tissue sections that draw nothing: `BrainSections` only needs them to accept a plane. */
const tissues = () => ({
  group: new Group(),
  layers: new Map(),
  load: async () => {},
  update() {},
  setWindow() {},
  dispose() {},
});

describe('F2 parity: the fake sections against BrainSections', () => {
  it('agrees with BrainSections over a seeded sequence of plane operations', async () => {
    const random = seeded(7);
    const legacyModelled = legacyModel();
    const legacy = new BrainSections(
      legacyModelled,
      new URL('http://localhost/volumes.json'),
      tissues() as never,
    );
    const fake = fakeEngine();
    const fakeSections = fake.sections;
    const modes = ['off', 'sagittal', 'coronal', 'axial', 'oblique', 'diagonal'];
    const number = () =>
      pick(random, [0, 5, -40.5, 127.9, -128, 300, -1e6, Number.NaN, random() * 200 - 100]);
    const pairs: {
      sections: typeof legacy | typeof fakeSections;
      model: { settings: { cutActive: boolean } };
    }[] = [
      { sections: legacy, model: legacyModelled },
      { sections: fakeSections, model: fake.model },
    ];
    for (let step = 0; step < 400; step++) {
      const choice = random();
      let run: (sections: typeof legacy | typeof fakeSections) => unknown;
      if (choice < 0.25) {
        const mode = pick(random, modes);
        run = (sections) => sections.setMode(mode as 'off');
      } else if (choice < 0.45) {
        const point = [number(), number(), number()] as const;
        run = (sections) => sections.setCrosshair(point);
      } else if (choice < 0.65) {
        const offset = number();
        run = (sections) => sections.setOffset(offset);
      } else if (choice < 0.8) {
        const [tilt, azimuth] = [
          pick(random, [0, 30, 90, 120, -5, 45.5]),
          pick(random, [0, -180, 180, 200, 30, -77.5]),
        ];
        run = (sections) => sections.setAngles(tilt, azimuth);
      } else {
        const options = pick(random, [
          { reverse: true },
          { overlay: true },
          { reverse: false, overlay: false },
          { reverse: 1 },
        ]);
        run = (sections) => sections.setDisplay(options as never);
      }
      const [expected, actual] = await Promise.all(
        pairs.map(async ({ sections, model }) => {
          let failure: string | null = null;
          try {
            await run(sections);
          } catch (error) {
            failure = `${(error as Error).constructor.name}: ${(error as Error).message}`;
          }
          const frame = sections.frame;
          const toArray = (value: unknown) =>
            Array.isArray(value) ? value : (value as { toArray(): number[] }).toArray();
          return {
            failure,
            state: plain({ ...sections.state, status: undefined }),
            active: sections.active,
            cutActive: model.settings.cutActive,
            range: [...sections.offsetRange],
            frame: {
              center: toArray(frame.center),
              normal: toArray(frame.normal),
              u: toArray(frame.u),
              v: toArray(frame.v),
              edges: [...frame.edges],
            },
          };
        }),
      );
      assert.deepStrictEqual(actual, expected, `step ${step}`);
    }
    legacy.dispose();
  });
});
