/**
 * C5 parity: the panel view-models and async runners against the legacy `viewer/ui/panels/**`
 * and `viewer/ui/chrome/header.js` over fixtures and a seeded PRNG. Outputs are compared with
 * `deepStrictEqual`, never by shape. The legacy runners live inside DOM modules and cannot be
 * imported, so their transcribed bodies drive the same schedules as the new ones.
 */
import assert from 'node:assert/strict';
import { describe, test, vi } from 'vitest';
import { readRepoJson, readRepoYaml } from '../test/repo.ts';
import {
  atlasOption as legacyAtlasOption,
  colophonParts as legacyColophonParts,
  colourGroups as legacyColourGroups,
  colourOption as legacyColourOption,
  dataSummary as legacyDataSummary,
  loadingText as legacyLoadingText,
  subjectName as legacySubjectName,
} from '../../viewer/ui/chrome/header.js';
import { t as legacyT } from '../../viewer/i18n/translations.js';
import { CLINICAL_TEXT as LEGACY_CLINICAL_TEXT } from '../../viewer/clinical/translations.js';
import { cutAtlasesOf } from '../../viewer/catalog/visibility.js';
import * as legacyCircuits from '../../viewer/ui/panels/circuits.js';
import * as legacyClinical from '../../viewer/ui/panels/clinical.js';
import * as legacyInspector from '../../viewer/ui/panels/inspector.js';
import * as legacyNavigator from '../../viewer/ui/panels/navigator.js';
import * as legacyProvenance from '../../viewer/ui/panels/provenance.js';
import { createInvolvement as legacyInvolvement } from '../../viewer/ui/panels/related.js';
import { visibilityStateOf as legacyVisibilityStateOf } from '../../viewer/ui/panels/visibility-control.js';
import { createBusyRunner, createLatestRunner } from '../src/lib/core/async/latest.ts';
import type { NeuropsychDomains } from '../src/lib/core/catalog/neuropsych-domains.ts';
import { TRANSLATIONS } from '../src/lib/core/i18n/index.ts';
import * as circuits from '../src/lib/core/panels/circuits.ts';
import * as clinical from '../src/lib/core/panels/clinical.ts';
import {
  atlasOption,
  colophonParts,
  colourGroups,
  colourOption,
  dataSummary,
  loadingText,
  subjectName,
} from '../src/lib/core/panels/header.ts';
import * as inspector from '../src/lib/core/panels/inspector.ts';
import * as navigator from '../src/lib/core/panels/navigator.ts';
import * as provenance from '../src/lib/core/panels/provenance.ts';
import { createInvolvement } from '../src/lib/core/panels/related.ts';
import type { ClinicalData } from '../src/lib/core/clinical/types.ts';
import type { Manifest, Region, SurfaceColor } from '../src/lib/types/index.ts';

/** mulberry32: a seeded PRNG, so every run draws the same corpus. */
function prng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const LANGS = ['en', 'fr'] as const;

type Random = () => number;
const pick = <T>(random: Random, items: readonly T[]): T =>
  items[Math.floor(random() * items.length)];
const int = (random: Random, below: number) => Math.floor(random() * below);

/** Runs `check` once per seed, naming the seed in a failure. */
function drawn(name: string, check: (random: Random, seed: number) => void) {
  describe(name, () => {
    for (const seed of SEEDS) test(`seed ${seed}`, () => check(prng(seed), seed));
  });
}

const manifest = readRepoJson<Manifest>('public/models/cdmd/manifest.json');
const domains = readRepoJson<NeuropsychDomains>('public/models/cdmd/neuropsych-domains.json');
const clinicalData = readRepoYaml<ClinicalData>('data/neuropsychology.yaml');

const KINDS = ['cortex', 'structure', 'tissue-region', 'non-region'] as const;
const ATLASES = ['destrieux', 'hcp-mmp', 'learning', 'aseg', 'nextbrain', 'wmparc', 'zanatomy'];
const GROUP_NAMES = [
  'Limbic',
  'Frontal',
  'Limbique',
  'Cervelet',
  'Insula',
  'Tronc cérébral',
  'Äpfel',
  'Zebra',
  'ébène',
  'Default',
];
const REASONS = [
  'no-mri',
  'below-cut-resolution',
  'other-cut-atlas',
  'no-cut',
  'other-detail',
  'other-atlas',
  'other-system',
  'hemisphere',
  'cortex-hidden',
  'internal-hidden',
  'spinal-cord-hidden',
  'removed',
  'isolated',
];

