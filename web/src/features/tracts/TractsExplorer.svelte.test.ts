// The Tracts panel against the fake engine (F2): keyboard paths, focus hand-offs, live regions,
// event order. Ported from viewer/diffusion/native-ui.test.js (source-text checks became DOM checks)
// and chrome.contract.test.js:226.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import manifest from '../../../../public/models/cdmd/manifest.json' with { type: 'json' };
import { tractCatalog } from '../../lib/core/diffusion/catalogs.ts';
import type { Engine } from '../../lib/engine/api.ts';
import { createFakeEngine } from '../../lib/engine/fake.ts';
import type { FakeEngine } from '../../lib/engine/fake.ts';
import type { Manifest } from '../../lib/types/index.ts';
import type { Language } from '../../lib/types/index.ts';
import { expectAxeClean, withMedia } from '../../lib/ui/a11y-test-support.ts';
import { attachAnnouncer } from '../../lib/ui/announcer.svelte.ts';
import TractsExplorer from './TractsExplorer.svelte';

const catalog = tractCatalog('cdmd');
const names = (lang: Language) => catalog.bundles.map((bundle) => bundle.name[lang]);

const createEngine = (): FakeEngine =>
  createFakeEngine({
    manifest: manifest as unknown as Manifest,
    tractBundles: catalog.bundles.map(({ id, name, initial }) => ({ id, name, initial })),
  });

/** A promise the test settles when it wants the engine to finish. */
function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

/** The fake's tracts with chosen calls held back; everything else falls through to the fake. */
function slowEngine(engine: FakeEngine, overrides: Partial<Engine['tracts']>): FakeEngine {
  const tracts = Object.create(
    engine.tracts,
    Object.fromEntries(
      Object.entries(overrides).map(([key, value]) => [key, { value, enumerable: true }]),
    ),
  ) as Engine['tracts'];
  return Object.assign(Object.create(engine), { tracts }) as FakeEngine;
}

let region: HTMLElement;
let release: () => void;
beforeEach(() => {
  region = document.body.appendChild(document.createElement('div'));
  release = attachAnnouncer(region);
});
afterEach(() => {
  release();
  region.remove();
});

function props(engine: Engine, extra: Record<string, unknown> = {}) {
  return {
    engine,
    anatomy: 'cdmd',
    lang: 'en' as Language,
    active: true,
    cortexOpacity: 0.16,
    onCortexOpacity: () => {},
    onOpenMri: () => {},
    ...extra,
  };
}

const key = (name: string) => page.getByRole('checkbox', { name, exact: true });
const el = (name: string) => key(name).element() as HTMLInputElement;
const search = () => page.getByRole('searchbox');
const searchEl = () => search().element() as HTMLInputElement;
const settings = () => document.querySelector('details.settings') as HTMLDetailsElement;
/** The text of what a locator finds, once it exists. */
const text = (locator: { element(): Element }) => locator.element().textContent ?? '';
const drawn = (engine: Engine) =>
  engine.tracts
    .snapshot()
    .filter((bundle) => bundle.visible)
    .map((bundle) => bundle.id)
    .sort();
const group = (name: string) => page.getByRole('group', { name, exact: true });

async function ready(engine = createEngine(), extra: Record<string, unknown> = {}) {
  const view = await render(TractsExplorer, props(engine, extra));
  await expect
    .poll(
      () =>
        !(page.getByRole('group').first().element().closest('fieldset') as HTMLFieldSetElement)
          .disabled,
    )
    .toBe(true);
  return { engine, view };
}

