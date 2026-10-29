// The atlas comparison in Chromium, against the real CDMD manifest and the real published comparison
// file (served through a stubbed `fetch`, so the SHA-256 check runs on the true bytes). The catalog is
// C5's (core/comparison/catalog.test.ts) and the figures are comparison-format.test.ts; the legacy
// source-text and DOM-stub tests (atlas-comparison.test.js, app.test.js:217-233) are behavioural here.
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, onTestFinished, test, vi } from 'vitest';
import { cdp, page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import manifest from '../../../../public/models/cdmd/manifest.json';
import raw from '../../../../public/models/cdmd/atlas-comparison.json?raw';
import rawDestrieuxJulich from '../../../../public/models/cdmd/atlas-comparison-destrieux-julich.json?raw';
import rawHcpJulich from '../../../../public/models/cdmd/atlas-comparison-hcp-mmp-julich.json?raw';
import rawDestrieuxSchaefer from '../../../../public/models/cdmd/atlas-comparison-destrieux-schaefer.json?raw';
import rawJulichSchaefer from '../../../../public/models/cdmd/atlas-comparison-julich-schaefer.json?raw';
import { createFakeEngine } from '../../lib/engine/fake.ts';
import type { Manifest } from '../../lib/types/index.ts';
import { expectAxeClean, withMedia } from '../../lib/ui/a11y-test-support.ts';
import { attachAnnouncer } from '../../lib/ui/announcer.svelte.ts';
import '../../app/layout.css';
import Fixture from './atlas-comparison-test-support.svelte';

const V1 = 'hcp-mmp:left:1'; // 5 overlaps: 4 shown, 1 more; no unassigned area
const SFG = 'destrieux:left:16'; // 23 overlaps: 4 shown, 19 more
const TINY = 'destrieux:left:4'; // its last overlap is 0.069 mm²
const REMAINDER = 'hcp-mmp:left:119'; // 71.98 mm² (19.7 %) overlap unassigned labels
const CEREBELLUM = 'aseg:left:8';
const COMPARISON_FILE = /atlas-comparison\.json$/;

const original = globalThis.fetch;
const createEngine = () => createFakeEngine({ manifest: manifest as unknown as Manifest });
const root = () => document.querySelector<HTMLElement>('.comparison')!;
const panel = () => root().querySelector<HTMLDetailsElement>(':scope > details')!;
const summaryOf = (details: Element) => details.querySelector<HTMLElement>(':scope > summary')!;
const status = () => root().querySelector<HTMLElement>('[role=status]')!;
const rows = () => [...root().querySelectorAll<HTMLButtonElement>('button.comparison-row')];
const text = (element: Element) => element.textContent!.replace(/\s+/g, ' ').trim();
const named = (name: RegExp | string) => page.getByRole('button', { name });

/** Serves the comparison file; every other request goes through. */
function serve(respond: () => Response | Promise<Response> = () => new Response(raw)) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation((input, init) =>
      COMPARISON_FILE.test(String(input)) ? Promise.resolve(respond()) : original(input, init),
    );
}
const requested = (fetch: ReturnType<typeof serve>) =>
  fetch.mock.calls.filter(([input]) => COMPARISON_FILE.test(String(input))).length;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

/**
 * A comparison download that answers when the test says. Downloads in flight are shared by URL, so
 * it is released when the test ends, whatever happened in it: one failure cannot hang the next tests.
 */
function heldDownload() {
  const answer = deferred<Response>();
  onTestFinished(() => answer.resolve(new Response(raw)));
  serve(() => answer.promise as unknown as Response);
  return answer;
}

/** An engine whose highlight answers when the test says, to put requests in a chosen order. */
function slowEngine() {
  const pending: { id: string; settle: (applied: boolean) => void }[] = [];
  const comparison = {
    highlight: vi.fn((id: string) => {
      const request = deferred<boolean>();
      pending.push({ id, settle: request.resolve });
      return request.promise;
    }),
    clear: vi.fn(),
    setVisible: vi.fn(),
  };
  return { engine: { comparison }, pending, comparison };
}

async function mount(props: Record<string, unknown> = {}) {
  const engine = createEngine();
  const screen = await render(Fixture, { engine, regionId: V1, ...props });
  await expect.poll(() => rows().length).toBeGreaterThan(0);
  return { engine, screen };
}
const open = (details: Element = panel()) => userEvent.click(summaryOf(details));

let announcer: HTMLElement;
let release: () => void;
beforeEach(async () => {
  await page.viewport(1280, 800);
  announcer = document.body.appendChild(document.createElement('div'));
  release = attachAnnouncer(announcer);
});
afterEach(() => {
  release();
  announcer.remove();
  vi.restoreAllMocks();
});