const randomRegion = (random: Random, index: number) => ({
  id: `r${index}`,
  kind: pick(random, KINDS),
  atlas: pick(random, ATLASES),
});

function randomGroups(random: Random) {
  const families = ['cortex', 'structure', 'tissue'];
  return Array.from({ length: 1 + int(random, 8) }, (_, index) => ({
    name: pick(random, GROUP_NAMES),
    key: `g${index}`,
    kind: pick(random, families),
    rows: Array.from({ length: 1 + int(random, 3) }, (_, row) => ({
      region: randomRegion(random, index * 10 + row),
    })),
  }));
}

describe('navigator view-model', () => {
  drawn('nextEnabledIndex', (random) => {
    for (let draw = 0; draw < 200; draw += 1) {
      const disabled = Array.from({ length: int(random, 8) }, () => random() < 0.5);
      const index = int(random, disabled.length + 2) - 1;
      const delta = pick(random, [-1, 1, 0]);
      assert.equal(
        navigator.nextEnabledIndex(disabled, index, delta),
        legacyNavigator.nextEnabledIndex(disabled, index, delta),
        `${disabled} ${index} ${delta}`,
      );
    }
  });

  drawn('vocabularies, shared names, labelled groups and region groups', (random) => {
    for (let draw = 0; draw < 40; draw += 1) {
      const groups = randomGroups(random);
      assert.deepEqual(
        navigator.sharedGroupNames(groups),
        legacyNavigator.sharedGroupNames(groups),
      );
      for (const group of groups) {
        const region = group.rows[0].region;
        assert.equal(
          navigator.vocabularyOf(region as Region),
          legacyNavigator.vocabularyOf(region),
        );
      }
      for (const lang of LANGS) {
        assert.deepEqual(
          navigator.labelledGroups(groups, lang),
          legacyNavigator.labelledGroups(groups, lang),
        );
        const id = pick(random, [
          ...groups.flatMap((group) => group.rows.map((row) => row.region.id)),
          'absent',
        ]);
        assert.deepEqual(
          navigator.regionGroup(groups, id, lang),
          legacyNavigator.regionGroup(groups, id, lang),
        );
        const shared = navigator.sharedGroupNames(groups);
        for (const group of groups) {
          assert.equal(
            navigator.groupDisplayName(group.name, group.rows[0].region as Region, shared, lang),
            legacyNavigator.groupDisplayName(group.name, group.rows[0].region, shared, lang),
          );
        }
      }
    }
  });

  drawn('matchesElsewhere, including the atlas that no one draws', (random) => {
    const atlases = ['destrieux', 'hcp-mmp', 'nextbrain', 'aseg'].map((id) => ({ id }));
    for (let draw = 0; draw < 60; draw += 1) {
      const rows = Array.from({ length: int(random, 6) }, (_, index) => ({
        region: {
          ...randomRegion(random, index),
          cut_atlases:
            random() < 0.5 ? [pick(random, atlases).id, pick(random, atlases).id] : undefined,
        } as Region,
      }));
      const current = pick(random, atlases).id;
      const run = (matches: typeof navigator.matchesElsewhere) => {
        try {
          return matches(rows, atlases, current, cutAtlasesOf as never);
        } catch (error) {
          return (error as Error).message;
        }
      };
      assert.deepEqual(run(navigator.matchesElsewhere), run(legacyNavigator.matchesElsewhere));
    }
  });

  drawn('section captions, row reasons and eye states', (random) => {
    for (let draw = 0; draw < 60; draw += 1) {
      const groups = Array.from({ length: 1 + int(random, 4) }, () => ({
        kind: pick(random, ['cortex', 'structure', 'tissue']),
        rows: Array.from({ length: int(random, 6) }, () => {
          const visible = random() < 0.3;
          return { visible, reason: visible ? null : pick(random, REASONS) };
        }),
      }));
      assert.deepEqual(navigator.sectionReasons(groups), legacyNavigator.sectionReasons(groups));
      for (const row of groups.flatMap((group) => group.rows)) {
        assert.equal(navigator.rowStatesReason(row), legacyNavigator.rowStatesReason(row));
      }
      const ids = Array.from({ length: int(random, 5) }, (_, index) => `id${index}`);
      const hidden = new Set(ids.filter(() => random() < 0.5));
      assert.equal(navigator.visibilityStateOf(ids, hidden), legacyVisibilityStateOf(ids, hidden));
    }
  });

  /**
   * navigator.js:155-179 (`highlightMatch`) and :287-306, which are not exported, as plain data.
   * It agrees with `matchSegments` on NFC input only: its offsets break on NFD (see
   * docs/decisions/deviations/c5-match-highlight-offsets.md).
   */
  function legacyMatch(name: string, code: string | null, aliases: string[], query: string) {
    const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const segments = (text: string) => {
      if (!query) return [{ text, match: false }];
      const index = fold(text).indexOf(fold(query));
      if (index === -1) return [{ text, match: false }];
      const parts = [
        { text: text.slice(0, index), match: false },
        { text: text.slice(index, index + query.length), match: true },
        { text: text.slice(index + query.length), match: false },
      ];
      return parts.filter((part) => part.text);
    };
    let alias: string | null = null;
    if (query && !fold(name).includes(fold(query))) {
      if (code && fold(code).includes(fold(query))) alias = code;
      if (!alias) alias = aliases.find((entry) => fold(entry).includes(fold(query))) ?? null;
    }
    return { name: segments(name), alias, aliasSegments: alias ? segments(alias) : null };
  }

  drawn('match segments and the alias that explains a match', (random) => {
    const words = [
      'Gyrus',
      'cingulaire',
      'Écorce',
      'visuelle',
      'Insula',
      'V1',
      'area',
      '17',
      'Île',
      'de',
      'Reil',
      'striate',
      'cortex',
    ];
    const phrase = () =>
      Array.from({ length: 1 + int(random, 3) }, () => pick(random, words)).join(' ');
    for (let draw = 0; draw < 200; draw += 1) {
      const name = phrase();
      const code = random() < 0.5 ? pick(random, ['V1', 'a24', 'FEF', 'É5']) : null;
      const aliases = Array.from({ length: int(random, 3) }, phrase);
      const query =
        random() < 0.1
          ? ''
          : pick(random, ['gyr', 'ECO', 'ile', 'v1', 'area', 'zz', 'cortex', 'e', 'reil', '17']);
      const expected = legacyMatch(name, code, aliases, query);
      assert.deepEqual(navigator.matchSegments(name, query), expected.name);
      const alias = navigator.matchedAlias({ name, code, aliases }, query);
      assert.equal(alias, expected.alias);
      if (alias) assert.deepEqual(navigator.matchSegments(alias, query), expected.aliasSegments);
    }
  });
});

