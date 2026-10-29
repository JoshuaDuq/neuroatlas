// The region inspector in Chromium: the empty hint, the selected panel, the commands and their
// hand-offs, the disclosure sections and the constituents, against the real CDMD manifest and
// published partitions. The view-models are C5's (core/panels/inspector.test.ts); the legacy
// source-text tests (chrome.contract.test.js:34, 200, 392-422) are role and name assertions here.
import { flushSync, mount } from 'svelte';
import { beforeEach, describe, expect, test } from 'vitest';
import { cdp, page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import manifest from '../../../../public/models/cdmd/manifest.json';
import boundaryFile from '../../../../public/models/cdmd/boundary-certainty.json';
import type { BoundaryCertainty } from '../../lib/core/catalog/boundary-certainty.ts';
import { expectAxeClean, withMedia } from '../../lib/ui/a11y-test-support.ts';
import { FOCUS_TARGETS, requestFocus } from '../../lib/ui/focus.ts';
import '../../app/layout.css';
import Fixture from './inspector-test-support.svelte';

const V1 = 'hcp-mmp:left:1';
const FRONTAL = 'hcp-mmp:left:50'; // an area CAB-NP assigns and the domains score
const CERUBELLUM = 'aseg:left:8';
const CHIASM = 'learning:midline:optic-chiasm';
const INNOMINATA = 'learning:left:innominata';
const THALAMUS = 'learning:left:thalamus';
const NOTED = 'pam50:left:gracile-fasciculus'; // carries notes
const STACKED = 'learning:left:caudate'; // three source labels

beforeEach(() => page.viewport(1280, 800));

const regionIds = (id: string) =>
  (manifest.regions as unknown as { id: string; source_label_ids?: number[] }[]).find(
    (region) => region.id === id,
  )!.source_label_ids!;
const text = (element: Element) => element.textContent!.replace(/\s+/g, ' ').trim();
const root = () => document.querySelector('.region-detail') as HTMLElement;
const section = (name: RegExp | string) =>
  [...document.querySelectorAll<HTMLDetailsElement>('details')].find((details) =>
    typeof name === 'string'
      ? text(details.querySelector('summary')!).startsWith(name)
      : name.test(text(details.querySelector('summary')!)),
  )!;
const button = (name: RegExp | string) => page.getByRole('button', { name });

describe('empty state', () => {
  test('says no region is selected and what to do, with no commands or facts', async () => {
    render(Fixture, { regionId: null });
    await expect.element(page.getByRole('heading', { name: 'No region selected' })).toBeVisible();
    await expect
      .element(page.getByText('Select a region on the model or in the anatomy list.'))
      .toBeVisible();
    expect(document.querySelectorAll('button, dl, details')).toHaveLength(0);
  });

  test('says the cortex is hidden when it is', async () => {
    render(Fixture, { regionId: null, cortexVisible: false });
    await expect
      .element(page.getByText('Cortex is hidden — internal structures are selectable.'))
      .toBeVisible();
  });

  test('outside Anatomy there is nothing to say', async () => {
    render(Fixture, { regionId: null, explorer: 'functions' });
    expect(text(root())).toBe('');
  });

  test('French', async () => {
    render(Fixture, { regionId: null, lang: 'fr' });
    await expect
      .element(page.getByRole('heading', { name: 'Aucune région sélectionnée' }))
      .toBeVisible();
  });
});

describe('selected region', () => {
  test('names the region, its side and group, then the commands and facts, in that order', async () => {
    render(Fixture, { regionId: V1 });
    const title = page.getByRole('heading', { level: 2 });
    await expect.element(title).toHaveTextContent('V1');
    const context = root().querySelector('dl.selection-context')!;
    expect([...context.querySelectorAll('dt')].map(text)).toEqual(['Hemisphere', 'Lobe / System']);
    expect(text(context.querySelectorAll('dd')[0]!)).toBe('Left');
    expect(text(context.querySelectorAll('dd')[1]!).length).toBeGreaterThan(0);
    expect([...root().querySelectorAll('.actions button')].map(text)).toEqual([
      'Focus',
      'Isolate',
      'Hide',
      'Linked MRI',
    ]);
    const facts = root().querySelector('dl.facts')!;
    expect([...facts.querySelectorAll('dt')].map(text)).toEqual([
      'Surface area',
      'Centroid (RAS)',
      'Source label',
    ]);
    expect(text(facts.querySelectorAll('dd')[1]!)).toBe('−12.3, +56.8, −9.0 mm');
    expect(text(facts.querySelectorAll('dd')[2]!)).toContain('· 1');
    // Order of the DOM is the order on screen (WCAG 1.3.2): name, context, commands, facts.
    const order = [...root().querySelectorAll('h2, dl.selection-context, .actions, dl.facts')];
    expect(order.map((node) => node.className || node.tagName)).toEqual([
      'region-name',
      'selection-context',
      'actions',
      'facts',
    ]);
  });

  test('a structure is measured by its volume; a missing centroid is a dash', async () => {
    render(Fixture, { regionId: CERUBELLUM });
    const facts = root().querySelector('dl.facts')!;
    expect(text(facts.querySelector('dt')!)).toBe('Volume');
    expect(text(facts.querySelectorAll('dd')[0]!)).toBe('49 790 mm³');
    expect(text(facts.querySelectorAll('dd')[1]!)).toBe('—');
  });

  test('French labels and decimal comma', async () => {
    render(Fixture, { regionId: V1, lang: 'fr' });
    const context = root().querySelector('dl.selection-context')!;
    expect(text(context.querySelectorAll('dd')[0]!)).toBe('Gauche');
    expect(
      [...root().querySelectorAll('.actions button')].map((node) => node.textContent!.trim()),
    ).toEqual(['Cibler', 'Isoler', 'Masquer', 'IRM liée']);
    expect(text(root().querySelectorAll('dl.facts dd')[1]!)).toContain('−12,3');
  });

  test('a region with notes shows them as the hint', async () => {
    render(Fixture, { regionId: NOTED });
    expect(text(root().querySelector('.selected-hint')!).length).toBeGreaterThan(0);
  });

  test('the slots follow the sections: comparison first, deficits and circuits after the body', async () => {
    render(Fixture, { regionId: V1 });
    const comparison = document.querySelector('[data-slot=comparison]')!;
    const first = section('Functional division')!;
    expect(
      comparison.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(root().contains(document.querySelector('[data-slot=deficits]'))).toBe(false);
    expect(
      root().compareDocumentPosition(document.querySelector('[data-slot=circuits]')!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test('the title is the region-title focus target and takes focus by request', async () => {
    render(Fixture, { regionId: V1 });
    expect(requestFocus(FOCUS_TARGETS.regionTitle)).toBe(true);
    expect(document.activeElement).toBe(root().querySelector('h2'));
    expect(document.activeElement!.getAttribute('tabindex')).toBe('-1');
  });

  test('a lesson landmark hides the name and the context; another region is a ruled, smaller subject', async () => {
    const screen = await render(Fixture, { regionId: V1, landmarkSelected: true });
    expect(getComputedStyle(root().querySelector('.selection-head')!).display).toBe('none');
    expect(getComputedStyle(root().querySelector('.selection-context')!).display).toBe('none');
    await screen.rerender({ regionId: V1, landmarkSelected: false });
    expect(getComputedStyle(root().querySelector('.selection-context')!).display).toBe('flex');
    expect(getComputedStyle(root()).borderTopWidth).toBe('1px');
    expect(getComputedStyle(root().querySelector('.region-name')!).fontSize).toBe('16px');
  });

  test('under a profile the rule and the smaller name need a name to apply to', async () => {
    const screen = await render(Fixture, {
      regionId: null,
      explorer: 'functions',
      underProfile: true,
    });
    expect(getComputedStyle(root()).borderTopWidth).toBe('0px');
    await screen.rerender({ regionId: V1, underProfile: true });
    expect(getComputedStyle(root()).borderTopWidth).toBe('1px');
    expect(getComputedStyle(root().querySelector('.region-name')!).fontSize).toBe('16px');
    await screen.rerender({ regionId: V1, underProfile: false });
    expect(getComputedStyle(root()).borderTopWidth).toBe('0px');
  });

  test('the context follows the language and leaves with the selection', async () => {
    const screen = await render(Fixture, { regionId: THALAMUS });
    const read = () => [...root().querySelectorAll('.selection-context dd')].map(text);
    const [side, group] = read();
    expect(side).toBe('Left');
    await screen.rerender({ regionId: THALAMUS, lang: 'fr' });
    const [sideFr, groupFr] = read();
    expect(sideFr).toBe('Gauche');
    expect(groupFr).not.toBe(group);
    expect(groupFr!.length).toBeGreaterThan(0);
    await screen.rerender({ regionId: null, lang: 'fr' });
    expect(root().querySelector('.selection-context')).toBeNull();
    expect(root().querySelector('dl.facts')).toBeNull();
  });

  test('related sections following remove the body bottom padding; alone it keeps 24 px', async () => {
    const screen = await render(Fixture, { regionId: V1 });
    expect(getComputedStyle(root()).paddingBottom).toBe('0px');
    await screen.rerender({ regionId: V1, slots: false });
    expect(getComputedStyle(root()).paddingBottom).not.toBe('0px');
  });

  test('on a phone the inspector has no Clear button of its own', async () => {
    render(Fixture, { regionId: V1 });
    await page.viewport(390, 844);
    expect(getComputedStyle(root().querySelector('.selection-clear')!).display).toBe('none');
    await page.viewport(1280, 800);
    expect(getComputedStyle(root().querySelector('.selection-clear')!).display).not.toBe('none');
  });
});

describe('commands', () => {
  test('Focus, Hide and Clear call their handlers', async () => {
    const calls: unknown[] = [];
    render(Fixture, { regionId: V1, calls });
    await button('Focus').click();
    await button('Hide').click();
    await button('Clear selection').click();
    expect(calls).toEqual(['focus', 'hide', 'clear']);
  });

  test('Isolate becomes Restore, is drawn as selected and never claims to be pressed', async () => {
    const calls: unknown[] = [];
    const screen = await render(Fixture, { regionId: V1, calls });
    const isolate = () => root().querySelectorAll<HTMLElement>('.actions button')[1]!;
    expect(isolate().getAttribute('data-active')).toBe('false');
    expect(isolate().hasAttribute('aria-pressed')).toBe(false);
    await button('Isolate').click();
    expect(calls).toEqual(['isolate']);
    await screen.rerender({ regionId: V1, calls, isolated: true });
    expect(text(isolate())).toBe('Restore');
    expect(isolate().getAttribute('data-active')).toBe('true');
    expect(isolate().hasAttribute('aria-pressed')).toBe(false);
    expect(document.activeElement).toBe(isolate());
  });

  test('Linked MRI: a keyboard activation is instant, a pointer click is not', async () => {
    const calls: unknown[] = [];
    render(Fixture, { regionId: V1, calls });
    const mri = button('Linked MRI');
    await mri.click();
    mri.element().focus();
    await userEvent.keyboard('{Enter}');
    expect(calls).toEqual([
      { mri: { atRegion: true, instant: false } },
      { mri: { atRegion: true, instant: true } },
    ]);
    expect(mri.element().textContent!.trim()).toBe('Linked MRI');
    expect(mri.element().hasAttribute('aria-keyshortcuts')).toBe(false);
    expect(mri.element().hasAttribute('aria-label')).toBe(false);
    expect(mri.element().getAttribute('data-tooltip')).toBe('Open linked MRI slices');
  });

  test('Tab walks Clear, the four commands, the source and each section, then Enter toggles one', async () => {
    render(Fixture, { regionId: V1 });
    const walked: string[] = [];
    (document.querySelector('.selection-clear') as HTMLElement).focus();
    for (let step = 0; step < 8; step++) {
      if (step > 0) await userEvent.keyboard('{Tab}');
      walked.push(text(document.activeElement!));
    }
    expect(walked.slice(0, 5)).toEqual(['', 'Focus', 'Isolate', 'Hide', 'Linked MRI']);
    expect(walked.slice(5)).toEqual([
      'Functional division',
      'Neuropsychological functions',
      'Functional networks',
    ]);
    // The ninth stop, after the networks, is the typical arterial supply.
    await userEvent.keyboard('{Tab}');
    expect(text(document.activeElement!)).toBe('Typical arterial supply');
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    const networks = section('Functional networks');
    expect(networks.open).toBe(false);
    await userEvent.keyboard('{Enter}');
    expect(networks.open).toBe(true);
    await userEvent.keyboard(' ');
    expect(networks.open).toBe(false);
  });
});

describe('source label', () => {
  test('one id sits beside its atlas; three or more stack under the label', async () => {
    const screen = await render(Fixture, { regionId: V1 });
    const dd = () => root().querySelectorAll<HTMLElement>('dl.facts dd')[2]!;
    expect(dd().className).not.toContain('stacked');
    expect(dd().querySelector('.code')!.textContent).toBe('1');
    await screen.rerender({ regionId: STACKED });
    expect(dd().className).toContain('stacked');
  });

  test('past eight ids the list is a native disclosure that stays open until the region changes', async () => {
    const screen = await render(Fixture, { regionId: THALAMUS });
    const disclosure = () => root().querySelector<HTMLDetailsElement>('.source-labels details')!;
    expect(text(disclosure().querySelector('summary')!)).toMatch(/\d+ labels$/);
    const ids = regionIds(THALAMUS);
    expect(text(disclosure().querySelector('.code')!)).toBe(ids.join(', '));
    disclosure().open = true;
    await screen.rerender({ regionId: THALAMUS, isolated: true, cortexVisible: false });
    expect(disclosure().open).toBe(true);
    await screen.rerender({ regionId: THALAMUS, lang: 'fr' });
    expect(text(disclosure().querySelector('summary')!)).toMatch(/\d+ étiquettes$/);
    expect(disclosure().open).toBe(false);
    disclosure().open = true;
    await screen.rerender({ regionId: 'learning:right:thalamus' });
    expect(disclosure().open).toBe(false);
  });
});

describe('evidence sections', () => {
  test('functional division, domains, networks and arterial supply, in that order, collapsed, with plain summaries', async () => {
    render(Fixture, { regionId: FRONTAL });
    const sections = [...root().querySelectorAll('details')].filter(
      (details) => !details.closest('.source-labels'),
    );
    expect(sections.map((details) => text(details.querySelector('summary')!))).toEqual([
      'Functional division',
      'Neuropsychological functions',
      'Functional networks',
      'Typical arterial supply',
    ]);
    for (const details of sections) {
      expect(details.open).toBe(false);
      expect(details.querySelector('summary h1, summary h2, summary h3')).toBeNull();
    }
    expect(document.querySelectorAll('h3')).toHaveLength(0);
  });

  test('networks show the Yeo shares with a bar and a percentage, CAB-NP at 100 %, and the caveat', async () => {
    render(Fixture, { regionId: FRONTAL });
    const networks = section('Functional networks');
    networks.open = true;
    const rows = [...networks.querySelectorAll('.network-row')].map(text);
    expect(rows.at(-1)).toMatch(/ 100\s?%$/);
    expect(rows[0]).toMatch(/%$/);
    expect(networks.querySelectorAll('.network-bar[aria-hidden=true]').length).toBe(rows.length);
    expect(text(networks)).toContain(
      'Group resting-state networks, not measured function in this brain.',
    );
    expect(text(networks)).toContain('Yeo 7 networks');
    expect(text(networks)).toContain('CAB-NP networks');
  });

  test('functional division names the section, the source and the areas', async () => {
    render(Fixture, { regionId: V1 });
    const division = section('Functional division');
    division.open = true;
    const rows = [...division.querySelectorAll('.network-row')].map(text);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatch(/^.+Section 1 · Glasser et al\. \(2016\) · HCP‑MMP areas: .+/);
  });

  test('a contested area adds the published disagreement to the note', async () => {
    const { regions } = (await import('../../../../public/models/cdmd/manifest.json')).default as {
      regions: { id: string; source_name?: string }[];
    };
    const contested = regions.find((region) => region.source_name === 'L_23c_ROI')!;
    render(Fixture, { regionId: contested.id });
    expect(text(section('Functional division'))).toContain(
      'Glasser’s Table 1 gives section 7 as this area’s primary section',
    );
  });

  test('domains list the strongest first with their z; a structure uses its own note', async () => {
    const screen = await render(Fixture, { regionId: V1 });
    const domains = () => section('Neuropsychological functions');
    domains().open = true;
    expect(text(domains().querySelector('.network-row')!)).toMatch(/“.+” · z \d+\.\d/);
    expect(text(domains())).toContain('this whole HCP-MMP area');
    await screen.rerender({ regionId: CERUBELLUM });
    expect(text(domains())).toContain('over this whole structure');
  });

  test('a teaching unit lists its structure’s functions and says it takes that score', async () => {
    const screen = await render(Fixture, { regionId: 'aseg:left:18' });
    const domains = () => section('Neuropsychological functions');
    domains().open = true;
    const rows = () => [...domains().querySelectorAll('.network-row')].map(text);
    const amygdala = rows();
    expect(text(domains())).not.toContain('This teaching-set unit');
    await screen.rerender({ regionId: 'learning:left:amygdala' });
    expect(rows()).toEqual(amygdala);
    expect(rows()[0]).toBe('Facial emotion recognition “facial expressions” · z 13.2');
    expect(text(domains())).toContain('This teaching-set unit takes the score');
  });

  test('a region outside every partition has no evidence sections', async () => {
    render(Fixture, { regionId: INNOMINATA });
    expect(section('Functional')).toBeUndefined();
    expect(section('Neuropsychological')).toBeUndefined();
  });

  test('each section keeps its open state from one selection to the next', async () => {
    const screen = await render(Fixture, { regionId: V1 });
    await userEvent.click(section('Functional networks').querySelector('summary')!);
    expect(section('Functional networks').open).toBe(true);
    await screen.rerender({ regionId: INNOMINATA });
    await screen.rerender({ regionId: FRONTAL });
    expect(section('Functional networks').open).toBe(true);
  });

  test('French', async () => {
    render(Fixture, { regionId: V1, lang: 'fr' });
    expect(section('Division fonctionnelle')).not.toBeUndefined();
    expect(section('Fonctions neuropsychologiques')).not.toBeUndefined();
  });
});

describe('boundary certainty', () => {
  // Right rostral VPL: fourteen rated neighbours, three of them soft.
  const VPL = 'nextbrain:right:10394';
  const rated = (id: string) =>
    (boundaryFile as unknown as BoundaryCertainty).pairs
      .filter(([a, b]) => a === id || b === id)
      .map(([a, b, voxels, near]) => ({ id: a === id ? b : a, voxels, share: near / voxels }))
      .sort((x, y) => y.voxels - x.voxels);

  test('a NextBrain region lists its eight largest boundaries after the comparison, collapsed', async () => {
    render(Fixture, { regionId: VPL });
    const boundaries = section('Boundary certainty');
    expect(boundaries.open).toBe(false);
    expect(
      document.querySelector('[data-slot=comparison]')!.compareDocumentPosition(boundaries) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    boundaries.open = true;
    const expected = rated(VPL);
    expect(expected.length).toBeGreaterThan(8);
    const rows = [...boundaries.querySelectorAll('.network-row')];
    expect(rows).toHaveLength(8);
    expected.slice(0, 8).forEach((boundary, index) => {
      const row = rows[index]!;
      const soft = boundary.share >= 1 / 3;
      expect(row.querySelector('.edge-glyph')!.getAttribute('data-soft')).toBe(String(soft));
      expect(text(row)).toMatch(
        new RegExp(`, ${soft ? 'soft' : 'firm'} .*${Math.round(boundary.share * 100)}%$`),
      );
    });
    expect(text(boundaries)).toContain(`${expected.length - 8} smaller boundaries not listed.`);
    expect(text(boundaries)).toContain('in 0.4 mm voxels');
    expect(text(boundaries)).toContain('within 0.2 of each other');
    await expectAxeClean();
  });

  test('a neighbour’s name selects it', async () => {
    const calls: unknown[] = [];
    render(Fixture, { regionId: VPL, calls });
    section('Boundary certainty').open = true;
    const first = rated(VPL)[0]!;
    await userEvent.click(section('Boundary certainty').querySelector('.boundary-neighbour')!);
    expect(calls).toEqual([`select:${first.id}`]);
  });

  test('a region with no rated boundary has no section', async () => {
    render(Fixture, { regionId: V1 });
    expect(section('Boundary certainty')).toBeUndefined();
  });

  test('French', async () => {
    render(Fixture, { regionId: VPL, lang: 'fr' });
    const boundaries = section('Certitude des limites');
    boundaries.open = true;
    expect(text(boundaries)).toContain('en voxels de 0,4 mm');
    expect(text(boundaries)).toMatch(/Quasi-égalité sur \d+ % des limites évaluées/);
  });
});

describe('constituents', () => {
  test('a structure part is a button that opens it; a cut-only part is text with its tail', async () => {
    const calls: unknown[] = [];
    render(Fixture, { regionId: INNOMINATA, calls });
    const constituents = section('Constituent regions');
    expect(text(constituents.querySelector('summary')!)).toMatch(/^Constituent regions \d+$/);
    constituents.open = true;
    const rows = [...constituents.querySelectorAll('li')];
    const cutOnly = rows.filter((row) => !row.querySelector('button'));
    expect(cutOnly.length).toBeGreaterThan(0);
    expect(text(cutOnly[0]!)).toContain('Cut only');
    const part = rows.find((row) => row.querySelector('button'))!;
    (part.querySelector('button') as HTMLElement).click();
    expect(calls).toHaveLength(1);
    expect(String(calls[0])).toMatch(/^region:/);
    expect(text(constituents)).toContain('Union of source regions.');
  });

  test('parts of one side show no side; parts of both name it to a reader and show a glyph', async () => {
    const screen = await render(Fixture, { regionId: INNOMINATA });
    expect(document.querySelector('.constituent-side')).toBeNull();
    expect(document.querySelector('.constituents-list .visually-hidden')).toBeNull();
    await screen.rerender({ regionId: CHIASM });
    const rows = [...document.querySelectorAll('.constituents-list li')];
    expect(rows).toHaveLength(2);
    const names = rows.map((row) => text(row.querySelector('button')!));
    expect(names[0]).toMatch(/, left$/);
    expect(names[1]).toMatch(/, right$/);
    expect([...document.querySelectorAll('.constituent-side')].map(text)).toEqual(['L', 'R']);
    for (const glyph of document.querySelectorAll('.constituent-side')) {
      expect(glyph.getAttribute('aria-hidden')).toBe('true');
    }
    section('Constituent regions').open = true;
    await expect.element(page.getByRole('button', { name: /, left$/ })).toBeVisible();
  });

  test('names follow a language switch, as legacy rebuilt the list per language', async () => {
    const screen = await render(Fixture, { regionId: CHIASM });
    const names = () =>
      [...document.querySelectorAll('.constituents-list button')].map((node) => text(node));
    expect(names()[0]).toMatch(/^Optic chiasm, left$/i);
    await screen.rerender({ regionId: CHIASM, lang: 'fr' });
    expect(names()[0]).toMatch(/^Chiasma optique, gauche$/);
  });

  test("the side glyph is set like the tree's: secondary ink, 600, right-aligned", async () => {
    render(Fixture, { regionId: CHIASM });
    const glyph = getComputedStyle(document.querySelector('.constituent-side')!);
    expect(glyph.fontWeight).toBe('600');
    expect(glyph.textAlign).toBe('right');
    expect(glyph.whiteSpace).toBe('nowrap');
    const probe = document.body.appendChild(document.createElement('span'));
    probe.style.color = 'var(--text-secondary)';
    expect(glyph.color).toBe(getComputedStyle(probe).color);
    probe.remove();
  });

  test('French side words', async () => {
    render(Fixture, { regionId: CHIASM, lang: 'fr' });
    expect(text(document.querySelector('.constituents-list button')!)).toMatch(/, gauche$/);
  });
});

describe('targets, reflow and text spacing', () => {
  for (const regionId of [CHIASM, FRONTAL]) {
    test(`a fine pointer gets at least 24 px; a coarse pointer 44 (${regionId})`, async () => {
      const targets = () =>
        [...root().querySelectorAll<HTMLElement>('button, summary')].map(
          (node) =>
            [
              text(node) || node.getAttribute('aria-label'),
              node.getBoundingClientRect().height,
            ] as const,
        );
      render(Fixture, { regionId });
      for (const details of root().querySelectorAll('details')) details.open = true;
      expect(targets().length).toBeGreaterThan(5);
      for (const [name, height] of targets())
        expect(height, String(name)).toBeGreaterThanOrEqual(24);
      const session = cdp();
      await session.send('Emulation.setTouchEmulationEnabled', {
        enabled: true,
        maxTouchPoints: 5,
      });
      try {
        await page.viewport(1180, 820);
        expect(matchMedia('(pointer: coarse)').matches).toBe(true);
        for (const [name, height] of targets())
          expect(height, String(name)).toBeGreaterThanOrEqual(44);
      } finally {
        await session.send('Emulation.setTouchEmulationEnabled', { enabled: false });
      }
    });
  }

  test('200 % text and the WCAG 1.4.12 spacing keep every line inside the panel, down to 320 px', async () => {
    const screen = await render(Fixture, { regionId: FRONTAL });
    for (const details of root().querySelectorAll('details')) details.open = true;
    document.documentElement.style.fontSize = '200%';
    const spacing = document.head.appendChild(document.createElement('style'));
    spacing.textContent =
      '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }';
    try {
      for (const lang of ['en', 'fr'] as const) {
        await screen.rerender({ regionId: FRONTAL, lang });
        for (const width of [1280, 320]) {
          await page.viewport(width, 800);
          const spilling = [
            ...root().querySelectorAll<HTMLElement>(
              'h2, dt:not(.visually-hidden), dd, li, p, summary, button',
            ),
          ]
            .filter((element) => element.scrollWidth > element.clientWidth + 1)
            .map((element) => text(element));
          expect(spilling, `${lang} ${width}px`).toEqual([]);
          // A button's border still encloses its text: nothing is taller than the box it sits in.
          for (const control of root().querySelectorAll<HTMLElement>('.actions button')) {
            expect(control.scrollHeight, text(control)).toBeLessThanOrEqual(control.clientHeight);
          }
          expect(document.documentElement.scrollWidth, `${lang} ${width}px`).toBeLessThanOrEqual(
            document.documentElement.clientWidth,
          );
        }
      }
    } finally {
      spacing.remove();
      document.documentElement.style.fontSize = '';
    }
  });

  test('a very long name wraps instead of widening the panel', async () => {
    await page.viewport(320, 800);
    render(Fixture, { regionId: CHIASM });
    const name = root().querySelector<HTMLElement>('.region-name')!;
    name.textContent = 'W'.repeat(200);
    expect(root().scrollWidth).toBeLessThanOrEqual(root().clientWidth);
  });
});

describe('accessibility', () => {
  for (const [lang, regionId] of [
    ['en', CHIASM],
    ['fr', CHIASM],
    ['en', FRONTAL],
    ['fr', FRONTAL],
  ] as const) {
    test(`axe is clean, light and dark, desktop and phone (${lang}, ${regionId}, sections open)`, async () => {
      render(Fixture, { regionId, lang });
      for (const details of root().querySelectorAll('details')) details.open = true;
      await expectAxeClean();
    });
  }

  test('axe is clean for the empty state and for the long source list', async () => {
    const screen = await render(Fixture, { regionId: null });
    await expectAxeClean();
    await screen.rerender({ regionId: THALAMUS });
    for (const details of root().querySelectorAll('details')) details.open = true;
    await expectAxeClean();
  });

  test('increased contrast gives the commands an edge', async () => {
    render(Fixture, { regionId: CHIASM });
    const first = () => getComputedStyle(root().querySelector('.actions button')!).borderTopColor;
    expect(first()).toBe('rgba(0, 0, 0, 0)');
    await withMedia([{ name: 'prefers-contrast', value: 'more' }], () =>
      expect.poll(first).not.toBe('rgba(0, 0, 0, 0)'),
    );
  });

  test('increased contrast keeps the accent edge of Restore', async () => {
    render(Fixture, { regionId: CHIASM, isolated: true });
    const edge = () =>
      getComputedStyle(root().querySelector('.actions [data-active=true]')!).borderTopColor;
    const accent = document.body.appendChild(document.createElement('span'));
    accent.style.color = 'var(--accent)';
    const accentColour = getComputedStyle(accent).color;
    accent.remove();
    await expect.poll(edge).toBe(accentColour);
    await withMedia([{ name: 'prefers-contrast', value: 'more' }], async () => {
      // The other commands take --border-control (primary ink here); once their edge has
      // transitioned in, a Restore that lost its accent would have too.
      const other = () =>
        getComputedStyle(root().querySelector('.actions button:not([data-active=true])')!)
          .borderTopColor;
      await expect.poll(other).not.toBe('rgba(0, 0, 0, 0)');
      expect(edge()).toBe(accentColour);
    });
  });

  test('forced colours keep an edge on the commands and on Restore; reduced motion stops the chevron', async () => {
    render(Fixture, { regionId: CHIASM, isolated: true });
    await withMedia([{ name: 'forced-colors', value: 'active' }], () => {
      const restore = root().querySelectorAll<HTMLElement>('.actions button')[1]!;
      expect(getComputedStyle(restore).outlineStyle).toBe('solid');
      expect(getComputedStyle(restore).borderTopColor).not.toBe('rgba(0, 0, 0, 0)');
    });
    await withMedia([{ name: 'prefers-reduced-motion', value: 'reduce' }], () => {
      const summary = root().querySelector<HTMLElement>('.constituents > summary')!;
      expect(getComputedStyle(summary, '::after').transitionDuration).toBe('0s');
    });
  });
});

describe('failure', () => {
  test('a constituent the catalog does not know throws, naming it', async () => {
    const { default: Constituents } = await import('./Constituents.svelte');
    expect(() =>
      flushSync(() =>
        mount(Constituents, {
          target: document.body,
          props: {
            region: { id: 'x', constituent_regions: ['ghost'] } as never,
            lang: 'en',
            get: () => null,
            label: () => ({}) as never,
            onregion: () => {},
          },
        }),
      ),
    ).toThrow('Missing learning constituent: ghost');
  });
});

describe('receptor densities', () => {
  const AREA_44 = 'julich:left:2';
  const IFS1 = 'julich:left:75';
  const PF = 'julich:left:65';
  const FO1 = 'julich:left:3'; // no fingerprint is published for it
  const PUTAMEN = 'aseg:left:12';
  const row = (details: Element, receptor: string) =>
    [...details.querySelectorAll('.receptor-row')].find((item) =>
      text(item).startsWith(`${receptor} `),
    );

  test('an area sampled in two parts shows each part’s fingerprint by transmitter', async () => {
    render(Fixture, { regionId: AREA_44 });
    const receptors = section('Receptor densities');
    expect(receptors.open).toBe(false);
    expect(
      document.querySelector('[data-slot=comparison]')!.compareDocumentPosition(receptors) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    receptors.open = true;
    expect([...receptors.querySelectorAll('.network-map')].map(text)).toEqual([
      'Glutamate',
      'GABA',
      'Acetylcholine',
      'Noradrenaline',
      'Serotonin',
      'Dopamine',
    ]);
    expect(text(row(receptors, 'NMDA')!)).toBe('NMDA 964 ± 95');
    expect(row(receptors, 'mGluR2/3')).toBeUndefined();
    expect(text(receptors)).toContain('Not measured: mGluR2/3, A1.');
    expect(text(receptors)).toContain(
      'autoradiography of 4 hemispheres from 3 post-mortem brains aged 72–77',
    );
    expect(text(receptors)).toContain('Measured in: Dorsal part of Area 44 (IFG).');
    expect([...receptors.querySelectorAll('a')].map((link) => link.getAttribute('href'))).toEqual([
      'https://doi.org/10.25493/yqcr-1dq',
      'https://doi.org/10.1016/j.cortex.2014.07.007',
    ]);
    await userEvent.click(page.getByRole('radio', { name: 'Ventral' }));
    expect(text(row(receptors, 'NMDA')!)).toBe('NMDA 1129 ± 382');
    expect(text(row(receptors, 'mGluR2/3')!)).toBe('mGluR2/3 3545 ± 913');
    expect(text(receptors)).toContain('Measured in: Ventral part of Area 44 (IFG).');
    await expectAxeClean();
  });

  test('the chosen part holds across a region without parts and back', async () => {
    const screen = await render(Fixture, { regionId: AREA_44 });
    section('Receptor densities').open = true;
    await userEvent.click(page.getByRole('radio', { name: 'Ventral' }));
    await screen.rerender({ regionId: PUTAMEN });
    expect(text(row(section('Receptor densities'), 'NMDA')!)).toMatch(/^NMDA \d+ ± \d+$/);
    await screen.rerender({ regionId: AREA_44 });
    expect(text(row(section('Receptor densities'), 'NMDA')!)).toBe('NMDA 1129 ± 382');
    expect(
      page.getByRole('radio', { name: 'Ventral' }).element().getAttribute('aria-checked'),
    ).toBe('true');
  });

  test('a withheld SD gives its reason, and an unpublished one says so', async () => {
    const screen = await render(Fixture, { regionId: IFS1 });
    section('Receptor densities').open = true;
    expect(text(row(section('Receptor densities'), 'D1')!)).toBe('D1 78 ± —, no SD');
    expect(text(section('Receptor densities'))).toContain(
      'D1 SD withheld (published as 863): The published SD equals the same file',
    );
    await screen.rerender({ regionId: PF });
    expect(text(row(section('Receptor densities'), 'α2')!)).toBe('α2 837 ± —, no SD');
    expect(text(section('Receptor densities'))).toContain('No SD published for α2.');
  });

  test('a deep structure takes the fingerprint of what was measured; a region without one has no section', async () => {
    const screen = await render(Fixture, { regionId: PUTAMEN });
    section('Receptor densities').open = true;
    expect(text(section('Receptor densities'))).toContain('from 2 post-mortem brains');
    expect(text(section('Receptor densities'))).toContain('Measured in: Putamen.');
    expect(section('Receptor densities').querySelector('[role=radiogroup]')).toBeNull();
    await screen.rerender({ regionId: FO1 });
    expect(section('Receptor densities')).toBeUndefined();
    await screen.rerender({ regionId: V1 });
    expect(section('Receptor densities')).toBeUndefined();
  });

  test('French', async () => {
    render(Fixture, { regionId: AREA_44, lang: 'fr' });
    const receptors = section('Densités de récepteurs');
    receptors.open = true;
    expect(page.getByRole('radio', { name: 'Dorsale' }).element()).toBeTruthy();
    expect(text(receptors)).toContain('Acétylcholine');
    expect(text(receptors)).toContain('de 4 hémisphères issus de 3 cerveaux post mortem');
  });
});

describe('typical arterial supply', () => {
  test('a deep structure lists its territories by voxel share, with the caveat', async () => {
    render(Fixture, { regionId: 'aseg:left:12' });
    const supply = section('Typical arterial supply');
    expect(supply.open).toBe(false);
    supply.open = true;
    const rows = [...supply.querySelectorAll('.network-row')].map(text);
    expect(rows[0]).toBe('Lateral lenticulostriate 87%');
    expect(rows.length).toBeGreaterThan(1);
    expect(text(supply)).toContain('Share of this region’s voxels in each territory.');
    expect(text(supply)).toContain('not this brain’s own vessels');
    await expectAxeClean();
  });

  test('a cortical area counts its pial vertices; a territory itself and an unreached region have none', async () => {
    const screen = await render(Fixture, { regionId: 'julich:left:2' });
    section('Typical arterial supply').open = true;
    expect(text(section('Typical arterial supply'))).toContain(
      'Share of this region’s pial vertices in each territory.',
    );
    expect(text(section('Typical arterial supply').querySelector('.network-row')!)).toMatch(
      /^Middle cerebral artery, frontal \d+%$/,
    );
    await screen.rerender({ regionId: 'arterial:left:aca' });
    expect(section('Typical arterial supply')).toBeUndefined();
    await screen.rerender({ regionId: NOTED });
    expect(section('Typical arterial supply')).toBeUndefined();
  });

  test('French', async () => {
    render(Fixture, { regionId: 'aseg:left:12', lang: 'fr' });
    const supply = section('Vascularisation artérielle typique');
    supply.open = true;
    expect(text(supply.querySelector('.network-row')!)).toMatch(
      /^Lenticulo-striées latérales 87\s?%$/,
    );
  });
});

describe('functional cerebellar regions', () => {
  const HEADING = 'Functional regions (group atlas)';

  test('a lobule lists its regions by voxel share with their domain, and says it is a group map', async () => {
    render(Fixture, { regionId: 'learning:lobule-v-left' });
    const regions = section(HEADING);
    expect(regions.open).toBe(false);
    regions.open = true;
    const rows = [...regions.querySelectorAll('.network-row')].map(text);
    expect(rows[0]).toBe('M3 · hand · left Motor 49%');
    // Its few shares across the midline say which side they are; this lobule has one.
    expect(rows.some((row) => row.includes('· right'))).toBe(true);
    expect(text(regions)).toContain('Share of this lobule’s voxels in each functional region.');
    expect(text(regions)).toMatch(/\d+% lies in no region the atlas draws on this brain\./);
    expect(text(regions)).toContain('not this brain’s measured function');
    await expectAxeClean();
  });

  test('a functional region chosen on a cut says what the paper found it does; other regions have none', async () => {
    const screen = await render(Fixture, { regionId: 'nettekoven:right:s2' });
    section(HEADING).open = true;
    expect(text(section(HEADING))).toContain('Social, linguistic and spatial');
    expect(text(section(HEADING))).toContain('theory-of-mind task on the right');
    await screen.rerender({ regionId: 'aseg:left:12' });
    expect(section(HEADING)).toBeUndefined();
  });

  test('French', async () => {
    render(Fixture, { regionId: 'learning:lobule-v-left', lang: 'fr' });
    const regions = section('Régions fonctionnelles (atlas de groupe)');
    regions.open = true;
    expect(text(regions.querySelector('.network-row')!)).toMatch(
      /^M3 · main · gauche Moteur 49\s?%$/,
    );
  });
});