describe('the list', () => {
  test('one group per tract, one checkbox per bundle, each named in full', async () => {
    await ready();
    const groups = document.querySelectorAll('section [role="group"]');
    expect(groups).toHaveLength(13);
    const boxes = [
      ...document.querySelectorAll<HTMLInputElement>('section input[type="checkbox"]'),
    ];
    expect(boxes.map((box) => box.getAttribute('aria-label'))).toEqual(names('en'));
    await expect.element(group('Arcuate fasciculus')).toBeVisible();
    // The key shows a letter; its tooltip and its name are the whole bundle name.
    expect(el('Arcuate fasciculus · left').dataset.tooltip).toBe('Arcuate fasciculus · left');
    expect(el('Arcuate fasciculus · left').parentElement!.textContent!.trim()).toBe('L');
  });

  test('the first opening loads the dataset and draws the catalog’s two initial bundles', async () => {
    const { engine } = await ready();
    expect(engine.calls.filter((call) => call.method === 'setActive').map((c) => c.args)).toEqual([
      [true],
    ]);
    expect(el('Arcuate fasciculus · left').checked).toBe(true);
    expect(el('Corticospinal tract · right').checked).toBe(true);
    expect(el('Arcuate fasciculus · right').checked).toBe(false);
  });

  test('a tab that is not open loads nothing and is hidden', async () => {
    const engine = createEngine();
    await render(TractsExplorer, props(engine, { active: false }));
    expect(
      engine.calls.filter((call) => call.domain === 'tracts' && call.method === 'setActive'),
    ).toEqual([]);
    expect(document.querySelector<HTMLElement>('.tracts')!.hidden).toBe(true);
  });

  test('the count and lengths describe a key only while its bundle is drawn', async () => {
    await ready();
    const arcuate = el('Arcuate fasciculus · left');
    const described = document.getElementById(arcuate.getAttribute('aria-describedby')!)!;
    expect(described.textContent).toContain('L');
    expect(described.textContent).toContain('4 streamlines');
    expect(described.textContent).toContain('mean 50.0 mm (range 20.0–80.0)');
    // A bundle that is not drawn has no description at all, not a hidden one.
    const other = el('Arcuate fasciculus · right');
    expect(other.hasAttribute('aria-describedby')).toBe(false);
    expect(document.getElementById('native-diffusion-bundle-af-right-meta')).toBeNull();
  });

  test('Space draws a bundle already loaded and hides it again, and the description follows', async () => {
    const { engine } = await ready();
    el('Arcuate fasciculus · left').focus();
    await userEvent.keyboard(' ');
    expect(engine.tracts.snapshot().find((b) => b.id === 'af-left')!.visible).toBe(false);
    expect(el('Arcuate fasciculus · left').hasAttribute('aria-describedby')).toBe(false);
    await userEvent.keyboard(' ');
    expect(el('Arcuate fasciculus · left').checked).toBe(true);
  });

  test('a key that is not loaded downloads its bundle at the first check, then says so', async () => {
    const { engine } = await ready();
    expect(engine.tracts.hasBundle('cg-left')).toBe(false);
    el('Cingulum · left').focus();
    await userEvent.keyboard(' ');
    await expect.poll(() => engine.tracts.hasBundle('cg-left')).toBe(true);
    await expect.poll(() => el('Cingulum · left').checked).toBe(true);
    await expect.poll(() => region.textContent).toBe('Loaded: Cingulum · left');
  });

  test('the requested state shows while a bundle downloads, and reverts if the download fails', async () => {
    const download = deferred();
    const base = createEngine();
    const engine = slowEngine(base, { loadBundle: () => download.promise });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await render(TractsExplorer, props(engine));
    await expect.poll(() => el('Arcuate fasciculus · left').checked).toBe(true);
    await expect.poll(() => !el('Cingulum · left').closest('fieldset')!.disabled).toBe(true);
    await key('Cingulum · left').click();
    // The fieldset is disabled during the download; the box still reads as asked for, the row as busy.
    expect(el('Cingulum · left').closest('fieldset')!.disabled).toBe(true);
    expect(el('Cingulum · left').checked).toBe(true);
    expect(group('Cingulum').element().getAttribute('aria-busy')).toBe('true');
    download.reject(Object.assign(new Error('offline'), { code: 'asset-fetch' }));
    await expect.poll(() => text(page.getByRole('alert'))).toContain('could not be downloaded');
    expect(el('Cingulum · left').checked).toBe(false);
    expect(group('Cingulum').element().hasAttribute('aria-busy')).toBe(false);
  });
});