describe('clinical view-model', () => {
  const settingsDraw = (random: Random) => ({
    cut: random() < 0.5,
    isolated: random() < 0.5,
    atlas: pick(random, ['destrieux', 'hcp-mmp']),
    cutAtlas: pick(random, ['destrieux', 'hcp-mmp', 'nextbrain']),
    colour: pick(random, [
      'tissue',
      'mri',
      'atlas',
      'network',
      'cab-np',
      'functional',
    ] as SurfaceColor[]),
    detail: pick(random, ['learning', 'aseg', 'nextbrain']),
    hemisphere: pick(random, ['both', 'left', 'right'] as const),
    cortex: random() < 0.5,
  });

  drawn('revealNotice', (random) => {
    for (let draw = 0; draw < 200; draw += 1) {
      const before = settingsDraw(random);
      const after = random() < 0.3 ? { ...before } : settingsDraw(random);
      for (const lang of LANGS) {
        assert.equal(
          clinical.revealNotice(lang, before, after),
          legacyClinical.revealNotice(lang, before, after),
        );
      }
    }
  });

  drawn('sides', (random) => {
    const sides = ['left', 'right', 'bilateral', 'midline'];
    for (let draw = 0; draw < 200; draw += 1) {
      const list = Array.from({ length: int(random, 5) }, () =>
        pick(random, sides.slice(0, 1 + int(random, 4))),
      );
      assert.equal(clinical.sharedSide(list), legacyClinical.sharedSide(list));
      const laterality = pick(random, sides);
      assert.equal(
        clinical.sideStated(laterality, list),
        legacyClinical.sideStated(laterality, list),
      );
      const region = random() < 0.5 ? { id: 'x' } : null;
      const deficits = int(random, 3);
      assert.equal(
        clinical.relatedRegionVisible(region, deficits),
        legacyClinical.relatedRegionVisible(region, deficits),
      );
    }
  });

  test('stageMessage over every state and operation, in both languages', () => {
    const offline = Object.assign(new Error('Asset request failed'), { code: 'asset-fetch' });
    const updated = Object.assign(new Error('Asset changed'), { code: 'asset-updated' });
    for (const lang of LANGS) {
      for (const opening of [false, true]) {
        for (const busy of ['loading', 'restoring'] as const) {
          for (const error of [null, new Error('x'), offline, updated]) {
            for (const failure of [null, 'restoreFailed'] as const) {
              for (const operation of ['deficit', 'region']) {
                const state = {
                  opening,
                  busy,
                  error,
                  failure,
                  operation,
                  lang,
                  status: 'shown',
                } as const;
                assert.equal(
                  clinical.stageMessage(TRANSLATIONS[lang].clinical, state),
                  legacyClinical.stageMessage(LEGACY_CLINICAL_TEXT[lang], state),
                );
              }
            }
          }
        }
      }
    }
  });

  test('stageMessage with the Functions tab text, whose failure defaults to `failed`', () => {
    const error = new Error('x');
    for (const lang of LANGS) {
      const copy = TRANSLATIONS[lang].functions;
      const legacyCopy = legacyT(lang, 'functions');
      for (const opening of [false, true]) {
        for (const busy of ['loading', 'restoring'] as const) {
          for (const failure of ['failed', 'restoreFailed'] as const) {
            const state = {
              opening,
              busy,
              error,
              failure,
              operation: 'colour',
              lang,
              status: 's',
            } as const;
            assert.equal(
              clinical.stageMessage(
                { ...TRANSLATIONS[lang].clinical, loading: copy.loading, failed: copy.failed },
                state,
              ),
              legacyClinical.stageMessage(
                {
                  ...LEGACY_CLINICAL_TEXT[lang],
                  loading: legacyCopy.loading,
                  failed: legacyCopy.failed,
                },
                state,
              ),
            );
          }
        }
      }
    }
  });

  test('publishedCorrections over every published reference', () => {
    for (const lang of LANGS) {
      for (const reference of [...clinicalData.references, {}]) {
        assert.deepEqual(
          clinical.publishedCorrections(reference, lang),
          legacyClinical.publishedCorrections(reference, lang),
        );
      }
    }
  });
});