describe('when it is shown', () => {
  test('only for a cortex region of a manifest that declares a comparison', async () => {
    serve();
    const screen = await render(Fixture, { engine: createEngine(), regionId: V1 });
    expect(root().hidden).toBe(false);
    await screen.rerender({ engine: createEngine(), regionId: CEREBELLUM });
    expect(root().hidden).toBe(true);
    await screen.rerender({ engine: createEngine(), regionId: null });
    expect(root().hidden).toBe(true);
    await screen.rerender({ engine: createEngine(), regionId: V1, declared: false });
    expect(root().hidden).toBe(true);
  });

  test('names the other atlas, in the language shown', async () => {
    serve();
    const screen = await render(Fixture, { engine: createEngine(), regionId: V1 });
    expect(text(summaryOf(panel()))).toBe('Overlap with Destrieux');
    await screen.rerender({ engine: createEngine(), regionId: SFG, lang: 'fr' });
    expect(text(summaryOf(panel()))).toBe('Recouvrement avec HCP-MMP');
  });

  test('the summary is plain text: no heading inside it, none removed from the outline', async () => {
    serve();
    await mount();
    expect(summaryOf(panel()).children).toHaveLength(0);
  });
});

describe('choosing the atlas compared with', () => {
  const PAIR_FILES: Record<string, string> = {
    'atlas-comparison.json': raw,
    'atlas-comparison-destrieux-julich.json': rawDestrieuxJulich,
    'atlas-comparison-hcp-mmp-julich.json': rawHcpJulich,
    'atlas-comparison-destrieux-schaefer.json': rawDestrieuxSchaefer,
    'atlas-comparison-julich-schaefer.json': rawJulichSchaefer,
  };
  const V1_JULICH = 'julich:left:8'; // Area hOc1 (V1, 17, CalcS)
  function servePairs() {
    return vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const name = String(input).split('/').at(-1)!;
      return name in PAIR_FILES
        ? Promise.resolve(new Response(PAIR_FILES[name]))
        : original(input, init);
    });
  }
  const fetched = (fetch: ReturnType<typeof servePairs>) =>
    fetch.mock.calls
      .map(([input]) => String(input).split('/').at(-1)!)
      .filter((name) => name in PAIR_FILES);
  const radio = (name: string) => page.getByRole('radio', { name });

  test('offers every atlas a pair declares, loads each pair once, and keeps it', async () => {
    const fetch = servePairs();
    await render(Fixture, { engine: createEngine(), regionId: SFG, pairs: true });
    await expect.poll(() => rows().length).toBeGreaterThan(0);
    await open();
    expect(text(summaryOf(panel()))).toBe('Overlap with HCP-MMP');
    await expect.element(radio('HCP-MMP')).toBeChecked();
    const hcpRows = rows().map(text);
    await userEvent.click(radio('Julich-Brain'));
    await expect.poll(() => text(summaryOf(panel()))).toBe('Overlap with Julich-Brain');
    await expect.poll(() => rows().map(text)).not.toEqual(hcpRows);
    expect(rows().length).toBeGreaterThan(0);
    await userEvent.click(radio('HCP-MMP'));
    await expect.poll(() => rows().map(text)).toEqual(hcpRows);
    expect(fetched(fetch)).toEqual([
      'atlas-comparison.json',
      'atlas-comparison-destrieux-julich.json',
    ]);
  });

  test('a Julich-Brain area is compared with Destrieux or HCP-MMP, with its own method note', async () => {
    servePairs();
    await render(Fixture, { engine: createEngine(), regionId: V1_JULICH, pairs: true });
    await expect.poll(() => rows().length).toBeGreaterThan(0);
    await open();
    expect(text(summaryOf(panel()))).toBe('Overlap with Destrieux');
    await userEvent.click(radio('HCP-MMP'));
    await expect.poll(() => text(summaryOf(panel()))).toBe('Overlap with HCP-MMP');
    await userEvent.click(page.getByText('Method and sources'));
    const method = root().querySelector('.comparison-method .detail-note')!;
    expect(text(method)).toContain('HCP-MMP labels are projected');
    expect(text(method)).toContain('its gap maps, cortex not yet mapped, count as unassigned');
  });

  test('a Schaefer parcel is compared with the three other atlases, its medial wall unassigned', async () => {
    const fetch = servePairs();
    await render(Fixture, { engine: createEngine(), regionId: 'schaefer:left:1', pairs: true });
    await expect.poll(() => rows().length).toBeGreaterThan(0);
    await open();
    expect(text(summaryOf(panel()))).toBe('Overlap with Destrieux');
    expect([...root().querySelectorAll('[role=radio]')].map((radio) => text(radio))).toEqual([
      'Destrieux',
      'HCP-MMP',
      'Julich-Brain',
    ]);
    await userEvent.click(radio('Julich-Brain'));
    await expect.poll(() => text(summaryOf(panel()))).toBe('Overlap with Julich-Brain');
    await userEvent.click(page.getByText('Method and sources'));
    expect(text(root().querySelector('.comparison-method .detail-note')!)).toContain(
      'its medial wall counts as unassigned',
    );
    expect(fetched(fetch)).toEqual([
      'atlas-comparison-destrieux-schaefer.json',
      'atlas-comparison-julich-schaefer.json',
    ]);
  });

  test('a region compared with one atlas offers no choice', async () => {
    serve();
    await render(Fixture, { engine: createEngine(), regionId: SFG });
    await expect.poll(() => rows().length).toBeGreaterThan(0);
    expect(root().querySelector('[role=radiogroup]')).toBe(null);
  });

  test('changing the atlas drops the outline drawn from the other pair', async () => {
    servePairs();
    const engine = createEngine();
    await render(Fixture, { engine, regionId: SFG, pairs: true });
    await expect.poll(() => rows().length).toBeGreaterThan(0);
    await open();
    await userEvent.click(rows()[0]!);
    await expect.poll(() => rows()[0]!.getAttribute('aria-pressed')).toBe('true');
    await userEvent.click(radio('Julich-Brain'));
    await expect.poll(() => text(summaryOf(panel()))).toBe('Overlap with Julich-Brain');
    expect(rows().some((row) => row.getAttribute('aria-pressed') === 'true')).toBe(false);
  });
});

