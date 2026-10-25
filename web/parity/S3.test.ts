import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, it } from 'vitest';
import {
  prepareCircuitMri as legacyPrepare,
  showCircuitLandmark as legacyShow,
} from '../../viewer/learning/navigation.js';
import { createSession as legacySession } from '../../viewer/state/session.js';
import { createExplorerChoice } from '../src/lib/controller/modes.ts';
import {
  prepareCircuitMri,
  showCircuitLandmark,
} from '../src/lib/controller/navigation/learning.ts';
import { createSession } from '../src/lib/core/state/session.ts';
import type { Engine } from '../src/lib/engine/api.ts';
import { EXPLORERS } from '../src/lib/types/constants.ts';
import { repoRoot } from '../test/repo.ts';

/**
 * The tab and the lesson's landmark, against the legacy functions. The legacy `chooseExplorer` is
 * `app.js`'s own source, run over the same fakes as the new one (the legacy suite's technique): the
 * app cannot be constructed without WebGL.
 */

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

const appSource = readFileSync(`${repoRoot}viewer/app.js`, 'utf8');
const legacyChooseExplorerSource = appSource.match(
  / {2}function chooseExplorer\(value\) \{[\s\S]*?\n {2}\}/,
)![0];

/** One side's tracts overlay and cortex, recording what each is told. */
function tractsRig(anatomy: string, opacity: number) {
  const calls: unknown[][] = [];
  const model = { settings: { cortexOpacity: opacity } };
  const tracts = { anatomy: 'bert', defaultOpacity: 0.16 };
  return {
    calls,
    model,
    tracts,
    anatomy,
    setCortexOpacity(value: number) {
      model.settings.cortexOpacity = value;
      calls.push(['opacity', value]);
    },
    setOverlay(visible: boolean) {
      calls.push(['overlay', visible]);
    },
  };
}

describe('S3 parity', () => {
  it('chooseExplorer agrees with the legacy one over seeded tab and opacity sequences', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const random = seeded(seed);
      const anatomy = pick(random, ['bert', 'aomic']);
      const opacity = pick(random, [1, 0.64, 0]);

      const old = tractsRig(anatomy, opacity);
      const oldSession = legacySession({ views: [] });
      const oldModel = {
        state: old.model.settings,
        setCortexOpacity: old.setCortexOpacity,
      };
      const oldTracts = {
        anatomy: old.tracts.anatomy,
        defaultOpacity: old.tracts.defaultOpacity,
        enableOverlay: () => old.setOverlay(true),
        disableOverlay: () => old.setOverlay(false),
      };
      const legacy = runInNewContext(
        `let beforeTractsOpacity = null;
        ${legacyChooseExplorerSource}
        chooseExplorer;`,
        {
          session: oldSession,
          model: oldModel,
          nativeTracts: oldTracts,
          anatomy,
          render() {},
        },
      ) as (value: string) => void;

      const next = tractsRig(anatomy, opacity);
      const core = createSession({ views: [] });
      const { chooseExplorer } = createExplorerChoice({
        engine: {
          model: {
            settings: next.model.settings,
            setCortexOpacity: next.setCortexOpacity,
          },
          tracts: { ...next.tracts, setOverlay: next.setOverlay },
        } as unknown as Pick<Engine, 'model' | 'tracts'>,
        session: {
          get state() {
            return core.assemble({});
          },
          setExplorer: core.setExplorer,
        },
        anatomy: () => anatomy,
        render() {},
      });

      for (let step = 0; step < 60; step++) {
        if (random() < 0.3) {
          const value = pick(random, [0, 0.22, 0.4, 1]);
          old.setCortexOpacity(value);
          next.setCortexOpacity(value);
        } else {
          const tab = pick(random, EXPLORERS);
          legacy(tab);
          chooseExplorer(tab);
        }
        assert.deepEqual(next.calls, old.calls, `seed ${seed} step ${step}`);
        assert.equal(core.assemble({}).explorer, oldSession.assemble({}).explorer);
      }
    }
  });

  it('showCircuitLandmark and prepareCircuitMri agree with the legacy ones', async () => {
    const random = seeded(7);
    const regions = new Map(
      ['left', 'right', 'midline'].map((hemisphere) => [`r:${hemisphere}`, { hemisphere }]),
    );
    for (let case_ = 0; case_ < 40; case_++) {
      const step = {
        region: pick(random, [...regions.keys()]),
        restores: pick(random, [[], ['a'], ['a', 'b']]),
        covering_regions: pick(random, [undefined, ['c'], ['c', 'd']]),
        plane: pick(random, ['axial', 'coronal', 'sagittal'] as const),
      };
      const record = () => {
        const calls: unknown[][] = [];
        return {
          calls,
          model: {
            regions,
            showRegions: (ids: unknown) => calls.push(['show', ids]),
            hideRegions: (ids: unknown) => calls.push(['hide', ids]),
            setHemisphere: (side: unknown) => calls.push(['hemisphere', side]),
          },
        };
      };
      const old = record();
      const next = record();
      legacyShow(old.model, step);
      showCircuitLandmark(next.model as never, step as never);
      assert.deepEqual(next.calls, old.calls);

      const centroid = pick(random, [[1, 2, 3], [0, 0, 0], null, [1, Number.NaN, 3], [1, 2]]);
      const mri = () => {
        const calls: unknown[][] = [];
        return {
          calls,
          model: { centroidOf: () => centroid },
          sections: {
            setCrosshair: (point: unknown) => calls.push(['crosshair', point]),
            setDisplay: (display: unknown) => calls.push(['display', display]),
            setMode: async (mode: unknown) => void calls.push(['mode', mode]),
          },
        };
      };
      const oldMri = mri();
      const nextMri = mri();
      const outcome = async (run: () => Promise<void>) =>
        run().then(
          () => 'resolved',
          (error: Error) => error.message,
        );
      assert.equal(
        await outcome(() =>
          prepareCircuitMri(nextMri.model as never, nextMri.sections as never, step),
        ),
        await outcome(() => legacyPrepare(oldMri.model, oldMri.sections, step)),
      );
      assert.deepEqual(nextMri.calls, oldMri.calls);
    }
  });
});