describe('provenance view-model', () => {
  test('shortUrl', () => {
    for (const url of [
      'https://doi.org/10.1/x',
      'http://a.b/',
      'https://www.z-anatomy.com/',
      'ftp://x/',
      '',
      12,
    ]) {
      assert.equal(provenance.shortUrl(url), legacyProvenance.shortUrl(url));
    }
  });

  drawn('provenanceRows over the published manifest with fields removed', (random) => {
    const optional = [
      'anatomy',
      'networks',
      'cab_np',
      'functional_regions',
      'neuropsych_domains',
      'supplemental_layers',
      'provenance',
    ] as const;
    for (let draw = 0; draw < 12; draw += 1) {
      const variant: Record<string, unknown> = { ...manifest };
      for (const field of optional) if (random() < 0.3) delete variant[field];
      if (random() < 0.3) variant.anatomy = { display_name: 'X “1”' };
      for (const lang of LANGS) {
        for (const options of [
          { lang },
          { lang, manifestUrl: '/neuroatlas/models/cdmd/manifest.json' },
          {
            lang,
            manifestUrl: '/neuroatlas/models/cdmd/manifest.json',
            indexUrl: '/neuroatlas/models/anatomies.json',
            domains,
          },
        ]) {
          const run = (rows: (manifest: never, options: never) => unknown) => {
            try {
              return rows(variant as never, options as never);
            } catch (error) {
              return (error as Error).message;
            }
          };
          assert.deepEqual(run(provenance.provenanceRows), run(legacyProvenance.provenanceRows));
        }
      }
    }
  });

  test('provenanceRows without options, and the default language', () => {
    assert.deepEqual(
      provenance.provenanceRows(manifest),
      legacyProvenance.provenanceRows(manifest),
    );
    assert.deepEqual(provenance.provenanceRows({}), legacyProvenance.provenanceRows({}));
  });

  test('checkedParcels over every published lesion check', () => {
    for (const lang of LANGS) {
      for (const checks of Object.values(domains.lesion_checks) as Parameters<
        typeof provenance.checkedParcels
      >[0][][]) {
        for (const check of checks) {
          assert.equal(
            provenance.checkedParcels(check, lang),
            legacyProvenance.checkedParcels(check, lang),
          );
        }
      }
    }
  });

  test('referenceRows', () => {
    const reference = {
      label: 'SNAIL reference',
      links: [{ href: 'https://example.org/a', text: 'A' }],
    };
    for (const lang of LANGS) {
      for (const entry of [reference, { ...reference, links: [] }]) {
        assert.deepEqual(
          provenance.referenceRows(entry, lang),
          legacyProvenance.referenceRows(entry, lang),
        );
      }
    }
    assert.deepEqual(
      provenance.referenceRows(reference),
      legacyProvenance.referenceRows(reference),
    );
  });
});