describe('loading', () => {
  test('starts once, while the panel is still closed, and not again when it is hidden and shown', async () => {
    const fetch = serve();
    const { screen } = await mount();
    expect(panel().open).toBe(false);
    expect(requested(fetch)).toBe(1);
    await screen.rerender({ engine: createEngine(), regionId: SFG });
    await screen.rerender({ engine: createEngine(), regionId: CEREBELLUM });
    await screen.rerender({ engine: createEngine(), regionId: V1 });
    await expect.poll(() => rows().length).toBeGreaterThan(0);
    expect(requested(fetch)).toBe(1);
  });

  test('a hidden panel loads nothing', async () => {
    const fetch = serve();
    await render(Fixture, { engine: createEngine(), regionId: CEREBELLUM });
    expect(requested(fetch)).toBe(0);
  });

  test('the status line is on the page before it speaks, and busy is on the content, not above it', async () => {
    const answer = heldDownload();
    const screen = await render(Fixture, { engine: createEngine(), regionId: CEREBELLUM });
    const line = status();
    expect(text(line)).toBe('');
    await screen.rerender({ engine: createEngine(), regionId: V1 });
    await open();
    // The same node that was already there now says it: a live region inserted with its text may stay silent.
    expect(status()).toBe(line);
    expect(text(line)).toBe('Loading atlas comparison…');
    expect(line.closest('[aria-busy]')).toBeNull();
    expect(root().querySelector('[aria-busy=true]')).not.toBeNull();
    answer.resolve(new Response(raw));
    await expect.poll(() => rows().length).toBeGreaterThan(0);
    expect(root().querySelector('[aria-busy=true]')).toBeNull();
    expect(text(line)).toBe('Atlas comparison loaded.');
    expect(line.classList.contains('visually-hidden')).toBe(true);
  });

  test('a failed download says so, offers Retry, and Retry hands focus to the summary', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    let fail = true;
    const fetch = serve(() => (fail ? new Response('down', { status: 503 }) : new Response(raw)));
    await render(Fixture, { engine: createEngine(), regionId: V1 });
    await open();
    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent(
        'Could not load the atlas comparison. A file could not be downloaded. Check the connection and try again.',
      );
    expect(logged).toHaveBeenCalled();
    fail = false;
    const retry = page.getByRole('button', { name: 'Retry comparison' });
    (retry.element() as HTMLElement).focus();
    await retry.click();
    expect(document.activeElement).toBe(summaryOf(panel()));
    await expect.poll(() => rows().length).toBeGreaterThan(0);
    expect(requested(fetch)).toBe(2);
    expect(document.activeElement).toBe(summaryOf(panel()));
    await expect.element(retry).not.toBeInTheDocument();
  });

  test('a failed load is kept when the region changes: the error and Retry stay', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    serve(() => new Response('down', { status: 503 }));
    const screen = await render(Fixture, { engine: createEngine(), regionId: V1 });
    await open();
    await expect.element(page.getByRole('button', { name: 'Retry comparison' })).toBeVisible();
    await screen.rerender({ engine: createEngine(), regionId: SFG });
    expect(text(status())).toContain('Could not load the atlas comparison.');
    await expect.element(page.getByRole('button', { name: 'Retry comparison' })).toBeVisible();
  });

  test('bytes that do not match their checksum ask for a reload, in French too', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // The published bytes with one number changed: the SHA-256 check refuses them.
    serve(() => new Response(raw.replace('"schema_version": 1', '"schema_version": 2')));
    await render(Fixture, { engine: createEngine(), regionId: V1, lang: 'fr' });
    await open();
    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent('Planum a été mis à jour. Rechargez la page pour continuer.');
    await expect
      .element(page.getByRole('button', { name: 'Réessayer la comparaison' }))
      .toBeVisible();
  });
});

