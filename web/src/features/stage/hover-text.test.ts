// The chip's words (app.js:1694-1717): the region, the division, the network, the functions and the side.
import { describe, expect, test } from 'vitest';
import type { FunctionalRegions } from '../../lib/core/catalog/functional-regions.ts';
import type { CabNpPartition } from '../../lib/core/catalog/networks.ts';
import type { NeuropsychDomains } from '../../lib/core/catalog/neuropsych-domains.ts';
import type { Paint, Region } from '../../lib/types/index.ts';
import { hoverText } from './hover-text.ts';
import type { HoverSources, HoverView } from './hover-text.ts';

const region = (id: string, extra: Partial<Region> = {}) =>
  ({ id, label: `raw ${id}`, hemisphere: 'left', kind: 'cortex', ...extra }) as Region;

const functionPaint = { id: 'function:all', colors: new Map() } as Paint;

const view = (extra: Partial<HoverView> = {}): HoverView => ({
  lang: 'en',
  surfaceColor: 'atlas',
  functionalLevel: 'named',
  paint: null,
  selectedFunction: null,
  ...extra,
});

const functionalRegions = {
  id: 'functional-regions',
  atlas: 'a',
  sources: {},
  levels: {
    named: [{ id: 'f1', name: 'Frontal', name_fr: 'Frontal fr' }],
    sections: [{ id: 's1', name: 'Section', name_fr: 'Section fr' }],
  },
  regions: { named: { a: 'f1' }, sections: { a: 's1', glass: 's1' } },
} as unknown as FunctionalRegions;

const cabNp = { regions: { a: 'Visual1' } } as unknown as CabNpPartition;

const domains = {
  domains: [
    { id: 'attention', name: 'Attention', name_fr: 'Attention fr', overview: true },
    { id: 'memory', name: 'Memory', name_fr: 'Mémoire', overview: false },
  ],
  regions: {
    a: [
      { domain: 'attention', z: 4 },
      { domain: 'memory', z: 3 },
    ],
    b: [{ domain: 'memory', z: 3 }],
  },
  // A teaching unit carrying area a's score.
  units: { u: 'a' },
  search: {
    terms: new Map([
      ['term:reading', { id: 'term:reading', term: 'reading', areas: [{ region: 'a', z: 3 }] }],
    ]),
  },
} as unknown as NeuropsychDomains;

const sources = (extra: Partial<HoverSources> = {}): HoverSources => ({
  regions: new Map(),
  functionalRegions,
  cabNp,
  domains,
  catalogName: (id) => ({ a: 'Area A' })[id],
  canSelect: () => true,
  ...extra,
});

describe('hoverText', () => {
  test('the catalog name and the capitalised side, joined by a middle dot', () => {
    expect(hoverText(region('a'), view(), sources())).toBe('Area A · Left');
    expect(hoverText(region('a', { hemisphere: 'midline' }), view(), sources())).toBe(
      'Area A · Midline',
    );
  });

  test('a region the catalog does not name keeps its own label', () => {
    expect(hoverText(region('x'), view(), sources())).toBe('raw x · Left');
  });

  test('the side is worded in French', () => {
    expect(hoverText(region('a'), view({ lang: 'fr' }), sources())).toBe('Area A · Gauche');
  });

  test('a region the model will not select has no chip', () => {
    expect(hoverText(region('a'), view(), sources({ canSelect: () => false }))).toBeNull();
  });

  test('the functional division only while the surface is coloured by it', () => {
    const functional = view({ surfaceColor: 'functional' });
    expect(hoverText(region('a'), functional, sources())).toBe('Area A · Frontal · Left');
    expect(hoverText(region('a'), view({ ...functional, lang: 'fr' }), sources())).toBe(
      'Area A · Frontal fr · Gauche',
    );
  });

  test('glass belongs to no division of the level on show, but always to a section', () => {
    expect(hoverText(region('glass'), view({ surfaceColor: 'functional' }), sources())).toBe(
      'raw glass · Section · Left',
    );
  });

  test('CAB-NP names its network for every area', () => {
    const cab = view({ surfaceColor: 'cab-np' });
    expect(hoverText(region('a'), cab, sources())).toBe('Area A · Primary visual · Left');
    expect(hoverText(region('zz'), cab, sources())).toBe('raw zz · Left');
  });

  test('Yeo 7 names a network only where all its assigned vertices share one', () => {
    const one = region('a', { networks: [{ network: 'Vis', fraction: 1 }] });
    const two = region('a', {
      networks: [
        { network: 'Vis', fraction: 0.5 },
        { network: 'Default', fraction: 0.5 },
      ],
    });
    const yeo = view({ surfaceColor: 'network' });
    expect(hoverText(one, yeo, sources({ regions: new Map([['a', one]]) }))).toBe(
      'Area A · Visual · Left',
    );
    expect(hoverText(two, yeo, sources({ regions: new Map([['a', two]]) }))).toBe('Area A · Left');
  });

  test('while the functions are painted: the overview functions the area reaches, strongest first', () => {
    const painted = view({ paint: functionPaint, selectedFunction: 'all' });
    expect(hoverText(region('a'), painted, sources())).toBe('Area A · Attention · Left');
    expect(hoverText(region('b'), painted, sources())).toBe('raw b · Left');
    expect(hoverText(region('u'), painted, sources())).toBe('raw u · Attention · Left');
  });

  test('one function shown alone names it where the area reaches it', () => {
    const memory = view({ paint: functionPaint, selectedFunction: 'memory' });
    expect(hoverText(region('b'), memory, sources())).toBe('raw b · Memory · Left');
    expect(hoverText(region('a'), view({ ...memory, lang: 'fr' }), sources())).toBe(
      'Area A · Mémoire · Gauche',
    );
  });

  test('a searched term is named only on the areas it carries', () => {
    const term = view({ paint: functionPaint, selectedFunction: 'term:reading' });
    expect(hoverText(region('a'), term, sources())).toBe('Area A · reading · Left');
    expect(hoverText(region('b'), term, sources())).toBe('raw b · Left');
    expect(hoverText(region('u'), term, sources())).toBe('raw u · reading · Left');
  });

  test('a deficit paint names no function', () => {
    const deficit = view({ paint: { id: 'deficit:aphasia', colors: new Map() } as Paint });
    expect(hoverText(region('a'), deficit, sources())).toBe('Area A · Left');
  });

  test('a function painted without published domains fails fast', () => {
    expect(() =>
      hoverText(region('a'), view({ paint: functionPaint }), sources({ domains: null })),
    ).toThrow('no domains');
  });
});