describe('inspector, circuits and related view-models', () => {
  drawn('inspectorEmptyChrome', (random) => {
    for (const explorer of ['anatomy', 'functions', 'deficits', 'circuits', 'diffusion'] as const) {
      for (const selectedRegion of [null, { id: 'a' } as Region]) {
        assert.deepEqual(
          inspector.inspectorEmptyChrome({ selectedRegion, explorer }),
          legacyInspector.inspectorEmptyChrome({ selectedRegion, explorer }),
        );
      }
    }
    void random;
  });

  drawn('sourceLabel', (random) => {
    for (let draw = 0; draw < 200; draw += 1) {
      const atlas = pick(random, ATLASES);
      const shape = int(random, 4);
      const region = {
        atlas,
        ...(random() < 0.5 ? { source_atlas: pick(random, ATLASES) } : {}),
        ...(shape === 0 ? { source_label_id: int(random, 5000) } : {}),
        ...(shape === 1
          ? {
              source_label_ids: Array.from({ length: 1 + int(random, 12) }, () =>
                int(random, 20000),
              ),
            }
          : {}),
        ...(shape === 2 ? { source_label_id: null } : {}),
      };
      for (const lang of LANGS) {
        assert.deepEqual(
          inspector.sourceLabel(region, lang),
          legacyInspector.sourceLabel(region, lang),
        );
      }
    }
  });

  drawn('stepProgress and stepperTargets', (random) => {
    for (let draw = 0; draw < 200; draw += 1) {
      const total = 1 + int(random, 8);
      const lesson = {
        step: int(random, total),
        visited: Array.from({ length: int(random, total) }, () => int(random, total)),
      };
      for (let index = 0; index < total; index += 1) {
        assert.equal(
          circuits.stepProgress(index, lesson),
          legacyCircuits.stepProgress(index, lesson),
        );
      }
      assert.deepEqual(
        circuits.stepperTargets(lesson.step, total),
        legacyCircuits.stepperTargets(lesson.step, total),
      );
    }
  });

  test('createInvolvement over every published region, and an unknown one', () => {
    const regions = new Map(manifest.regions.map((region) => [region.id, region]));
    const involved = createInvolvement(regions);
    const legacy = legacyInvolvement(regions);
    for (const id of regions.keys()) assert.deepEqual(involved(id), legacy(id), id);
    assert.throws(() => involved('missing'), { message: 'Unknown region: missing' });
    assert.throws(() => legacy('missing'), { message: 'Unknown region: missing' });
  });
});