describe('the list', () => {
  test('shows four rows, then the rest behind a disclosure that says how many', async () => {
    serve();
    await mount({ regionId: SFG });
    await open();
    const list = root().querySelector(':scope .comparison-list')!;
    expect(list.querySelectorAll('button')).toHaveLength(4);
    const more = summaryOf(root().querySelectorAll('details')[1]!);
    expect(text(more)).toBe('19 more overlapping regions');
    expect(rows()).toHaveLength(23);
  });

  test('a single remaining region is singular in English and in French', async () => {
    serve();
    const { screen } = await mount();
    expect(text(summaryOf(root().querySelectorAll('details')[1]!))).toBe(
      '1 more overlapping region',
    );
    await screen.rerender({ engine: createEngine(), regionId: V1, lang: 'fr' });
    expect(text(summaryOf(root().querySelectorAll('details')[1]!))).toBe(
      '1 autre région en recouvrement',
    );
  });

  test('a row is a toggle named with its region, area and share', async () => {
    serve();
    await mount();
    await open();
    const first = rows()[0]!;
    expect(first.getAttribute('aria-pressed')).toBe('false');
    expect(first.getAttribute('aria-label')).toMatch(
      /^Highlight overlap with .+, 956\.4 mm², 34\.4% of this region$/,
    );
    // Label in name: each visible part of the region's name is part of the accessible name.
    for (const part of first.querySelectorAll('.comparison-name > span')) {
      expect(first.getAttribute('aria-label')).toContain(text(part));
    }
    expect(text(first.querySelectorAll('.measure')[0]!)).toBe('956.4');
    expect(text(first.querySelectorAll('.measure')[1]!)).toBe('34.4');
  });

  test('an HCP-MMP code is captioned with its Glasser section, in its accessible name too', async () => {
    serve();
    await mount({ regionId: SFG });
    await open();
    const first = rows()[0]!;
    const section = first.querySelector('.comparison-section');
    expect(section).not.toBeNull();
    expect(text(section!)).toMatch(/cortex/i);
    expect(first.getAttribute('aria-label')).toContain(`, ${text(section!)},`);
  });

  test('a Destrieux name needs no caption', async () => {
    serve();
    await mount({ regionId: V1 });
    await open();
    expect(rows()[0]!.querySelector('.comparison-section')).toBeNull();
  });

  test('French names its units and uses the decimal comma', async () => {
    serve();
    await mount({ lang: 'fr' });
    await open();
    expect(rows()[0]!.getAttribute('aria-label')).toMatch(
      /^Tracer le recouvrement avec .+, 956,4 mm², 34,4 % de cette région$/,
    );
  });

  test('an overlap too small to show reads <0.1, never 0.0', async () => {
    serve();
    await mount({ regionId: TINY });
    await open();
    await open(root().querySelectorAll('details')[1]!);
    const last = rows().at(-1)!;
    expect(text(last.querySelectorAll('.measure')[0]!)).toBe('<0.1');
    expect(text(last.querySelectorAll('.measure')[1]!)).toBe('<0.1');
  });

  test('the unassigned remainder gives each figure its unit for a screen reader', async () => {
    serve();
    await mount({ regionId: REMAINDER });
    await open();
    const remainder = root().querySelector('.unassigned')!;
    expect([...remainder.children].map(text)).toEqual(['Unassigned', '72.0 mm²', '19.7 %']);
    expect([...remainder.querySelectorAll('.visually-hidden')].map(text)).toEqual(['mm²', '%']);
  });

  test('the list and the method stay open from one region to the next', async () => {
    serve();
    const { screen } = await mount({ regionId: SFG });
    await open();
    await open(root().querySelectorAll('details')[1]!);
    await open(root().querySelectorAll('details')[2]!);
    await screen.rerender({ engine: createEngine(), regionId: 'destrieux:right:16' });
    expect(root().querySelectorAll('details')[1]!.open).toBe(true);
    expect(root().querySelectorAll('details')[2]!.open).toBe(true);
    await screen.rerender({ engine: createEngine(), regionId: CEREBELLUM });
    await screen.rerender({ engine: createEngine(), regionId: SFG });
    expect(panel().open).toBe(true);
    expect(root().querySelectorAll('details')[1]!.open).toBe(true);
    expect(root().querySelectorAll('details')[2]!.open).toBe(true);
  });

  test('the inline disclosures keep legacy weight and height, and the status adds no space under the summary', async () => {
    serve();
    await mount({ regionId: SFG });
    await open();
    for (const details of [
      root().querySelectorAll('details')[1]!,
      root().querySelectorAll('details')[2]!,
    ]) {
      const style = getComputedStyle(summaryOf(details));
      expect(style.fontWeight).toBe('400');
      expect(summaryOf(details).getBoundingClientRect().height).toBe(32);
    }
    expect(getComputedStyle(status()).marginTop).toBe('0px');
  });

  test('the sources are links to each atlas that open a new tab and say so', async () => {
    serve();
    await mount();
    await open();
    await open(root().querySelectorAll('details')[2]!);
    const links = [...root().querySelectorAll<HTMLAnchorElement>('.comparison-sources a')];
    expect(links.map((link) => [text(link), link.href, link.target, link.rel])).toEqual([
      [
        'Destrieux (opens in a new tab)',
        'https://doi.org/10.1016/j.neuroimage.2010.06.010',
        '_blank',
        'noopener noreferrer',
      ],
      [
        'HCP-MMP (opens in a new tab)',
        'https://doi.org/10.1038/nature18933',
        '_blank',
        'noopener noreferrer',
      ],
    ]);
  });
});