describe('the search', () => {
  test('filters on the tract name and any member name, without needing Enter', async () => {
    await ready();
    await search().fill('cingul');
    expect(document.querySelectorAll('section:not([hidden])')).toHaveLength(1);
    await expect.element(group('Cingulum')).toBeVisible();
    await search().fill('');
    expect(document.querySelectorAll('section:not([hidden])')).toHaveLength(13);
  });

  test('the heading counts the bundles kept and reads as one phrase', async () => {
    await ready();
    const heading = page.getByRole('heading', { level: 4 });
    await expect.poll(() => text(heading)).toContain('Tract bundles, 30');
    await search().fill('arcuate');
    await expect.poll(() => text(heading)).toContain('Tract bundles, 2');
  });

  test('no match replaces the heading with the empty state', async () => {
    await ready();
    await search().fill('zzz');
    await expect.element(page.getByText('No match for “zzz”')).toBeVisible();
    await expect.element(page.getByText('Try another tract name.')).toBeVisible();
    expect(document.querySelector('h4')).toBeNull();
  });

  test('French folds accents and case: “arque” finds “Arqué”', async () => {
    await ready(createEngine(), { lang: 'fr' });
    await search().fill('ARQUE');
    expect(document.querySelectorAll('section:not([hidden])')).toHaveLength(1);
    await search().fill('gauche');
    expect(document.querySelectorAll('section:not([hidden])')).toHaveLength(11);
  });

  test('Escape with text clears it and keeps focus in the field; on an empty field it bubbles', async () => {
    await ready();
    const outer = vi.fn();
    document.addEventListener('keydown', outer);
    searchEl().focus();
    await userEvent.keyboard('cing');
    await userEvent.keyboard('{Escape}');
    expect(searchEl().value).toBe('');
    expect(document.activeElement).toBe(searchEl());
    expect(outer.mock.calls.at(-1)![0].defaultPrevented).toBe(true);
    await userEvent.keyboard('{Escape}');
    expect(outer.mock.calls.at(-1)![0].defaultPrevented).toBe(false);
    document.removeEventListener('keydown', outer);
  });

  test('the clear button appears with text, clears it and returns focus to the field', async () => {
    await ready();
    expect(page.getByRole('button', { name: 'Clear search' }).elements()).toHaveLength(0);
    await search().fill('cing');
    await page.getByRole('button', { name: 'Clear search' }).click();
    expect(searchEl().value).toBe('');
    expect(document.activeElement).toBe(searchEl());
    expect(page.getByRole('button', { name: 'Clear search' }).elements()).toHaveLength(0);
  });

  test('the result count is announced once typing pauses, and the empty state is too', async () => {
    await ready();
    await search().fill('arcuate');
    expect(region.textContent).toBe('');
    await expect.poll(() => region.textContent, { timeout: 2000 }).toBe('2 tract bundles');
    await search().fill('zzz');
    await expect
      .poll(() => region.textContent, { timeout: 2000 })
      .toBe('No match for “zzz”. Try another tract name.');
  });

  test('focusSearch puts focus in the field', async () => {
    const view = await ready();
    (view.view.component as unknown as { focusSearch(): void }).focusSearch();
    expect(document.activeElement).toBe(searchEl());
  });
});

