// The Tracts panel against the fake engine (F2): keyboard paths, focus hand-offs, live regions,
// event order. Ported from viewer/diffusion/native-ui.test.js (source-text checks became DOM checks)
// and chrome.contract.test.js:226.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cdp, page, userEvent } from 'vitest/browser';
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

describe('the engine follows the tab', () => {
  test('open, close and reopen during the first load reaches the engine as true, false, true', async () => {
    const load = deferred();
    const base = createEngine();
    const calls: boolean[] = [];
    const engine = slowEngine(base, {
      setActive: (active: boolean) => {
        calls.push(active);
        return load.promise;
      },
    });
    const view = await render(TractsExplorer, props(engine, { active: true }));
    await view.rerender(props(engine, { active: false }));
    await view.rerender(props(engine, { active: true }));
    expect(calls).toEqual([true, false, true]);
    load.resolve();
  });
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

describe('keys and sliders', () => {
  test('Enter and Space press the clear button, the summaries and the MRI button', async () => {
    const onOpenMri = vi.fn();
    await ready(createEngine(), { onOpenMri });
    await search().fill('cing');
    const clear = page.getByRole('button', { name: 'Clear search' }).element() as HTMLElement;
    clear.focus();
    await userEvent.keyboard('{Enter}');
    expect(searchEl().value).toBe('');
    expect(document.activeElement).toBe(searchEl());
    await search().fill('cing');
    (page.getByRole('button', { name: 'Clear search' }).element() as HTMLElement).focus();
    await userEvent.keyboard(' ');
    expect(searchEl().value).toBe('');

    const summaries = [...document.querySelectorAll<HTMLElement>('summary')];
    expect(summaries).toHaveLength(2);
    for (const summary of summaries) {
      const details = summary.parentElement as HTMLDetailsElement;
      summary.focus();
      await userEvent.keyboard('{Enter}');
      expect(details.open).toBe(true);
      await userEvent.keyboard(' ');
      expect(details.open).toBe(false);
      expect(document.activeElement).toBe(summary);
    }

    (page.getByRole('button', { name: 'MRI with tracts' }).element() as HTMLElement).focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onOpenMri).toHaveBeenCalledTimes(2);
  });

  test('PageUp, PageDown, Home and End move both sliders; the length filter applies on each', async () => {
    const onCortexOpacity = vi.fn();
    const { engine } = await ready(createEngine(), { onCortexOpacity });
    await page.getByText('Tract display').click();
    const opacity = page.getByRole('slider', { name: 'Cortex opacity' }).element() as HTMLElement;
    opacity.focus();
    await userEvent.keyboard('{Home}');
    expect(onCortexOpacity).toHaveBeenLastCalledWith(0);
    await userEvent.keyboard('{End}');
    expect(onCortexOpacity).toHaveBeenLastCalledWith(1);
    await userEvent.keyboard('{PageDown}');
    expect(onCortexOpacity.mock.lastCall![0]).toBeLessThan(0.98);
    const minimum = page
      .getByRole('slider', { name: 'Minimum length (mm)' })
      .element() as HTMLElement;
    minimum.focus();
    const applied = () =>
      engine.calls.filter((call) => call.method === 'setMinimum').map((call) => call.args[0]);
    await userEvent.keyboard('{End}');
    expect(applied().at(-1)).toBe(250);
    await userEvent.keyboard('{PageDown}');
    expect(applied().at(-1)).toBeLessThan(250);
    await userEvent.keyboard('{Home}');
    expect(applied().at(-1)).toBe(1);
    await userEvent.keyboard('{PageUp}');
    expect(applied().at(-1)).toBeGreaterThan(1);
  });

  test('a language switch keeps the search text, the open sections and the focused key, and says nothing', async () => {
    const engine = createEngine();
    const view = await render(TractsExplorer, props(engine));
    await expect.poll(() => !el('Cingulum · left').closest('fieldset')!.disabled).toBe(true);
    await search().fill('cing');
    await settle();
    await page.getByText('Tract display').click();
    el('Cingulum · left').focus();
    region.textContent = '';
    await view.rerender(props(engine, { lang: 'fr' }));
    expect(searchEl().value).toBe('cing');
    expect(settings().open).toBe(true);
    expect(document.activeElement).toBe(el('Cingulum · gauche'));
    await settle();
    expect(region.textContent).toBe('');
  });

  test('the search head carries the aria-hidden / keycap and the caption comes before the list', async () => {
    await ready();
    const keycap = document.querySelector('.head kbd')!;
    expect(keycap.textContent).toBe('/');
    expect(keycap.getAttribute('aria-hidden')).toBe('true');
    const heading = document.querySelector('h4')!;
    const list = document.getElementById('native-tract-bundles')!;
    expect(heading.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(document.querySelectorAll('details')).toHaveLength(2);
  });
});

/** A phone-sized stage: the panel fills the window, its list scrolls under a pinned head and dock. */
async function stage(width: number, height: number) {
  document.documentElement.style.height = '100%';
  document.body.style.height = '100%';
  document.body.style.margin = '0';
  // The panel's own ancestors need a definite height for its list to scroll under the pinned dock.
  for (
    let node = document.querySelector('.tracts')?.parentElement;
    node;
    node = node.parentElement
  ) {
    if (node !== document.body && node !== document.documentElement) node.style.height = '100%';
  }
  await page.viewport(width, height);
}
afterEach(async () => {
  document.documentElement.style.height = '';
  document.body.style.height = '';
  document.body.style.margin = '';
  await page.viewport(1280, 800);
});

describe('media, reflow and targets', () => {
  test('contrast: more draws the key edge in the control-edge colour', async () => {
    await ready();
    const probe = document.body.appendChild(document.createElement('i'));
    probe.style.border = '1px solid var(--border-control)';
    await withMedia([{ name: 'prefers-contrast', value: 'more' }], async () => {
      const box = el('Arcuate fasciculus · right');
      expect(getComputedStyle(box).borderTopColor).toBe(getComputedStyle(probe).borderTopColor);
    });
    probe.remove();
  });

  test('reduced motion stops the chevron turning', async () => {
    await ready();
    const summary = document.querySelector<HTMLElement>('.settings > summary')!;
    await withMedia([{ name: 'prefers-reduced-motion', value: 'reduce' }], async () => {
      expect(getComputedStyle(summary, '::after').transitionDuration).toBe('0s');
    });
  });

  test('at 320 px (400 % zoom) nothing scrolls sideways and no name is cut off', async () => {
    await ready();
    await page.getByText('Tract display').click();
    await page.getByText('About this data').click();
    await stage(320, 700);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(320);
    const body = document.querySelector<HTMLElement>('.body')!;
    expect(body.scrollWidth).toBeLessThanOrEqual(body.clientWidth);
    for (const node of document.querySelectorAll<HTMLElement>('.name, .meta, .values')) {
      expect(node.scrollWidth, node.textContent!).toBeLessThanOrEqual(node.clientWidth + 1);
    }
  });

  test('the text-spacing override (WCAG 1.4.12) clips nothing', async () => {
    await ready();
    const spacing = document.head.appendChild(document.createElement('style'));
    spacing.textContent =
      '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }';
    await stage(390, 800);
    for (const node of document.querySelectorAll<HTMLElement>(
      '.name, .meta, .values, .list-heading',
    )) {
      expect(node.scrollWidth, node.textContent!).toBeLessThanOrEqual(node.clientWidth + 1);
      expect(node.scrollHeight, node.textContent!).toBeLessThanOrEqual(node.clientHeight + 1);
    }
    spacing.remove();
  });

  test('a short landscape window hides the keycap, takes a 36 px clear button and 16 px text', async () => {
    await ready();
    await stage(740, 400);
    const keycap = document.querySelector<HTMLElement>('.search-shortcut')!;
    expect(getComputedStyle(keycap).display).toBe('none');
    expect(getComputedStyle(searchEl()).fontSize).toBe('16px');
    await search().fill('c');
    const clear = document.querySelector<HTMLElement>('.search-clear')!;
    expect(clear.getBoundingClientRect().width).toBe(36);
    expect(clear.getBoundingClientRect().height).toBe(36);
  });

  test('on a phone a focused key is never under the dock (WCAG 2.4.11)', async () => {
    await ready();
    await stage(390, 700);
    const list = document.querySelector<HTMLElement>('.body')!;
    // Without a list that scrolls under a pinned dock, every key would be trivially clear of it.
    expect(list.scrollHeight).toBeGreaterThan(list.clientHeight);
    const dock = document.querySelector<HTMLElement>('.dock')!.getBoundingClientRect();
    expect(dock.bottom).toBeLessThanOrEqual(innerHeight + 0.5);
    const head = document.querySelector<HTMLElement>('.head')!.getBoundingClientRect();
    searchEl().focus();
    let scrolled = 0;
    for (let step = 0; step < 30; step += 1) {
      const before = list.scrollTop;
      await userEvent.tab();
      const box = (document.activeElement as HTMLElement).getBoundingClientRect();
      expect(box.bottom, `key ${step + 1}`).toBeLessThanOrEqual(dock.top + 0.5);
      expect(box.top, `key ${step + 1}`).toBeGreaterThanOrEqual(head.bottom - 0.5);
      // The dock is a sibling, not an overlay; scroll-padding-block-end keeps a key the browser had to
      // scroll to clear of the list's foot too, not flush against the dock.
      if (list.scrollTop > before) {
        scrolled += 1;
        expect(dock.top - box.bottom, `key ${step + 1}`).toBeGreaterThanOrEqual(24);
      }
    }
    expect(scrolled).toBeGreaterThan(0);
  });

  test('fine pointers get 24 px sliders', async () => {
    await ready();
    await page.getByText('Tract display').click();
    for (const slider of document.querySelectorAll<HTMLElement>('input[type="range"]')) {
      expect(slider.getBoundingClientRect().height).toBe(24);
    }
  });

  test('touch emulation raises keys, clear button, summaries, sliders and the checkbox', async () => {
    await ready();
    await page.getByText('Tract display').click();
    await search().fill('c');
    const session = cdp();
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    await session.send('Emulation.setEmulatedMedia', {
      features: [
        { name: 'pointer', value: 'coarse' },
        { name: 'hover', value: 'none' },
      ],
    });
    try {
      expect(matchMedia('(pointer: coarse)').matches).toBe(true);
      await settle();
      const sized = (selector: string) => {
        const nodes = [...document.querySelectorAll<HTMLElement>(selector)].filter((node) =>
          node.checkVisibility(),
        );
        expect(nodes.length, selector).toBeGreaterThan(0);
        for (const node of nodes) {
          expect(node.getBoundingClientRect().height, selector).toBeGreaterThanOrEqual(44);
        }
      };
      sized('section:not([hidden]) input[type="checkbox"]');
      sized('.search-clear');
      sized('summary');
      sized('input[type="range"]');
      sized('.quiet');
      expect(document.querySelector('.check input')!.getBoundingClientRect().height).toBe(20);
    } finally {
      await session.send('Emulation.setTouchEmulationEnabled', { enabled: false });
      await session.send('Emulation.setEmulatedMedia', {
        features: [
          { name: 'pointer', value: '' },
          { name: 'hover', value: '' },
        ],
      });
    }
  });
});