describe('highlighting an overlap', () => {
  test('pressing a row draws its outline and presses it; pressing it again clears both', async () => {
    serve();
    const { engine } = await mount();
    await open();
    const [first] = rows();
    await userEvent.click(first!);
    await expect.poll(() => first!.getAttribute('aria-pressed')).toBe('true');
    expect(engine.highlighted).toMatch(/^overlap:/);
    await userEvent.click(first!);
    expect(first!.getAttribute('aria-pressed')).toBe('false');
    expect(engine.highlighted).toBeNull();
  });

  test('the outline is requested for the pair, with the geometry the comparison names', async () => {
    serve();
    const { engine } = await mount();
    await open();
    await userEvent.click(rows()[0]!);
    await expect.poll(() => engine.highlighted).not.toBeNull();
    const call = engine.calls.find((entry) => entry.method === 'highlight')!;
    expect(call.args[1]).toEqual({
      file: 'atlas-overlaps.glb',
      sha256: 'c6ebb202fc9ec9852cc75ae8e6023d7efdd85e10e084abc3901e65d397b1d80c',
    });
  });

  test('only one row is pressed: another row takes the outline over', async () => {
    serve();
    const { engine } = await mount();
    await open();
    await userEvent.click(rows()[0]!);
    await expect.poll(() => rows()[0]!.getAttribute('aria-pressed')).toBe('true');
    const firstMesh = engine.highlighted;
    await userEvent.click(rows()[1]!);
    await expect.poll(() => rows()[1]!.getAttribute('aria-pressed')).toBe('true');
    expect(rows()[0]!.getAttribute('aria-pressed')).toBe('false');
    expect(engine.highlighted).not.toBe(firstMesh);
  });

  test('a row is not pressed, and the status says why, until its outline is drawn', async () => {
    serve();
    const { engine, pending } = slowEngine();
    await render(Fixture, { engine, regionId: V1 });
    await expect.poll(() => rows().length).toBeGreaterThan(0);
    await open();
    await userEvent.click(rows()[0]!);
    await expect.element(page.getByRole('status')).toHaveTextContent('Loading overlap outline…');
    expect(rows()[0]!.getAttribute('aria-pressed')).toBe('false');
    expect(root().querySelector('[aria-busy=true]')).not.toBeNull();
    pending[0]!.settle(true);
    await expect.poll(() => rows()[0]!.getAttribute('aria-pressed')).toBe('true');
    expect(text(status())).toBe('');
  });

  test('the latest request wins whatever order the outlines arrive in', async () => {
    serve();
    const { engine, pending } = slowEngine();
    await render(Fixture, { engine, regionId: V1 });
    await expect.poll(() => rows().length).toBeGreaterThan(0);
    await open();
    await userEvent.click(rows()[0]!);
    await userEvent.click(rows()[1]!);
    expect(pending).toHaveLength(2);
    pending[1]!.settle(true);
    await expect.poll(() => rows()[1]!.getAttribute('aria-pressed')).toBe('true');
    pending[0]!.settle(true);
    await new Promise((resolve) => setTimeout(resolve));
    expect(rows().map((row) => row.getAttribute('aria-pressed'))).toEqual([
      'false',
      'true',
      'false',
      'false',
      'false',
    ]);
  });

  test('an outline that cannot be loaded reports it and leaves the row unpressed', async () => {
    serve();
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { engine, comparison } = slowEngine();
    comparison.highlight.mockRejectedValueOnce(new Error('geometry'));
    await render(Fixture, { engine, regionId: V1 });
    await expect.poll(() => rows().length).toBeGreaterThan(0);
    await open();
    await userEvent.click(rows()[0]!);
    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent('Could not load the overlap outline.');
    expect(rows()[0]!.getAttribute('aria-pressed')).toBe('false');
    expect(logged).toHaveBeenCalled();
  });

  test('an outline the engine did not apply leaves the row unpressed and says nothing', async () => {
    serve();
    const { engine, pending } = slowEngine();
    await render(Fixture, { engine, regionId: V1 });
    await expect.poll(() => rows().length).toBeGreaterThan(0);
    await open();
    await userEvent.click(rows()[0]!);
    pending[0]!.settle(false);
    await expect.poll(() => text(status())).toBe('');
    expect(rows()[0]!.getAttribute('aria-pressed')).toBe('false');
  });

  describe('after an outline failed', () => {
    async function failed() {
      serve();
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const { engine, comparison, pending } = slowEngine();
      comparison.highlight.mockRejectedValueOnce(new Error('geometry'));
      const screen = await render(Fixture, { engine, regionId: V1 });
      await expect.poll(() => rows().length).toBeGreaterThan(0);
      await open();
      await userEvent.click(rows()[0]!);
      await expect.poll(() => text(status())).toBe('Could not load the overlap outline.');
      return { engine, screen, pending };
    }

    test('another region starts without the error', async () => {
      const { engine, screen } = await failed();
      await screen.rerender({ engine, regionId: SFG });
      await expect.poll(() => text(status())).not.toContain('Could not');
    });

    test('pressing another row starts without the error', async () => {
      const { pending } = await failed();
      await userEvent.click(rows()[1]!);
      await expect.poll(() => text(status())).toBe('Loading overlap outline…');
      pending[0]!.settle(true);
    });
  });

  test('closing the panel clears the outline; opening it again does not bring it back', async () => {
    serve();
    const { engine } = await mount();
    await open();
    await userEvent.click(rows()[0]!);
    await expect.poll(() => engine.highlighted).not.toBeNull();
    await open();
    expect(panel().open).toBe(false);
    expect(engine.highlighted).toBeNull();
    await open();
    expect(rows()[0]!.getAttribute('aria-pressed')).toBe('false');
  });

  test('closing the panel before the outline arrives means it never applies', async () => {
    serve();
    const { engine, pending, comparison } = slowEngine();
    await render(Fixture, { engine, regionId: V1 });
    await expect.poll(() => rows().length).toBeGreaterThan(0);
    await open();
    await userEvent.click(rows()[0]!);
    await open();
    expect(comparison.clear).toHaveBeenCalled();
    pending[0]!.settle(true);
    await open();
    await new Promise((resolve) => setTimeout(resolve));
    expect(rows()[0]!.getAttribute('aria-pressed')).toBe('false');
    expect(text(status())).toBe('');
  });

  test('another region, or none, drops the outline', async () => {
    serve();
    const { engine, screen } = await mount();
    await open();
    await userEvent.click(rows()[0]!);
    await expect.poll(() => engine.highlighted).not.toBeNull();
    await screen.rerender({ engine, regionId: SFG });
    expect(engine.highlighted).toBeNull();
    await userEvent.click(rows()[0]!);
    await expect.poll(() => engine.highlighted).not.toBeNull();
    await screen.rerender({ engine, regionId: null });
    expect(engine.highlighted).toBeNull();
  });

  test('unmounting clears the outline', async () => {
    serve();
    const { engine, comparison } = slowEngine();
    const screen = await render(Fixture, { engine, regionId: V1 });
    await expect.poll(() => rows().length).toBeGreaterThan(0);
    await open();
    await userEvent.click(rows()[0]!);
    screen.unmount();
    expect(comparison.clear).toHaveBeenCalled();
  });
});