describe('masthead view-model', () => {
  drawn('subjectName, dataSummary, colourGroups, colophonParts', (random) => {
    for (let draw = 0; draw < 100; draw += 1) {
      const entry = {
        ...(random() < 0.7
          ? {
              display_name: pick(random, [
                'SNAIL “subj_1”',
                ' A  "b" ',
                '””',
                'AOMIC-PIOP1 “sub-0022”',
              ]),
            }
          : {}),
        ...(random() < 0.5 ? { subject: 'subject' } : {}),
        ...(random() < 0.5 ? { id: 'id' } : {}),
      };
      assert.equal(subjectName(entry), legacySubjectName(entry));
      const summary = {
        subject: pick(random, ['bert', null, undefined, '']),
        atlas: pick(random, ['Destrieux', null, undefined]),
        colour: pick(random, ['Regions', null, undefined]),
        detail: pick(random, ['Teaching set', null, undefined]),
        reference: pick(random, ['SNAIL', null, undefined, '']),
      };
      assert.deepEqual(dataSummary(summary), legacyDataSummary(summary));
      const published = {
        networks: pick(random, [{}, null, undefined]),
        cabNp: pick(random, [{}, null, undefined]),
        functionalRegions: pick(random, [{}, null, undefined]),
      };
      assert.deepEqual(colourGroups(published), legacyColourGroups(published));
      for (const lang of LANGS) {
        const loaded = pick(random, [
          {},
          { anatomy: { display_name: 'SNAIL “subj_1”', individual: random() < 0.5 } },
          { reference: { label: 'Ref' } },
          { anatomy: { id: 'x', individual: true }, reference: { label: 'Ref' } },
        ]);
        assert.deepEqual(colophonParts(lang, loaded as never), legacyColophonParts(lang, loaded));
      }
    }
    assert.deepEqual(colophonParts('en'), legacyColophonParts('en'));
  });

  test('colour and atlas options, and loading text', () => {
    const modes = ['tissue', 'mri', 'atlas', 'network', 'cab-np', 'functional'] as const;
    const atlases = ['destrieux', 'hcp-mmp', 'learning', 'unknown'];
    for (const lang of LANGS) {
      for (const mode of modes) {
        for (const atlas of atlases) {
          for (const required of [null, undefined, ...atlases]) {
            assert.equal(
              colourOption(lang, mode, { atlas, required }),
              legacyColourOption(lang, mode, { atlas, required }),
            );
          }
        }
      }
      for (const id of atlases) {
        for (const required of [null, undefined, ...atlases]) {
          assert.equal(atlasOption(lang, id, required), legacyAtlasOption(lang, id, required));
        }
      }
      for (const progress of [
        undefined,
        null,
        { loaded: 0, total: 0 },
        { loaded: 1, total: 3 },
        { loaded: 5, total: 5 },
      ]) {
        assert.equal(loadingText(lang, progress), legacyLoadingText(lang, progress));
      }
    }
  });
});

/**
 * The legacy runners, transcribed with their panel state as a log: functions.js:124-146 (the
 * clinical tab's, clinical.js:288, is the same), atlas-comparison.js:65-87, circuits.js:260-278.
 */
function legacyLatest(log: string[]) {
  let latest = 0;
  return async (action: () => Promise<unknown> | unknown, name: string) => {
    const mine = ++latest;
    log.push(`${name} start`);
    try {
      return (await action()) !== false;
    } catch (error) {
      if (mine === latest) log.push(`${name} error ${(error as Error).message}`);
      return false;
    } finally {
      if (mine === latest) log.push(`${name} settled`);
    }
  };
}

function legacyBusy(log: string[]) {
  let opening = false;
  return async (action: () => Promise<unknown> | unknown, name: string) => {
    if (opening) {
      log.push(`${name} refused`);
      return false;
    }
    opening = true;
    log.push(`${name} start`);
    try {
      await action();
      return true;
    } catch (error) {
      log.push(`${name} error ${(error as Error).message}`);
      return false;
    } finally {
      opening = false;
      log.push(`${name} settled`);
    }
  };
}

function legacyComparison(log: string[]) {
  let request = 0;
  const clear = () => {
    request += 1;
  };
  return {
    clear,
    async activate(action: () => Promise<unknown>, name: string) {
      clear();
      const current = request;
      log.push(`${name} start`);
      try {
        const applied = await action();
        if (current === request && applied) log.push(`${name} applied`);
      } catch (error) {
        if (current === request) log.push(`${name} error ${(error as Error).message}`);
      } finally {
        if (current === request) log.push(`${name} settled`);
      }
    },
  };
}

/** A schedule: runs start in order, and settle in a drawn order, each succeeding, failing or reporting false. */
function schedule(random: Random) {
  const count = 2 + int(random, 4);
  const order = Array.from({ length: count }, (_, index) => index).sort(() => random() - 0.5);
  const outcomes = Array.from({ length: count }, () =>
    pick(random, ['value', 'false', 'error'] as const),
  );
  return { count, order, outcomes };
}

function settle(outcome: 'value' | 'false' | 'error', index: number) {
  return outcome === 'error'
    ? Promise.reject(new Error(`e${index}`))
    : Promise.resolve(outcome === 'false' ? false : `v${index}`);
}