describe('loading, failure and retry', () => {
  test('the controls are disabled and the status says loading until the dataset is ready', async () => {
    const load = deferred();
    const engine = slowEngine(createEngine(), { setActive: () => load.promise });
    await render(TractsExplorer, props(engine));
    await expect.poll(() => text(page.getByRole('status'))).toContain('Loading reference dataset…');
    expect(document.querySelector<HTMLFieldSetElement>('fieldset')!.disabled).toBe(true);
    // The search stays usable while the dataset loads.
    expect(searchEl().disabled).toBe(false);
    load.resolve();
  });

  test('status and alert are separate elements; the status is never rewritten with the same words', async () => {
    await ready();
    const status = document.querySelector('[role="status"]')!;
    const writes: string[] = [];
    new MutationObserver(() => writes.push(status.textContent!)).observe(status, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    // Every slider move re-renders the panel; the ready sentence must not be written again.
    await page.getByText('Tract display').click();
    const range = page
      .getByRole('slider', { name: 'Minimum length (mm)' })
      .element() as HTMLInputElement;
    range.focus();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    expect(writes).toEqual([]);
    expect(document.querySelector('[role="alert"]')).toBeNull();
  });

  test('a failed dataset load shows an alert and Try again, which loads it again', async () => {
    const base = createEngine();
    let attempt = 0;
    const engine = slowEngine(base, {
      setActive: async (active) => {
        if (active && attempt++ === 0) {
          throw Object.assign(new Error('offline'), { code: 'asset-fetch' });
        }
        await base.tracts.setActive(active);
      },
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await render(TractsExplorer, props(engine));
    await expect.poll(() => text(page.getByRole('alert'))).toContain('could not be downloaded');
    expect(document.querySelector('[role="status"]')!.textContent).toBe('');
    expect(document.querySelector<HTMLFieldSetElement>('fieldset')!.disabled).toBe(true);
    const retry = page.getByRole('button', { name: 'Try again' });
    await retry.click();
    await expect.poll(() => document.querySelector('[role="alert"]')).toBeNull();
    await expect.poll(() => text(page.getByRole('status'))).toContain('Reference dataset ready.');
    expect(document.querySelector<HTMLFieldSetElement>('fieldset')!.disabled).toBe(false);
    // The button that was pressed is gone; focus did not fall to the page.
    expect(document.activeElement).toBe(searchEl());
  });

  test('focus returns to Try again when the retry fails too', async () => {
    const base = createEngine();
    const engine = slowEngine(base, {
      setActive: async () => {
        throw Object.assign(new Error('offline'), { code: 'asset-fetch' });
      },
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await render(TractsExplorer, props(engine));
    const retry = page.getByRole('button', { name: 'Try again' });
    await retry.click();
    await expect.element(retry).toBeVisible();
    await expect.poll(() => document.activeElement).toBe(retry.element());
  });

  test('an updated deploy offers Reload, not Try again', async () => {
    const engine = slowEngine(createEngine(), {
      setActive: async () => {
        throw Object.assign(new Error('updated'), { code: 'asset-updated' });
      },
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await render(TractsExplorer, props(engine));
    await expect.poll(() => text(page.getByRole('alert'))).toContain('Planum was updated');
    await expect.element(page.getByRole('button', { name: 'Reload', exact: true })).toBeVisible();
    expect(page.getByRole('button', { name: 'Try again' }).elements()).toHaveLength(0);
  });

  test('focus on a key survives the download that disabled it', async () => {
    const download = deferred();
    const base = createEngine();
    const engine = slowEngine(base, {
      loadBundle: async (id) => {
        await download.promise;
        await base.tracts.loadBundle(id);
      },
    });
    await render(TractsExplorer, props(engine));
    await expect.poll(() => !el('Cingulum · left').closest('fieldset')!.disabled).toBe(true);
    el('Cingulum · left').focus();
    await userEvent.keyboard(' ');
    await expect.poll(() => el('Cingulum · left').closest('fieldset')!.disabled).toBe(true);
    download.resolve();
    await expect.poll(() => document.activeElement).toBe(el('Cingulum · left'));
    expect(el('Cingulum · left').checked).toBe(true);
  });
});

describe('settings', () => {
  test('closed by default; the summary reads out opacity and the length filter', async () => {
    await ready();
    expect(settings().open).toBe(false);
    await expect.element(page.getByText('16% · ≥1 mm')).toBeVisible();
    await page.getByText('Tract display').click();
    expect(settings().open).toBe(true);
    // Open, the controls say it themselves.
    expect(document.querySelector<HTMLElement>('.readout')!.offsetParent).toBeNull();
  });

  test('the sliders are named by their label alone and carry the value as text', async () => {
    await ready();
    await page.getByText('Tract display').click();
    const opacity = page
      .getByRole('slider', { name: 'Cortex opacity' })
      .element() as HTMLInputElement;
    const minimum = page
      .getByRole('slider', { name: 'Minimum length (mm)' })
      .element() as HTMLInputElement;
    expect(opacity.getAttribute('aria-valuetext')).toBe('16%');
    expect(minimum.getAttribute('aria-valuetext')).toBe('1 mm');
    expect(document.querySelectorAll('.control-field output[aria-hidden="true"]')).toHaveLength(2);
  });

  test('on the tracts’ own anatomy the opacity slider sets the cortex opacity', async () => {
    const onCortexOpacity = vi.fn();
    const { engine } = await ready(createEngine(), { onCortexOpacity });
    await page.getByText('Tract display').click();
    const opacity = page
      .getByRole('slider', { name: 'Cortex opacity' })
      .element() as HTMLInputElement;
    opacity.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onCortexOpacity).toHaveBeenCalledWith(0.18);
    expect(engine.calls.some((call) => call.method === 'setOutlineOpacity')).toBe(false);
  });

  test('on another anatomy it sets the reference outline opacity and there is no overlay checkbox', async () => {
    const { engine } = await ready(createEngine(), { anatomy: 'snail' });
    await page.getByText('Tract display').click();
    expect(
      page.getByRole('checkbox', { name: 'Show tracts with anatomy' }).elements(),
    ).toHaveLength(0);
    const opacity = page
      .getByRole('slider', { name: 'Brain outline opacity' })
      .element() as HTMLInputElement;
    expect(opacity.getAttribute('aria-valuetext')).toBe('16%');
    opacity.focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(engine.calls.filter((c) => c.method === 'setOutlineOpacity').at(-1)!.args).toEqual([
      0.14,
    ]);
    await expect
      .element(page.getByText('uses a different subject', { exact: false }))
      .toBeVisible();
  });

  test('the minimum length updates the readout on input and is applied on change', async () => {
    const { engine } = await ready();
    await page.getByText('Tract display').click();
    const minimum = page
      .getByRole('slider', { name: 'Minimum length (mm)' })
      .element() as HTMLInputElement;
    minimum.focus();
    // `input` alone (a drag in progress) changes the readout only.
    minimum.value = '40';
    minimum.dispatchEvent(new Event('input', { bubbles: true }));
    await expect.poll(() => minimum.getAttribute('aria-valuetext')).toBe('40\u202fmm');
    expect(engine.calls.some((call) => call.method === 'setMinimum')).toBe(false);
    minimum.dispatchEvent(new Event('change', { bubbles: true }));
    expect(engine.calls.filter((c) => c.method === 'setMinimum').map((c) => c.args)).toEqual([
      [40],
    ]);
    // The kept streamlines follow, in the drawn bundles’ description.
    await expect
      .poll(() => document.querySelector('.meta')!.textContent)
      .toContain('3 of 4 streamlines');
  });

  test('the closed summary follows the minimum length and the language', async () => {
    await ready(createEngine(), { lang: 'fr' });
    await expect.element(page.getByText('16 % · ≥1 mm')).toBeVisible();
  });

  test('the overlay checkbox on the tracts’ own anatomy turns the overlay on and off', async () => {
    const { engine } = await ready();
    await page.getByText('Tract display').click();
    const overlay = page.getByRole('checkbox', { name: 'Show tracts with anatomy' });
    await overlay.click();
    expect(engine.calls.filter((c) => c.method === 'setOverlay').at(-1)!.args).toEqual([true]);
    await overlay.click();
    expect(engine.calls.filter((c) => c.method === 'setOverlay').at(-1)!.args).toEqual([false]);
  });

  test('Restore returns the drawn set to the catalog’s initial bundles, announces it, and keeps focus', async () => {
    const { engine } = await ready();
    await page.getByText('Tract display').click();
    await key('Arcuate fasciculus · left').click();
    await key('Arcuate fasciculus · right').click();
    expect(drawn(engine)).toEqual(['af-right', 'cst-right']);
    const restore = page.getByRole('button', { name: 'Restore default tracts' });
    await restore.click();
    expect(drawn(engine)).toEqual(['af-left', 'cst-right']);
    expect(document.activeElement).toBe(restore.element());
    expect(region.textContent).toBe('Default tracts restored.');
  });

  test('Export saves the lengths CSV under its name and announces it', async () => {
    await ready();
    await page.getByText('Tract display').click();
    let saved: { name: string; href: string } | null = null;
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      saved = { name: this.download, href: this.href };
    });
    await page.getByRole('button', { name: 'Export lengths CSV' }).click();
    expect(saved).toMatchObject({ name: 'planum-streamline-lengths.csv' });
    expect(saved!.href).toMatch(/^blob:/);
    expect(region.textContent).toBe('Lengths CSV exported.');
    click.mockRestore();
  });

  test('Tab reaches every control of the open settings in order', async () => {
    await ready();
    await page.getByText('Tract display').click();
    const summary = document.querySelector<HTMLElement>('.settings > summary')!;
    summary.focus();
    const order: string[] = [];
    for (let step = 0; step < 6; step += 1) {
      await userEvent.tab();
      const active = document.activeElement as HTMLElement;
      const label = (active as HTMLInputElement).labels?.[0] ?? active;
      order.push(label.textContent!.trim());
    }
    expect(order).toEqual([
      'Show tracts with anatomy',
      'Cortex opacity',
      'Minimum length (mm)',
      'Restore default tracts',
      'Export lengths CSV',
      'About this data',
    ]);
  });
});

describe('the notes and the command', () => {
  test('About opens on the notes, and its links say they open a new tab', async () => {
    await ready();
    await page.getByText('About this data').click();
    await expect.element(page.getByText('Tracts in their own T1 reference brain.')).toBeVisible();
    const source = page.getByRole('link', { name: 'Dataset source · CC0 (opens in a new tab)' });
    await expect.element(source).toHaveAttribute('target', '_blank');
    // The outline's provenance belongs to the other-anatomy reference only.
    expect(page.getByRole('link', { name: /Brain outline method/ }).elements()).toHaveLength(0);
    // The linked-MRI note belongs to the tracts' own anatomy.
    await expect
      .element(page.getByText('The linked MRI uses the same scan', { exact: false }))
      .toBeVisible();
  });

  test('the dock holds only the MRI button, which opens the navigator', async () => {
    const onOpenMri = vi.fn();
    await ready(createEngine(), { onOpenMri });
    const dock = document.querySelector('.dock')!;
    expect(dock.querySelectorAll('button')).toHaveLength(1);
    expect(dock.textContent).not.toMatch(/\.nii/);
    await page.getByRole('button', { name: 'MRI with tracts' }).click();
    expect(onOpenMri).toHaveBeenCalledOnce();
  });

  test('another anatomy shows the outline note and the provenance link, not the linked-MRI note', async () => {
    await ready(createEngine(), { anatomy: 'snail' });
    await page.getByText('About this data').click();
    await expect
      .element(page.getByText('MRI-derived brain outline', { exact: false }))
      .toBeVisible();
    await expect
      .element(page.getByRole('link', { name: /Brain outline method and provenance/ }))
      .toBeVisible();
    expect(page.getByText('The linked MRI uses the same scan').elements()).toHaveLength(0);
  });
});

describe('targets and media', () => {
  test('keys, buttons and summaries are at least 24 px', async () => {
    await ready();
    for (const box of document.querySelectorAll<HTMLElement>('section input[type="checkbox"]')) {
      const { width, height } = box.getBoundingClientRect();
      expect(width).toBeGreaterThanOrEqual(24);
      expect(height).toBeGreaterThanOrEqual(24);
    }
    for (const control of document.querySelectorAll<HTMLElement>('.dock button, summary')) {
      expect(control.getBoundingClientRect().height).toBeGreaterThanOrEqual(24);
    }
  });

  test('forced colours draw a drawn key in Highlight and an undrawn one in Canvas', async () => {
    await ready();
    await withMedia([{ name: 'forced-colors', value: 'active' }], async () => {
      const drawn = getComputedStyle(el('Arcuate fasciculus · left'));
      const undrawn = getComputedStyle(el('Arcuate fasciculus · right'));
      expect(drawn.backgroundColor).not.toBe(undrawn.backgroundColor);
    });
  });

  test('axe finds nothing in light and dark, at desktop and phone width, English and French', async () => {
    for (const lang of ['en', 'fr'] as const) {
      const { view } = await ready(createEngine(), { lang });
      await page.getByText(lang === 'en' ? 'Tract display' : 'Affichage des faisceaux').click();
      await page.getByText(lang === 'en' ? 'About this data' : 'À propos de ces données').click();
      await expectAxeClean();
      view.unmount();
    }
  });
});