describe('when no outline can be drawn (a cut, or the tract reference)', () => {
  test('rows stay in the tab order, say why, and do nothing', async () => {
    serve();
    const { engine } = await mount({ outlineAvailable: false });
    await open();
    for (const row of rows().slice(0, 4)) {
      expect(row.getAttribute('aria-disabled')).toBe('true');
      expect(row.disabled).toBe(false);
      const note = document.getElementById(row.getAttribute('aria-describedby')!)!;
      expect(text(note)).toMatch(/^Turn off sections to outline overlaps\./);
    }
    summaryOf(panel()).focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(rows()[0]);
    // aria-disabled leaves the button enabled to the page, but not to Playwright's actionability check.
    rows()[0]!.click();
    await new Promise((resolve) => setTimeout(resolve));
    expect(engine.calls.some((call) => call.method === 'highlight')).toBe(false);
    expect(rows()[0]!.getAttribute('aria-pressed')).toBe('false');
  });

  test('the note and the description go away when outlines come back', async () => {
    serve();
    const { screen, engine } = await mount({ outlineAvailable: false });
    await open();
    await screen.rerender({ engine, regionId: V1, outlineAvailable: true });
    expect(root().textContent).not.toContain('Turn off sections');
    expect(rows()[0]!.hasAttribute('aria-describedby')).toBe(false);
    expect(rows()[0]!.hasAttribute('aria-disabled')).toBe(false);
  });

  test('losing the outline drops a drawn highlight, and focus stays on the row', async () => {
    serve();
    const { screen, engine } = await mount();
    await open();
    rows()[1]!.focus();
    await userEvent.click(rows()[1]!);
    await expect.poll(() => engine.highlighted).not.toBeNull();
    await screen.rerender({ engine, regionId: V1, outlineAvailable: false });
    expect(engine.highlighted).toBeNull();
    expect(rows()[1]!.getAttribute('aria-pressed')).toBe('false');
    expect(document.activeElement).toBe(rows()[1]);
  });
});