describe('async runners', () => {
  drawn(
    'latest-wins: the same events, in the same order, as the Functions and Deficits tabs',
    async (random) => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      for (let draw = 0; draw < 30; draw += 1) {
        const { count, order, outcomes } = schedule(random);
        const run = async (
          make: (
            log: string[],
          ) => (action: () => Promise<unknown>, name: string) => Promise<boolean>,
        ) => {
          const events: string[] = [];
          const start = make(events);
          const gates = Array.from({ length: count }, () => gate());
          const runs = gates.map((gate, index) =>
            start(async () => {
              await gate.promise;
              return settle(outcomes[index], index);
            }, `run${index}`),
          );
          const results: boolean[] = [];
          for (const index of order) {
            gates[index].resolve();
            results[index] = await runs[index];
          }
          return { events, results };
        };
        const fresh = (events: string[]) => {
          const runner = createLatestRunner();
          return async (action: () => Promise<unknown>, name: string) => {
            events.push(`${name} start`);
            const outcome = await runner.run(action, {
              onError: (error) => events.push(`${name} error ${(error as Error).message}`),
              onSettled: () => events.push(`${name} settled`),
            });
            return outcome.ok && outcome.value !== false;
          };
        };
        assert.deepEqual(await run(fresh), await run(legacyLatest));
      }
      log.mockRestore();
    },
  );

  drawn(
    'cancel and latest-wins: the comparison panel highlights what the legacy panel did',
    async (random) => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      for (let draw = 0; draw < 30; draw += 1) {
        const { count, order, outcomes } = schedule(random);
        const clearAt = int(random, count + 1);
        const run = async (
          make: (events: string[]) => {
            clear: () => void;
            activate: (action: () => Promise<unknown>, name: string) => Promise<unknown>;
          },
        ) => {
          const events: string[] = [];
          const panel = make(events);
          const gates = Array.from({ length: count }, () => gate());
          const runs: Promise<unknown>[] = [];
          gates.forEach((gate, index) => {
            runs.push(
              panel.activate(async () => {
                await gate.promise;
                return settle(outcomes[index], index);
              }, `run${index}`),
            );
            // After the run starts, so the cancel overtakes it rather than preceding it.
            if (index === clearAt) panel.clear();
          });
          if (clearAt === count) panel.clear();
          for (const index of order) {
            gates[index].resolve();
            await runs[index];
          }
          return events;
        };
        const fresh = (events: string[]) => {
          const runner = createLatestRunner();
          return {
            clear: () => runner.cancel(),
            async activate(action: () => Promise<unknown>, name: string) {
              // The comparison clears first, which overtakes the run before it, then starts its own.
              runner.cancel();
              events.push(`${name} start`);
              await runner.run(action, {
                onResult: (applied) => applied && events.push(`${name} applied`),
                onError: (error) => events.push(`${name} error ${(error as Error).message}`),
                onSettled: () => events.push(`${name} settled`),
              });
            },
          };
        };
        assert.deepEqual(await run(fresh), await run(legacyComparison));
      }
      log.mockRestore();
    },
  );

  drawn(
    'refuse-while-busy: the same events, in the same order, as the Circuits tab',
    async (random) => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      for (let draw = 0; draw < 30; draw += 1) {
        const { count, order, outcomes } = schedule(random);
        const run = async (
          make: (
            events: string[],
          ) => (action: () => Promise<unknown>, name: string) => Promise<boolean>,
        ) => {
          const events: string[] = [];
          const start = make(events);
          const gates = Array.from({ length: count }, () => gate());
          // The first run holds the panel; the others ask while it does, or after it settles.
          const results: boolean[] = [];
          const between: boolean[] = [];
          const pending: Promise<boolean>[] = [];
          for (let index = 0; index < count; index += 1) {
            pending.push(
              start(async () => {
                await gates[index].promise;
                return settle(outcomes[index] === 'false' ? 'value' : outcomes[index], index);
              }, `run${index}`),
            );
          }
          for (const index of order) {
            gates[index].resolve();
            results[index] = await pending[index];
            between.push(await start(() => Promise.resolve('between'), `between${index}`));
          }
          const after = await start(() => Promise.resolve('later'), 'after');
          return { events, results, between, after };
        };
        const fresh = (events: string[]) => {
          const runner = createBusyRunner();
          return async (action: () => Promise<unknown>, name: string) => {
            if (runner.busy) events.push(`${name} refused`);
            return runner.run(action, {
              onStart: () => events.push(`${name} start`),
              onError: (error) => events.push(`${name} error ${(error as Error).message}`),
              onSettled: () => events.push(`${name} settled`),
            });
          };
        };
        assert.deepEqual(await run(fresh), await run(legacyBusy));
      }
      log.mockRestore();
    },
  );
});

/** A promise the test settles by hand, so completion order is the test's to choose. */
function gate() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
