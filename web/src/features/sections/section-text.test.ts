// The section bar's words against legacy ui/chrome/sections.js:19-20, 409-527.
import { describe, expect, test } from 'vitest';
import type { Paint } from '../../lib/types/index.ts';
import { axisEnds, degrees, rangeMessage, sectionSentences } from './section-text.ts';
import type { SentenceInput } from './section-text.ts';

const input = (extra: Partial<SentenceInput> = {}): SentenceInput => ({
  lang: 'en',
  state: { status: 'ready', error: null, cutAtlas: 'destrieux' },
  active: true,
  offset: -12.5,
  spacing: 1,
  surfaceColor: 'atlas',
  paint: null,
  nextbrainSegmented: true,
  colourAtlases: { cabNp: 'hcp-mmp', functional: 'hcp-mmp', domains: 'hcp-mmp' },
  failure: null,
  ...extra,
});

describe('the letters at the slider ends', () => {
  test('name each plane negative end first, and the French letters for right and left', () => {
    expect(axisEnds('sagittal', 'en')).toEqual(['L', 'R']);
    expect(axisEnds('sagittal', 'fr')).toEqual(['G', 'D']);
    expect(axisEnds('coronal', 'en')).toEqual(['P', 'A']);
    expect(axisEnds('axial', 'fr')).toEqual(['I', 'S']);
  });

  test('an oblique plane has only a sign at each end', () => {
    expect(axisEnds('oblique', 'en')).toEqual(['−', '+']);
  });
});

test('the out-of-range message states the range in the reader’s notation', () => {
  expect(rangeMessage([-128, 128], 'en')).toBe('Enter a position from −128 to 128\u202fmm.');
  expect(rangeMessage([-73.25, 96.5], 'fr')).toBe(
    'Saisissez une position de −73,3 à 96,5\u202fmm.',
  );
});

test('angles are whole degrees, the azimuth signed', () => {
  expect(degrees(30, 'en')).toBe('30°');
  expect(degrees(30, 'en', true)).toBe('+30°');
  expect(degrees(-45, 'fr', true)).toBe('−45°');
});

describe('the status sentence', () => {
  test('says the position, grid and labels; the shown line leaves the position to the slider', () => {
    expect(sectionSentences(input())).toEqual({
      said: 'Tissue cut at −12.5\u202fmm · 1\u202fmm source grid · native Destrieux labels',
      shown: '1\u202fmm source grid · native Destrieux labels',
    });
  });

  test('is French in French, with the decimal comma', () => {
    const { said } = sectionSentences(input({ lang: 'fr', offset: 3.25, spacing: 0.8 }));
    expect(said).toBe(
      'Coupe tissulaire à +3,3\u202fmm · grille source de 0,8\u202fmm · étiquettes Destrieux natives',
    );
  });

  test('over the MRI colouring it is an MRI cut on its 1 mm grid', () => {
    expect(sectionSentences(input({ surfaceColor: 'mri' }))).toEqual({
      said: 'MRI cut at −12.5\u202fmm · 1\u202fmm source grid · native Destrieux labels',
      shown: 'MRI · 1\u202fmm source grid · native Destrieux labels',
    });
  });

  test('names NextBrain by how it reached this brain', () => {
    const state = { status: 'ready', error: null, cutAtlas: 'nextbrain' } as const;
    expect(sectionSentences(input({ state })).shown).toMatch(
      /NextBrain labels segmented on this brain$/,
    );
    expect(sectionSentences(input({ state, nextbrainSegmented: false })).shown).toMatch(
      /warped NextBrain labels$/,
    );
  });

  test('ends with what the colours mean on these labels', () => {
    const note = (extra: Partial<SentenceInput>) =>
      sectionSentences(input(extra)).shown.split(' · ')[2];
    expect(note({ surfaceColor: 'network' })).toBe('networks by each region’s dominant share');
    expect(note({ surfaceColor: 'cab-np' })).toBe('CAB-NP colours HCP-MMP labels only');
    const hcp = { status: 'ready', error: null, cutAtlas: 'hcp-mmp' } as const;
    expect(note({ surfaceColor: 'cab-np', state: hcp })).toBe(
      'CAB-NP network of each HCP-MMP area',
    );
    expect(note({ surfaceColor: 'functional', state: hcp })).toBe(
      'functional division of each HCP-MMP area',
    );
    expect(note({ surfaceColor: 'functional' })).toBe(
      'functional divisions colour HCP-MMP labels only',
    );
    expect(note({ surfaceColor: 'atlas' })).toBeUndefined();
  });

  test('under a function’s paint the note is about the functions, never the surface colour', () => {
    const paint = { id: 'function:memory', colors: new Map() } as Paint;
    const shown = sectionSentences(input({ surfaceColor: 'network', paint })).shown;
    expect(shown).toBe(
      '1\u202fmm source grid · native Destrieux labels · neuropsychological functions colour HCP-MMP labels only',
    );
  });

  test('says the anatomy is being prepared, a failure by its code, and the full brain with no cut', () => {
    const loading = { status: 'loading', error: null, cutAtlas: 'destrieux' } as const;
    expect(sectionSentences(input({ state: loading }))).toEqual({
      said: 'Preparing anatomy…',
      shown: 'Preparing anatomy…',
    });
    const failed = { status: 'error', error: 'asset-fetch', cutAtlas: 'destrieux' } as const;
    expect(sectionSentences(input({ state: failed })).said).toMatch(
      /^Could not prepare the section\. /,
    );
    expect(sectionSentences(input({ active: false }))).toEqual({
      said: 'Full brain · no cut',
      shown: 'Full brain · no cut',
    });
  });

  test('a failure the bar caught replaces the sentence', () => {
    const { said, shown } = sectionSentences(input({ failure: new RangeError('outside') }));
    expect(said).toBe('Could not prepare the section.');
    expect(shown).toBe(said);
  });
});