describe('focus across a repaint', () => {
  test('a language switch keeps focus on the same row, now named in French', async () => {
    serve();
    const { screen, engine } = await mount();
    await open();
    const row = rows()[2]!;
    row.focus();
    await screen.rerender({ engine, regionId: V1, lang: 'fr' });
    expect(document.activeElement).toBe(row);
    expect(row.getAttribute('aria-label')).toMatch(/^Tracer le recouvrement avec /);
    expect(text(summaryOf(panel()))).toBe('Recouvrement avec Destrieux');
  });

  test('a pressed row keeps its focus and its press through a language switch', async () => {
    serve();
    const { screen, engine } = await mount();
    await open();
    await userEvent.click(rows()[0]!);
    await expect.poll(() => rows()[0]!.getAttribute('aria-pressed')).toBe('true');
    const row = rows()[0]!;
    row.focus();
    await screen.rerender({ engine, regionId: V1, lang: 'fr' });
    expect(document.activeElement).toBe(row);
    expect(row.getAttribute('aria-pressed')).toBe('true');
  });

  test('a language switch replaces the status line instead of rewriting it, so it is not spoken again', async () => {
    heldDownload();
    const screen = await render(Fixture, { engine: createEngine(), regionId: V1 });
    const before = status();
    expect(text(before)).toBe('Loading atlas comparison…');
    const rewritten = vi.fn();
    new MutationObserver(rewritten).observe(before, {
      subtree: true,
      characterData: true,
      childList: true,
    });
    await screen.rerender({ engine: createEngine(), regionId: V1, lang: 'fr' });
    expect(status()).not.toBe(before);
    expect(text(status())).toBe('Chargement de la comparaison des atlas…');
    expect(rewritten).not.toHaveBeenCalled();
  });
});

describe('Download CSV', () => {
  async function download(lang: 'en' | 'fr') {
    serve();
    let saved!: Promise<{ name: string; text: string }>;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      saved = original(this.href)
        .then((response) => response.text())
        .then((body) => ({ name: this.download, text: body }));
    });
    await mount({ regionId: SFG, lang });
    await open();
    await page
      .getByRole('button', { name: lang === 'en' ? 'Download CSV' : 'Télécharger CSV' })
      .click();
    return saved;
  }

  test('saves every overlap, named for the subject and the region', async () => {
    const file = await download('en');
    expect(file.name).toBe('cdmd-destrieux-left-16-hcp-mmp-atlas-comparison.csv');
    expect(file.text.endsWith('\r\n')).toBe(true);
    const lines = file.text.trimEnd().split('\r\n');
    expect(lines).toHaveLength(1 + 23);
    expect(lines[0]).toMatch(/^schema_version,anatomy_id,subject,/);
    expect(lines[1]).toContain(',destrieux:left:16,');
    expect(lines[1]).toContain('Superior frontal gyrus');
  });

  test('names the regions in the language shown', async () => {
    const file = await download('fr');
    expect(file.text).toContain('Gyrus frontal supérieur');
    expect(file.text).not.toContain('Superior frontal gyrus');
  });

  test('says it was saved', async () => {
    await download('en');
    expect(announcer.textContent).toBe('Atlas comparison CSV downloaded.');
  });

  test('says it was saved in French', async () => {
    await download('fr');
    expect(announcer.textContent).toBe('Fichier CSV de la comparaison des atlas téléchargé.');
  });
});

