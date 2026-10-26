// The Deficits panels in Chromium: the list and its search, the profile, the region hand-offs, Restore
// and the related list, over the real catalogs. Decision record on #57; every difference from legacy
// cites docs/decisions/deviations/x2-*.md.
import { beforeEach, describe, expect, test } from 'vitest';
import { cdp, page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import manifest from '../../../../public/models/cdmd/manifest.json';
import { expectAxeClean, withMedia } from '../../lib/ui/a11y-test-support.ts';
import type { Manifest } from '../../lib/types/index.ts';
import '../../app/layout.css';
import Harness, { type Fixture } from './deficits-test-support.svelte';

type Props = Omit<Parameters<typeof Harness>[1], 'manifest' | 'onready'>;

async function mount(props: Props = {}): Promise<Fixture> {
  let fixture!: Fixture;
  render(Harness, {
    manifest: manifest as unknown as Manifest,
    onready: (ready: Fixture) => (fixture = ready),
    ...props,
  } as never);
  await expect.poll(() => fixture).toBeDefined();
  return fixture;
}

beforeEach(() => page.viewport(1280, 800));

const field = () => document.querySelector('input[type="search"]') as HTMLInputElement;
const rows = () => [...document.querySelectorAll<HTMLElement>('[data-testid="list"] .row')];
const row = (id: string) =>
  document.querySelector<HTMLElement>(`[data-deficit="${id}"] .row`) as HTMLElement;
const heading = () => document.querySelector('h2.clinical-profile-name') as HTMLElement;
const meta = () => document.querySelector('.clinical-profile [role="status"]') as HTMLElement;
const announced = () => document.querySelector('.visually-hidden[role="status"]')!.textContent;
const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('the list', () => {
  test('groups the deficits under headings, each group named by its heading, and states its scope', async () => {
    await mount();
    const groups = document.querySelectorAll('[data-testid="list"] [role="group"][aria-labelledby]');
    expect(groups.length).toBeGreaterThan(3);
    for (const group of groups) {
      const label = document.getElementById(group.getAttribute('aria-labelledby')!)!;
      expect(label.tagName).toBe('H3');
    }
    expect(rows()).toHaveLength(40);
    expect(document.querySelector('.scope-note')!.textContent).toContain(
      '40 profiles · adult acquired deficits',
    );
    expect(document.querySelector('[role="group"][aria-label="Deficits"]')).not.toBeNull();
    await expect.element(page.getByRole('searchbox', { name: /search deficits/i })).toBeVisible();
  });

  test('typing filters the list, drops the scope note and says the count once typing pauses', async () => {
    await mount();
    await userEvent.fill(field(), 'aphas');
    await expect.poll(() => rows().length).toBe(1);
    expect(document.querySelector('.scope-note')).toBeNull();
    expect(announced()).toBe('');
    await expect.poll(announced, { timeout: 2000 }).toBe('1 deficit');
  });

  test('Escape clears a filled field and keeps focus; the cleared list says its count (x2-results-announcement)', async () => {
    const { calls } = await mount();
    field().focus();
    await userEvent.keyboard('aphas');
    await expect.poll(announced, { timeout: 2000 }).toBe('1 deficit');
    await userEvent.keyboard('{Escape}');
    expect(field().value).toBe('');
    expect(document.activeElement).toBe(field());
    expect(calls.at(-1)).toBe('query:');
    await expect.poll(announced, { timeout: 2000 }).toBe('40 deficits');
  });

  test('an equal sentence for a different query is said again', async () => {
    await mount();
    field().focus();
    await userEvent.keyboard('aphas');
    await expect.poll(announced, { timeout: 2000 }).toBe('1 deficit');
    await userEvent.fill(field(), 'amnesi');
    await expect.poll(() => rows().length).toBe(1);
    // The live region was cleared and written again, so it is spoken again.
    await expect.poll(announced, { timeout: 2000 }).toBe('1 deficit');
  });

  test('Escape on an empty field is left to the page', async () => {
    await mount();
    field().focus();
    const events: boolean[] = [];
    window.addEventListener('keydown', (event) => events.push(event.defaultPrevented), {
      once: true,
    });
    await userEvent.keyboard('{Escape}');
    expect(events).toEqual([false]);
  });

  test('Down from the field and Enter reach the first row; Up from the first row returns; rows stay Tab stops', async () => {
    await mount();
    field().focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(rows()[0]);
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(rows()[1]);
    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    expect(document.activeElement).toBe(field());
    await userEvent.keyboard('{Enter}');
    expect(document.activeElement).toBe(rows()[0]);
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(rows()[1]);
    expect(rows().every((button) => button.tabIndex === 0)).toBe(true);
  });

  test('one clear control: the custom button, with the native cancel hidden (D9)', async () => {
    await mount();
    expect(document.querySelector('.search-clear, .clear')).toBeNull();
    await userEvent.fill(field(), 'aphas');
    const clear = page.getByRole('button', { name: 'Clear search' });
    await expect.element(clear).toBeVisible();
    const hidden = [...document.styleSheets]
      .flatMap((sheet) => [...sheet.cssRules])
      .flatMap((rule) => (rule instanceof CSSLayerBlockRule ? [...rule.cssRules] : [rule]))
      .some(
        (rule) =>
          rule instanceof CSSStyleRule &&
          rule.selectorText.includes('::-webkit-search-cancel-button') &&
          rule.style.display === 'none',
      );
    expect(hidden).toBe(true);
    await clear.click();
    expect(field().value).toBe('');
    expect(document.activeElement).toBe(field());
  });

  test('no match: a title, a hint, and a suggestion that fills the field and keeps focus there', async () => {
    const { calls } = await mount();
    await userEvent.fill(field(), 'aphazia');
    await expect.poll(() => rows().length).toBe(0);
    expect(document.querySelector('.empty-title')!.textContent).toBe('No match for “aphazia”');
    expect(document.querySelector('.empty')!.textContent).toContain('Try another term');
    await expect.poll(announced, { timeout: 2000 }).toBe('No match');
    await page.getByRole('button', { name: /Did you mean/ }).click();
    expect(calls.at(-1)).toMatch(/^query:./);
    expect(document.activeElement).toBe(field());
  });

  test('a query other activation maps match offers the Functions tab', async () => {
    const { calls } = await mount({ functionMatches: 3 });
    await userEvent.fill(field(), 'memory');
    await page.getByRole('button', { name: /Functions: 3 activation maps match “memory”/ }).click();
    expect(calls.at(-1)).toBe('search-functions:memory');
  });

  test('the bridge and the suggestion are reached by the arrow keys with the rows', async () => {
    await mount({ functionMatches: 1 });
    await userEvent.fill(field(), 'memory');
    const bridge = page.getByRole('button', { name: /Functions: 1 activation map matches/ });
    await expect.element(bridge).toBeVisible();
    field().focus();
    await userEvent.keyboard('{ArrowDown}');
    const stops = [
      ...document.querySelectorAll<HTMLElement>('[data-testid="list"] .row, .search-bridge'),
    ];
    for (const stop of stops.slice(1)) {
      await userEvent.keyboard('{ArrowDown}');
      expect(document.activeElement).toBe(stop);
    }
    expect(document.activeElement!.classList.contains('search-bridge')).toBe(true);
  });

  test('registers the open deficit as the workspace’s current item', async () => {
    const { finders, view } = await mount();
    expect(finders.size).toBe(1);
    const find = [...finders][0];
    expect(find()).toBeNull();
    view.selectedDeficit = 'aphasia';
    await expect.poll(() => find()).toBe(row('aphasia'));
    expect(row('aphasia').getAttribute('aria-current')).toBe('true');
  });
});

describe('opening a deficit', () => {
  test('the heading takes focus once the profile for that deficit is in the page (x2-focus-after-render)', async () => {
    const { calls } = await mount();
    await row('aphasia').click();
    expect(calls).toContain('deficit:aphasia');
    await expect.poll(() => document.activeElement).toBe(heading());
    expect(heading().textContent!.trim()).toBe('Aphasia');
    expect(heading().tabIndex).toBe(-1);
    expect(row('aphasia').getAttribute('aria-current')).toBe('true');
    // Another deficit: focus goes to its heading, not the previous one's.
    await row('amnesia').click();
    await expect.poll(() => heading().textContent!.trim()).toBe('Amnesia');
    expect(document.activeElement).toBe(heading());
  });

  test('the profile starts at its top', async () => {
    await mount();
    const rail = document.querySelector<HTMLElement>('[data-testid="detail"]')!;
    await row('neglect').click();
    await expect.poll(() => rail.scrollHeight).toBeGreaterThan(rail.clientHeight);
    rail.scrollTop = 200;
    await row('aphasia').click();
    await expect.poll(() => rail.scrollTop).toBe(0);
  });

  test('the meta line says what is opening, then the side and what the stage shows', async () => {
    let release!: (value: boolean) => void;
    const { view } = await mount({
      hold: { id: 'aphasia', release: new Promise((resolve) => (release = resolve)) },
    });
    await row('aphasia').click();
    await expect.poll(() => meta().textContent).toBe('Opening anatomy…');
    release(true);
    await expect.poll(() => meta().textContent).toBe('Left hemisphere · 7 regions visible');
    expect(meta().getAttribute('role')).toBe('status');
    // The same mounted region is updated in place: it is the one the first text went into.
    view.hemisphere = 'right';
    await expect.poll(() => meta().textContent).toBe('Left hemisphere · 0 of 7 regions visible');
    view.hemisphere = 'left';
  });

  test('the meta line counts what is painted, in the paint’s own words', async () => {
    const { view } = await mount();
    view.paint = {
      id: 'deficit:aphasia',
      colors: new Map([['destrieux:left:38', [1, 2, 3]]]),
    } as never;
    await row('aphasia').click();
    await expect.poll(() => meta().textContent).toBe('Left hemisphere · 1 region coloured');
  });

  test('a later open overtakes an earlier one: only the latest reports', async () => {
    let release!: (value: boolean) => void;
    await mount({ hold: { id: 'aphasia', release: new Promise((resolve) => (release = resolve)) } });
    await row('aphasia').click();
    await row('amnesia').click();
    await expect.poll(() => heading().textContent!.trim()).toBe('Amnesia');
    release(false);
    await settle(50);
    expect(heading().textContent!.trim()).toBe('Amnesia');
    expect(meta().textContent).not.toBe('Opening anatomy…');
  });

  test('entry point: openDeficit(id) opens, scrolls, focuses the heading and awaits the preparation', async () => {
    const { explorer, calls } = await mount();
    await explorer.openDeficit('amnesia');
    expect(calls).toEqual(['deficit:amnesia']);
    expect(document.activeElement).toBe(heading());
  });

  test('associations: a title with its swatch, the full side to a screen reader, region buttons named with their side', async () => {
    await mount();
    await row('neglect').click();
    const articles = document.querySelectorAll('article.association');
    expect(articles.length).toBeGreaterThan(1);
    const title = articles[0].querySelector('h4')!;
    expect(title.querySelector('.network-swatch')!.getAttribute('aria-hidden')).toBe('true');
    // Every finding is right-sided, so the profile states it once and the rows drop it.
    expect(meta().textContent).toMatch(/^Right hemisphere · /);
    expect(title.querySelector('.side')).toBeNull();
    expect(title.querySelector('.visually-hidden')!.textContent).toBe(' · Right hemisphere');
    const region = articles[0].querySelector<HTMLElement>('button.region')!;
    expect(region.getAttribute('aria-label')).toMatch(/^Open region: .+ · Right$/);
    expect(region.textContent!.trim()).not.toContain('Right');
    expect(page.getByRole('heading', { level: 3, name: 'Associations' }).elements()).toHaveLength(1);
  });

  test('Checked maps open the Functions explorer with that map', async () => {
    const { calls } = await mount();
    await row('aphasia').click();
    await page.getByRole('button', { name: 'Language' }).click();
    expect(calls.at(-1)).toBe('function:language');
  });

  test('no inner landmarks: sections carry no accessible name of their own (x2-section-landmarks)', async () => {
    await mount();
    await row('aphasia').click();
    expect(document.querySelectorAll('.clinical-profile section[aria-labelledby]')).toHaveLength(0);
    expect(document.querySelectorAll('.clinical-profile section[aria-label]')).toHaveLength(0);
  });
});

describe('evidence', () => {
  test('each summary is named by its association and its visible label is contained in the name (x2-evidence-summary-name)', async () => {
    await mount();
    await row('neglect').click();
    const summaries = [...document.querySelectorAll<HTMLElement>('summary')];
    expect(summaries.length).toBeGreaterThan(1);
    const names = summaries.map((summary) => summary.textContent!.trim());
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^Evidence, /);
    // WCAG 2.5.3: the visible words begin the name.
    expect(summaries[0].firstChild!.textContent).toBe('Evidence');
  });

  test('a toggled disclosure stays open across a language change and closes for another deficit', async () => {
    const { view } = await mount();
    await row('neglect').click();
    const first = document.querySelector<HTMLDetailsElement>('details')!;
    first.querySelector('summary')!.click();
    await expect.poll(() => first.open).toBe(true);
    view.lang = 'fr';
    await expect.poll(() => heading().textContent!.trim()).toBe('Négligence spatiale');
    expect(document.querySelector<HTMLDetailsElement>('details')!.open).toBe(true);
    expect(document.querySelector('summary')!.textContent).toMatch(/^Données probantes, /);
    await row('aphasia').click();
    await expect.poll(() => heading().textContent!.trim()).toMatch(/Aphasie/);
    expect(document.querySelector<HTMLDetailsElement>('details')!.open).toBe(false);
  });

  test('publications link out with the new tab said in words, and English titles are marked in French', async () => {
    const { view } = await mount();
    await row('aphasia').click();
    document.querySelector<HTMLElement>('summary')!.click();
    const link = document.querySelector<HTMLAnchorElement>('article.publication a')!;
    expect(link.target).toBe('_blank');
    expect(link.href).toMatch(/^https:\/\/doi\.org\//);
    expect(link.textContent).toContain('(opens in a new tab)');
    expect(link.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
    expect(link.querySelector('[lang]')).toBeNull();
    view.lang = 'fr';
    await expect.poll(() => link.textContent).toContain('(s’ouvre dans un nouvel onglet)');
    expect(link.querySelector('[lang="en"]')).not.toBeNull();
    expect(document.querySelector('article.publication p.note')!.getAttribute('lang')).toBe(null);
    expect(document.querySelectorAll('article.publication p.note[lang="en"]').length).toBeGreaterThan(0);
  });
});

describe('opening a region from the profile', () => {
  test('the region’s name takes focus, scrolled to the top of its view', async () => {
    const { calls } = await mount();
    await row('aphasia').click();
    await page.getByRole('button', { name: /^Open region: Middle temporal gyrus/ }).first().click();
    expect(calls.at(-1)).toBe('region:destrieux:left:38');
    await expect.poll(() => document.activeElement?.id).toBe('region-title');
  });

  test('while a deficit opens, region buttons keep focus and say they are unavailable (x2-aria-disabled-while-opening)', async () => {
    let release!: (value: boolean) => void;
    const { calls } = await mount({
      hold: { id: 'amnesia', release: new Promise((resolve) => (release = resolve)) },
    });
    await row('aphasia').click();
    await expect.poll(() => document.activeElement).toBe(heading());
    await row('amnesia').click();
    await expect.poll(() => document.querySelector('button.region')!.getAttribute('aria-disabled')).toBe('true');
    const disabled = document.querySelector<HTMLButtonElement>('button.region')!;
    expect(disabled.disabled).toBe(false);
    disabled.focus();
    expect(document.activeElement).toBe(disabled);
    disabled.click();
    expect(calls.filter((call) => call.startsWith('region:'))).toEqual([]);
    release(true);
    await expect.poll(() => document.querySelector('button.region')!.hasAttribute('aria-disabled')).toBe(false);
  });

  test('a failure is worded for the reader on the meta line and heard by offerReload; focus stays put', async () => {
    const { calls } = await mount({ failWith: new Error('Unknown clinical region: x') });
    await row('aphasia').click();
    await expect.poll(() => document.activeElement).toBe(heading());
    const button = document.querySelector<HTMLButtonElement>('button.region')!;
    button.focus();
    button.click();
    await expect.poll(() => calls.some((call) => call.startsWith('failure:'))).toBe(true);
    await expect.poll(() => meta().textContent).toMatch(/Could not/);
    expect(meta().textContent).not.toContain('Unknown clinical region');
    expect(meta().className).toContain('error');
    expect(document.activeElement).toBe(button);
  });
});

describe('Restore previous view', () => {
  test('is offered while a deficit is open and focuses the row of the deficit just left', async () => {
    const { calls } = await mount();
    expect(document.querySelector('.clinical-restore')).toBeNull();
    await row('aphasia').click();
    const restore = page.getByRole('button', { name: 'Restore previous view' });
    await restore.click();
    expect(calls.at(-1)).toBe('restore');
    await expect.poll(() => document.activeElement).toBe(row('aphasia'));
  });

  test('is not offered when no earlier scene is held', async () => {
    await mount({ restorable: false });
    await row('aphasia').click();
    expect(document.querySelector('.clinical-restore')).toBeNull();
  });
});

describe('related deficits', () => {
  test('a region lists the deficits mapped on it, and one opens the profile', async () => {
    const { view, calls } = await mount();
    view.explorer = 'anatomy';
    view.selectedRegion = (manifest as unknown as Manifest).regions.find(
      (region) => region.id === 'destrieux:left:38',
    )!;
    const section = document.querySelector<HTMLElement>('section.related')!;
    await expect.poll(() => section.hidden).toBe(false);
    expect(section.querySelector('h3')!.textContent).toBe('Neuropsychology');
    expect(section.getAttribute('aria-labelledby')).toBeNull();
    await page
      .getByTestId('detail')
      .getByRole('button', { name: /Aphasia/ })
      .click();
    expect(calls.at(-1)).toBe('deficit:aphasia');
    await expect.poll(() => document.activeElement).toBe(heading());
  });

  test('a region with no deficit has no section', async () => {
    const { view } = await mount();
    view.selectedRegion = (manifest as unknown as Manifest).regions.find(
      (region) => region.id === 'destrieux:left:-1',
    )!;
    await expect.poll(() => document.querySelector<HTMLElement>('section.related')!.hidden).toBe(true);
  });
});

describe('quality', () => {
  async function opened() {
    const fixture = await mount();
    await row('neglect').click();
    for (const summary of document.querySelectorAll<HTMLElement>('summary')) summary.click();
    return fixture;
  }

  test('axe: the list, the profile with its evidence open, and the French list', async () => {
    const { view } = await opened();
    await expectAxeClean();
    view.lang = 'fr';
    await page.getByRole('searchbox').fill('mém');
    await expectAxeClean();
  });

  test('200 % text: nothing overflows its column', async () => {
    await opened();
    document.documentElement.style.fontSize = '200%';
    try {
      await settle(100);
      for (const rail of document.querySelectorAll<HTMLElement>('.rail')) {
        expect(rail.scrollWidth, 'horizontal overflow').toBeLessThanOrEqual(rail.clientWidth);
      }
    } finally {
      document.documentElement.style.fontSize = '';
    }
  });

  test('text spacing (WCAG 1.4.12): no horizontal overflow and no clipped control', async () => {
    await opened();
    const style = document.head.appendChild(document.createElement('style'));
    style.textContent = `*{line-height:1.5 !important;letter-spacing:.12em !important;word-spacing:.16em !important}
      p{margin-bottom:2em !important}`;
    try {
      await settle(100);
      for (const rail of document.querySelectorAll<HTMLElement>('.rail')) {
        expect(rail.scrollWidth).toBeLessThanOrEqual(rail.clientWidth);
      }
      for (const control of document.querySelectorAll<HTMLElement>('button, summary, input')) {
        expect(control.scrollHeight, control.outerHTML.slice(0, 80)).toBeLessThanOrEqual(
          control.clientHeight + 1,
        );
      }
    } finally {
      style.remove();
    }
  });

  test('coarse pointer: every target is 44 px tall', async () => {
    await opened();
    await userEvent.fill(field(), 'a');
    const session = cdp();
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    try {
      expect(matchMedia('(pointer: coarse)').matches).toBe(true);
      await settle(100);
      const targets = document.querySelectorAll<HTMLElement>(
        'button, summary, input[type="search"], a',
      );
      expect(targets.length).toBeGreaterThan(10);
      for (const target of targets) {
        // The location bar is H5's: it sizes its own trailing button.
        if (target.closest('[hidden], .trailing')) continue;
        expect(
          target.getBoundingClientRect().height,
          target.outerHTML.slice(0, 100),
        ).toBeGreaterThanOrEqual(43.5);
      }
    } finally {
      await session.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    }
  });

  test('forced colours: the evidence chevron, the focused heading and Restore keep their marks', async () => {
    await opened();
    await withMedia([{ name: 'forced-colors', value: 'active' }], async () => {
      const restore = document.querySelector<HTMLElement>('.clinical-restore')!;
      expect(getComputedStyle(restore).textDecorationLine).toBe('underline');
      // A key press makes the next programmatic focus a focus-visible one.
      await userEvent.keyboard('{Shift}');
      heading().focus();
      expect(heading().matches(':focus-visible')).toBe(true);
      expect(getComputedStyle(heading()).outlineStyle).not.toBe('none');
    });
  });

  test('a focused row is never under its sticky group heading (WCAG 2.4.11)', async () => {
    await mount();
    const rail = document.querySelector<HTMLElement>('[data-testid="list"]')!;
    field().focus();
    await userEvent.keyboard('{ArrowDown}');
    for (let step = 0; step < rows().length - 1; step += 1) {
      await userEvent.keyboard('{ArrowDown}');
      const focused = document.activeElement as HTMLElement;
      const group = focused.closest('[role="group"][aria-labelledby]')!;
      const sticky = group.querySelector('h3')!.getBoundingClientRect();
      const box = focused.getBoundingClientRect();
      const frame = rail.getBoundingClientRect();
      expect(box.top, focused.textContent!).toBeGreaterThanOrEqual(Math.min(sticky.bottom, frame.top + 1) - 1);
      expect(box.bottom).toBeLessThanOrEqual(frame.bottom + 1);
    }
  });
});

// The CDP session keeps its emulation after a test; withMedia restores it, this keeps a stray one from leaking.
beforeEach(async () => {
  await cdp().send('Emulation.setEmulatedMedia', { features: [] });
});