describe('targets, reflow and contrast', () => {
  test('a fine pointer gets at least 24 px; a coarse pointer 44', async () => {
    serve();
    await mount({ regionId: SFG });
    for (const details of root().querySelectorAll('details')) details.open = true;
    flushSync();
    const heights = (selector: string) =>
      [...root().querySelectorAll<HTMLElement>(selector)].map(
        (node) =>
          [
            text(node) || node.getAttribute('aria-label'),
            node.getBoundingClientRect().height,
          ] as const,
      );
    // The source links are text in a row of their own: 24 px, the WCAG 2.5.8 floor, at either pointer.
    const targets = () => heights('button, summary, .comparison-sources a');
    const coarse = () => heights('button, summary');
    expect(targets().length).toBeGreaterThan(25);
    for (const [name, height] of targets()) expect(height, String(name)).toBeGreaterThanOrEqual(24);
    const session = cdp();
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    try {
      await page.viewport(1180, 820);
      expect(matchMedia('(pointer: coarse)').matches).toBe(true);
      for (const [name, height] of coarse())
        expect(height, String(name)).toBeGreaterThanOrEqual(44);
    } finally {
      await session.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    }
  });

  test('200 % text and the WCAG 1.4.12 spacing keep every line inside the panel, down to 320 px', async () => {
    serve();
    const { screen, engine } = await mount({ regionId: SFG });
    for (const details of root().querySelectorAll('details')) details.open = true;
    document.documentElement.style.fontSize = '200%';
    const spacing = document.head.appendChild(document.createElement('style'));
    spacing.textContent =
      '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }';
    try {
      for (const lang of ['en', 'fr'] as const) {
        await screen.rerender({ engine, regionId: SFG, lang });
        for (const width of [1280, 320]) {
          await page.viewport(width, 800);
          const spilling = [
            ...root().querySelectorAll<HTMLElement>('p:not(.visually-hidden), summary, button, a'),
          ]
            .filter((element) => element.scrollWidth > element.clientWidth + 1)
            .map((element) => text(element));
          expect(spilling, `${lang} ${width}px`).toEqual([]);
          for (const control of root().querySelectorAll<HTMLElement>('button')) {
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

  test('forced colours draw the pressed row with an edge and the remainder with a rule', async () => {
    serve();
    await mount({ regionId: REMAINDER });
    await open();
    await userEvent.click(rows()[0]!);
    await expect.poll(() => rows()[0]!.getAttribute('aria-pressed')).toBe('true');
    const edge = () => getComputedStyle(rows()[0]!).borderInlineStartWidth;
    const rule = () => getComputedStyle(document.querySelector('.unassigned')!, '::before');
    expect(edge()).toBe('0px');
    await withMedia([{ name: 'forced-colors', value: 'active' }], () => {
      expect(edge()).toBe('4px');
      expect(rule().borderTopStyle).toBe('solid');
    });
    await withMedia([{ name: 'prefers-contrast', value: 'more' }], () => {
      expect(edge()).toBe('4px');
    });
  });
});

describe('accessibility', () => {
  for (const lang of ['en', 'fr'] as const) {
    test(`axe is clean, light and dark, desktop and phone (${lang}, everything open)`, async () => {
      serve();
      await mount({ regionId: SFG, lang });
      for (const details of root().querySelectorAll('details')) details.open = true;
      flushSync();
      await expectAxeClean();
    });
  }

  test('axe is clean with a row pressed and with outlines unavailable', async () => {
    serve();
    const { screen, engine } = await mount({ regionId: REMAINDER });
    await open();
    await userEvent.click(rows()[0]!);
    await expect.poll(() => rows()[0]!.getAttribute('aria-pressed')).toBe('true');
    await expectAxeClean();
    await screen.rerender({ engine, regionId: REMAINDER, outlineAvailable: false });
    await expectAxeClean();
  });

  test('axe is clean on the failure state', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    serve(() => new Response('down', { status: 503 }));
    await render(Fixture, { engine: createEngine(), regionId: V1 });
    await open();
    await expect.element(named('Retry comparison')).toBeVisible();
    await expectAxeClean();
  });
});
