// The Functions tab in Chromium, against the real S3 controller over the fake engine: the search,
// the list and its keys, the profile, every focus hand-off, the latest-wins run, the failure and
// busy states, and the accessibility checks of decision record #56. The view-model's wording is
// functions-view.test.ts.
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cdp, page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { domainAreas } from '../../lib/core/catalog/neuropsych-domains.ts';
import { currentItem } from '../../lib/core/workspace.ts';
import { withMedia } from '../../lib/ui/a11y-test-support.ts';
import { expectAxeCleanOnce } from '../../lib/ui/axe-state-support.ts';
import '../../app/layout.css';
import { AREAS_SHOWN, TERMS_SHOWN } from './functions-view.ts';
import { createWorld, deferred, type World } from './functions-test-world.ts';
import Fixture from './functions-test-support.svelte';

let world: World;

/** A curated function with more than one page of areas, and one with few. */
const many = () =>
  world.domains.domains.find((d) => domainAreas(world.domains, d.id).length > AREAS_SHOWN)!;
const few = () =>
  world.domains.domains.find((d) => {
    const n = domainAreas(world.domains, d.id).length;
    return n > 0 && n <= AREAS_SHOWN;
  })!;

function mount(lang: 'en' | 'fr' = 'en', explorer = true) {
  world = createWorld();
  if (explorer) world.session.setExplorer('functions');
  world.session.setLang(lang);
  document.documentElement.lang = lang;
  return render(Fixture, { world });
}

beforeEach(async () => {
  await page.viewport(1280, 800);
});
afterEach(() => {
  document.documentElement.lang = 'en';
});

const field = () => page.getByRole('searchbox');
const fieldElement = () => field().element() as HTMLInputElement;
const row = (name: string | RegExp) => page.getByRole('button', { name });
const title = () => document.querySelector<HTMLElement>('[data-function-title]');
const meta = () => document.querySelector<HTMLElement>('.profile .meta')!;
const rowOf = (id: string) => document.querySelector<HTMLElement>(`[data-function="${id}"]`)!;
const area = (index = 0) =>
  document.querySelectorAll<HTMLElement>('[data-function-region]')[index]!;
const restore = () => document.querySelector<HTMLElement>('.restore');
const announcer = () => document.getElementById('announcer')!;

/** Types a query and waits for the list to settle. */
async function search(text: string) {
  await userEvent.click(field());
  await userEvent.keyboard(text);
}

/** Opens a function and waits until its profile has finished loading. */
async function open(id: string) {
  await userEvent.click(rowOf(id));
  await expect.poll(() => meta().textContent).toMatch(/HCP-MMP|Shown on/);
}

describe('the list', () => {
  test('opens with the overview row, then each group of curated functions as a labelled list', async () => {
    mount();
    const list = page.getByRole('group', { name: 'Functions', exact: true });
    await expect.element(list).toBeVisible();
    const overview = document.querySelector('[data-function="all"]')!;
    expect(overview.closest('li')).not.toBeNull();
    const groups = [...document.querySelectorAll('[role="group"][aria-labelledby]')];
    expect(groups.length).toBe(world.domains.groups.length);
    for (const group of groups) {
      const heading = document.getElementById(group.getAttribute('aria-labelledby')!)!;
      expect(heading.tagName).toBe('H3');
      expect(group.querySelectorAll('ul > li > button').length).toBeGreaterThan(0);
    }
    const first = world.domains.domains[0]!;
    // The count column is for the eye; the row's name carries the detail.
    const button = rowOf(first.id);
    expect(button.querySelector('.group-count')!.getAttribute('aria-hidden')).toBe('true');
    expect(button.querySelector('.function-swatch')!.getAttribute('aria-hidden')).toBe('true');
    expect(button.textContent).toMatch(/studies · \d+ areas?/);
    await expect.element(row(new RegExp(`^${first.name} , [\\d,]+ studies? ·`))).toBeVisible();
    expect(document.querySelector('.scope-note')!.hasAttribute('hidden')).toBe(false);
    expect(document.querySelector('.scope-note')!.textContent).toContain(
      `${world.domains.domains.length} functions`,
    );
  });

  test('every group has a heading naming its column of study counts, hidden from assistive technology', async () => {
    mount();
    for (const head of document.querySelectorAll('.column-head')) {
      expect(head.getAttribute('aria-hidden')).toBe('true');
      expect(head.textContent).toBe('Studies');
    }
  });

  test('the search field has a visible label, aria-controls the list and the / hint', async () => {
    mount();
    const label = document.querySelector<HTMLLabelElement>('label.field-label')!;
    expect(label.textContent).toBe('Search functions');
    expect(label.checkVisibility()).toBe(true);
    expect(label.htmlFor).toBe(fieldElement().id);
    expect(fieldElement().getAttribute('aria-controls')).toBe(
      document.querySelector('[role="group"][aria-label="Functions"]')!.id,
    );
    expect(fieldElement().autocomplete).toBe('off');
    expect(document.querySelector('kbd')!.textContent).toBe('/');
    expect(document.querySelector('kbd')!.getAttribute('aria-hidden')).toBe('true');
  });

  test('is French in French, with the searched terms marked as English', async () => {
    mount('fr');
    await expect
      .element(page.getByRole('searchbox', { name: 'Rechercher une fonction' }))
      .toBeVisible();
    await expect.element(page.getByRole('group', { name: 'Fonctions', exact: true })).toBeVisible();
    await search('a');
    const term = document.querySelector('[data-function^="term:"] .row-name')!;
    expect(term.getAttribute('lang')).toBe('en');
    const curated = document.querySelector('[data-function="language"] .row-name')!;
    expect(curated.hasAttribute('lang')).toBe(false);
  });

  test('hands the open row to the workspace through registerCurrentItem', async () => {
    mount();
    expect(currentItem()).toBeNull();
    await open(few().id);
    expect(currentItem()).toBe(rowOf(few().id));
    expect(currentItem()!.getAttribute('aria-current')).toBe('true');
  });

  test('is hidden outside the Functions tab', async () => {
    mount('en', false);
    expect(document.querySelector<HTMLElement>('.browser')!.checkVisibility()).toBe(false);
    expect(document.querySelector<HTMLElement>('.head')!.checkVisibility()).toBe(false);
  });
});

describe('search', () => {
  test('filters curated functions and lists Neurosynth terms, 20 of them and a note for the rest', async () => {
    mount();
    await search('a');
    const terms = document.querySelectorAll('[data-function^="term:"]');
    expect(terms.length).toBe(TERMS_SHOWN);
    await expect
      .element(page.getByText(/more terms match; type more to narrow the list\./))
      .toBeVisible();
    expect(document.querySelector('.scope-note')!.checkVisibility()).toBe(false);
    expect(document.querySelector('[data-function="all"]')).toBeNull();
    const headings = [...document.querySelectorAll('h3')].map((h) => h.textContent!.trim());
    expect(headings.some((h) => h.startsWith('Neurosynth terms'))).toBe(true);
  });

  test('typing never moves focus', async () => {
    mount();
    await search('lang');
    expect(document.activeElement).toBe(fieldElement());
  });

  test('a clinical group is listed apart from the terms that name a function', async () => {
    mount();
    await search('aphasia');
    const headings = [...document.querySelectorAll('h3')].map((h) => h.textContent!.trim());
    expect(headings.some((h) => h.startsWith('Neurosynth clinical groups'))).toBe(true);
  });

  test('nothing found: says so, offers the nearest name, and applying it fills the field and keeps focus there', async () => {
    mount();
    await search('langauge');
    await expect.element(page.getByText('No match for “langauge”')).toBeVisible();
    const suggestion = page.getByRole('button', { name: /Did you mean/ });
    await expect.element(suggestion).toBeVisible();
    const name = /“(.+)”\?/.exec(suggestion.element().textContent!)![1]!;
    await suggestion.click();
    expect(fieldElement().value).toBe(name);
    expect(world.session.state.functionQuery).toBe(name);
    expect(document.activeElement).toBe(fieldElement());
  });

  test('says how many lesion profiles match and carries the query to the Deficits tab', async () => {
    mount();
    await search('aphasia');
    const bridge = page.getByRole('button', { name: /^Deficits: \d+ lesion profiles? match/ });
    await expect.element(bridge).toBeVisible();
    await bridge.click();
    await expect.poll(() => world.session.state.explorer).toBe('deficits');
    expect(world.session.state.clinicalQuery).toBe('aphasia');
    expect(world.session.state.selectedFunction).toBeNull();
  });

  test('the clear button empties the field, hides itself and returns focus to the field', async () => {
    mount();
    await search('lang');
    const clear = page.getByRole('button', { name: 'Clear search' });
    await expect.element(clear).toBeVisible();
    await clear.click();
    expect(fieldElement().value).toBe('');
    expect(document.activeElement).toBe(fieldElement());
    expect(document.querySelector('.search-clear')).toBeNull();
    expect(world.session.state.functionQuery).toBe('');
    expect(document.querySelector('[data-function="all"]')).not.toBeNull();
  });

  test('Escape with text clears it and is handled; Escape on an empty field is left to the page', async () => {
    mount();
    await search('lang');
    const handled = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    fieldElement().dispatchEvent(handled);
    flushSync();
    expect(handled.defaultPrevented).toBe(true);
    expect(fieldElement().value).toBe('');
    expect(document.activeElement).toBe(fieldElement());
    const left = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    fieldElement().dispatchEvent(left);
    expect(left.defaultPrevented).toBe(false);
  });

  test('Escape while an input method is composing is not handled', async () => {
    mount();
    await search('lang');
    const composing = new KeyboardEvent('keydown', {
      key: 'Escape',
      isComposing: true,
      bubbles: true,
      cancelable: true,
    });
    fieldElement().dispatchEvent(composing);
    expect(composing.defaultPrevented).toBe(false);
    expect(fieldElement().value).toBe('lang');
  });

  test('focusSearch focuses the field with its text selected', async () => {
    mount();
    await search('lang');
    document.body.focus();
    world.explorer.focusSearch();
    expect(document.activeElement).toBe(fieldElement());
    expect(fieldElement().selectionStart).toBe(0);
    expect(fieldElement().selectionEnd).toBe(4);
  });
});

describe('keys in the list', () => {
  test('ArrowDown and Enter in the field move to the first row; ArrowUp from it returns', async () => {
    mount();
    await userEvent.click(field());
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(document.querySelector('.function-row'));
    await userEvent.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(fieldElement());
    await userEvent.keyboard('{Enter}');
    expect(document.activeElement).toBe(document.querySelector('.function-row'));
  });

  test('ArrowDown and ArrowUp walk every row, suggestions and bridges included, and stop at the ends', async () => {
    mount();
    await search('aphasia');
    await userEvent.keyboard('{ArrowDown}');
    const stops = [...document.querySelectorAll('.function-row, .search-bridge')];
    expect(stops.at(-1)!.classList.contains('search-bridge')).toBe(true);
    for (const stop of stops.slice(1)) {
      await userEvent.keyboard('{ArrowDown}');
      expect(document.activeElement).toBe(stop);
    }
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(stops.at(-1));
  });

  test('every row stays a Tab stop and the keys leave other keys alone', async () => {
    mount();
    const rows = [...document.querySelectorAll<HTMLElement>('.function-row')];
    expect(rows.every((r) => r.tabIndex === 0)).toBe(true);
    rows[0]!.focus();
    const home = new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true });
    rows[0]!.dispatchEvent(home);
    expect(home.defaultPrevented).toBe(false);
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(rows[1]);
  });

  test('Enter and Space open a function', async () => {
    mount();
    const target = rowOf(few().id);
    target.focus();
    await userEvent.keyboard('{Enter}');
    await expect.poll(() => world.session.state.selectedFunction).toBe(few().id);
    await expect.poll(() => meta().textContent).toMatch(/HCP-MMP/);
    target.focus();
    await userEvent.keyboard(' ');
    await expect.poll(() => document.activeElement).toBe(title());
  });
});

describe('announcing results', () => {
  test('says the count 500 ms after typing pauses, once, and again after the query is cleared', async () => {
    mount();
    await search('lang');
    expect(announcer().textContent).toBe('');
    await expect
      .poll(() => announcer().textContent, { timeout: 2000 })
      .toMatch(/^\d+ functions?( and \d+ Neurosynth terms?)?$/);
    const said = announcer().textContent;
    await userEvent.click(page.getByRole('button', { name: 'Clear search' }));
    announcer().textContent = '';
    await search('lang');
    await expect.poll(() => announcer().textContent, { timeout: 2000 }).toBe(said);
  });

  test('says "No match" for a query that finds nothing', async () => {
    mount();
    await search('zzzzqqq');
    await expect.poll(() => announcer().textContent, { timeout: 2000 }).toBe('No match');
  });

  test('does not say the count again when only the language changes', async () => {
    mount();
    await search('lang');
    await expect.poll(() => announcer().textContent, { timeout: 2000 }).not.toBe('');
    announcer().textContent = '';
    world.session.setLang('fr');
    flushSync();
    await new Promise((resolve) => setTimeout(resolve, 900));
    expect(announcer().textContent).toBe('');
  });
});

describe('opening a function', () => {
  test('the heading takes focus, the row is current, and the meta line says what is shown', async () => {
    mount();
    const target = few();
    const gate = deferred();
    world.hold.reveal = () => gate.promise;
    await userEvent.click(rowOf(target.id));
    expect(document.activeElement).toBe(title());
    expect(title()!.tagName).toBe('H2');
    expect(title()!.textContent!.trim()).toBe(target.name);
    expect(meta().textContent).toBe('Preparing the HCP-MMP areas…');
    gate.resolve();
    world.hold.reveal = null;
    await expect.poll(() => meta().textContent).toMatch(/^\d+ HCP-MMP areas?.* at z ≥ 3$/);
    expect(rowOf(target.id).getAttribute('aria-current')).toBe('true');
    expect(document.querySelectorAll('[aria-current="true"]').length).toBe(1);
    expect(world.session.state.selectedFunction).toBe(target.id);
    expect(world.excursions.restorable).toBe(true);
  });

  test('opens with the profile at the top of the scrolling parent', async () => {
    mount();
    const scroller = document.querySelector<HTMLElement>('.detail')!;
    scroller.style.cssText = 'height: 120px; overflow-y: auto';
    await open(few().id);
    scroller.scrollTop = 80;
    expect(scroller.scrollTop).toBeGreaterThan(0);
    await open(many().id);
    expect(scroller.scrollTop).toBe(0);
  });

  test('one status element stays in the page across profiles and its text is never rewritten identically', async () => {
    mount();
    await open(few().id);
    const status = meta();
    expect(status.getAttribute('role')).toBe('status');
    const writes: string[] = [];
    const watch = new MutationObserver(() => writes.push(status.textContent!));
    watch.observe(status, { childList: true, characterData: true, subtree: true });
    await open(many().id);
    expect(meta()).toBe(status);
    await new Promise((resolve) => setTimeout(resolve, 50));
    watch.disconnect();
    for (let i = 1; i < writes.length; i += 1) expect(writes[i]).not.toBe(writes[i - 1]);
  });

  test('a language switch makes a new status element holding the French count, not a rewrite', async () => {
    mount();
    await open(few().id);
    const english = meta();
    world.session.setLang('fr');
    flushSync();
    expect(meta()).not.toBe(english);
    expect(english.isConnected).toBe(false);
    expect(meta().textContent).toMatch(/^\d+ aires? HCP-MMP/);
  });

  test('re-selecting the open function focuses its heading again', async () => {
    mount();
    await open(few().id);
    rowOf(few().id).focus();
    await userEvent.keyboard('{Enter}');
    await expect.poll(() => document.activeElement).toBe(title());
  });

  test('the overview opens as "All functions" and lists each overview function as a link that opens it', async () => {
    mount();
    await open('all');
    expect(title()!.textContent!.trim()).toBe('All functions');
    expect(meta().textContent).toBe('Shown on the HCP-MMP areas');
    const links = [...document.querySelectorAll<HTMLElement>('.function-link')];
    expect(links.length).toBe(world.domains.domains.filter((d) => d.overview).length);
    expect(document.querySelector('.areas')).toBeNull();
    await userEvent.click(links[0]!);
    await expect.poll(() => world.session.state.selectedFunction).toBe(links[0]!.dataset.function);
    await expect.poll(() => document.activeElement).toBe(title());
  });

  test('a searched term opens with its kind line, its caveat and its areas; the term is English', async () => {
    mount('fr');
    await search('aphasia');
    const target = document.querySelector<HTMLElement>('[data-function^="term:"]')!;
    await userEvent.click(target);
    await expect.poll(() => meta().textContent).toMatch(/HCP-MMP/);
    expect(title()!.getAttribute('lang')).toBe('en');
    const kind = document.querySelector('.kind')!;
    expect(kind.querySelector('span')!.getAttribute('lang')).toBe('en');
    expect(document.querySelector('.caveat')!.textContent).toMatch(/Neurosynth|groupe|terme/);
  });

  test('a curated function lists its lesion checks as buttons that open the deficit', async () => {
    mount();
    const target = world.domains.domains.find(
      (d) => (world.domains.lesion_checks as Record<string, unknown[]>)[d.id]!.length > 0,
    )!;
    await open(target.id);
    const check = document.querySelector<HTMLElement>('[data-deficit]')!;
    await userEvent.click(check);
    expect(world.openDeficit).toHaveBeenCalledWith(check.dataset.deficit);
  });

  test('a function whose checks repeat a deficit lists every check: language has six on aphasia', async () => {
    mount();
    await open('language');
    const checks = [...document.querySelectorAll<HTMLElement>('[data-deficit]')];
    expect(checks).toHaveLength(6);
    expect(checks.filter((check) => check.dataset.deficit === 'aphasia').length).toBeGreaterThan(1);
  });

  test('a population term with matching lesion profiles bridges to the Deficits tab', async () => {
    mount();
    await search('aphasia');
    await userEvent.click(rowOf('term:aphasia'));
    await expect.poll(() => meta().textContent).toMatch(/HCP-MMP/);
    const bridge = document.querySelector<HTMLElement>('.bridge .search-bridge')!;
    expect(bridge.textContent).toMatch(/Deficits: \d+ lesion profiles? match(es)? “aphasia”/);
    await userEvent.click(bridge);
    expect(world.session.state.clinicalQuery).toBe('aphasia');
  });

  test('the profile is not a landmark and its sections are plain', async () => {
    mount();
    await open(many().id);
    expect(document.querySelector('.profile section, .profile [role="region"]')).toBeNull();
    expect(document.querySelector('aside')).toBeNull();
    const headings = [...document.querySelectorAll('.profile h3')].map((h) =>
      h.textContent!.trim(),
    );
    expect(headings).toContain('Deficits that check this map');
  });
});

describe('areas', () => {
  test('lists the first twelve, the rest under a native disclosure, strongest first', async () => {
    mount();
    await open(many().id);
    const all = domainAreas(world.domains, many().id);
    expect(document.querySelectorAll('.profile .areas > li').length).toBe(all.length);
    const details = document.querySelector<HTMLDetailsElement>('details')!;
    expect(details.open).toBe(false);
    expect(details.querySelector('summary')!.textContent).toBe(
      `${all.length - AREAS_SHOWN} more areas`,
    );
    expect(details.querySelectorAll('li').length).toBe(all.length - AREAS_SHOWN);
    await userEvent.click(page.getByText(/more areas$/));
    expect(details.open).toBe(true);
  });

  test('the disclosure closes again on another function', async () => {
    mount();
    await open(many().id);
    await userEvent.click(page.getByText(/more areas$/));
    const second = world.domains.domains.filter(
      (d) => domainAreas(world.domains, d.id).length > AREAS_SHOWN,
    )[1]!;
    await open(second.id);
    expect(document.querySelector<HTMLDetailsElement>('details')!.open).toBe(false);
  });

  test('an area button is named by what it shows: name, side, division, z', async () => {
    mount();
    await open(many().id);
    const button = area();
    const name = button.textContent!.replace(/\s+/g, ' ').trim();
    expect(button.hasAttribute('aria-label')).toBe(false);
    const visible = [...button.querySelectorAll('span:not(.visually-hidden)')]
      .filter((s) => !s.querySelector('span'))
      .map((s) => s.textContent!.trim());
    // name · side, division, z 3.2: the visible text, in order, with the separators and "z" hidden.
    expect(name).toMatch(/^.+ · [LR]\w*,? .*z [\d.]+$/);
    await expect
      .element(
        page
          .getByRole('button', {
            name: new RegExp(`^${visible[0]!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
          })
          .first(),
      )
      .toBeVisible();
  });

  test('opening an area draws it and moves focus to the region name; on failure focus stays on the button', async () => {
    mount();
    await open(few().id);
    const button = area();
    const panel = document.querySelector<HTMLElement>('.detail')!;
    // Room below the name, so it can reach the top.
    panel.append(Object.assign(document.createElement('div'), { style: 'height: 2000px' }));
    panel.style.cssText = 'height: 200px; overflow-y: auto';
    button.focus();
    await userEvent.keyboard('{Enter}');
    await expect.poll(() => document.activeElement?.id).toBe('selected-name');
    expect(meta().getAttribute('data-error')).toBe('false');
    // The name is at the top of the scrolling panel, as legacy brought it.
    const scroller = document.querySelector<HTMLElement>('.detail')!;
    expect(
      document.getElementById('selected-name')!.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top,
    ).toBeLessThanOrEqual(2);

    await open(few().id);
    const failing = deferred();
    world.hold.reveal = () => failing.promise;
    const again = area();
    again.focus();
    await userEvent.keyboard('{Enter}');
    failing.reject(new Error('download failed'));
    await expect.poll(() => meta().getAttribute('data-error')).toBe('true');
    expect(meta().textContent).toBe('Could not show the region.');
    expect(document.activeElement).toBe(again);
    world.hold.reveal = null;
  });

  test('while a run is in flight an area stays focusable, says it is unavailable and does nothing', async () => {
    mount();
    await open(few().id);
    const gate = deferred();
    world.hold.reveal = () => gate.promise;
    const opened = vi.spyOn(world.excursions, 'openListedRegion');
    const first = area(0);
    first.focus();
    await userEvent.keyboard('{Enter}');
    expect(meta().textContent).toBe('Preparing the HCP-MMP areas…');
    expect(first.getAttribute('aria-disabled')).toBe('true');
    expect(first.hasAttribute('disabled')).toBe(false);
    expect(document.activeElement).toBe(first);
    await userEvent.keyboard('{Enter}');
    area(1).click();
    expect(opened).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(first);
    gate.resolve();
    await expect.poll(() => area(0).getAttribute('aria-disabled')).toBeNull();
    world.hold.reveal = null;
  });
});

describe('runs: latest wins, failures are worded and offer a reload', () => {
  test('a later choice overtakes an earlier one: only the latest speaks', async () => {
    mount();
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const slow = deferred();
    world.hold.reveal = () => slow.promise;
    const [a, b] = [world.domains.domains[0]!, world.domains.domains[1]!];
    const earlier = world.explorer.openFunction(a.id);
    world.hold.reveal = null;
    await world.explorer.openFunction(b.id);
    await expect.poll(() => meta().textContent).toMatch(/HCP-MMP/);
    // The earlier run fails after the later one succeeded: it is logged, and it says nothing.
    slow.reject(new Error('late failure'));
    expect(await earlier).toBe(false);
    expect(error).toHaveBeenCalled();
    expect(world.session.state.selectedFunction).toBe(b.id);
    expect(meta().textContent).toMatch(/HCP-MMP/);
    expect(meta().getAttribute('data-error')).toBe('false');
    expect(world.explorer.opening).toBe(false);
    error.mockRestore();
  });

  test('a failure says the areas could not be shown, logs it, and a newer-deploy failure raises the Reload notice', async () => {
    mount();
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    world.hold.reveal = () =>
      Promise.reject(Object.assign(new Error('moved'), { code: 'asset-updated' }));
    await userEvent.click(rowOf(few().id));
    await expect.poll(() => meta().textContent).toBe('The HCP-MMP areas could not be shown.');
    expect(meta().getAttribute('data-error')).toBe('true');
    expect(error).toHaveBeenCalled();
    expect(world.session.state.notice?.action).toBe('reload');
    // The profile is still there to read, and the next function clears the failure.
    expect(document.activeElement).toBe(title());
    world.hold.reveal = null;
    await open(world.domains.domains[1]!.id);
    expect(meta().getAttribute('data-error')).toBe('false');
    error.mockRestore();
  });
});

describe('Restore', () => {
  test('is offered once a function is open, and puts the previous view back with focus on the function row', async () => {
    mount();
    expect(restore()).toBeNull();
    await open(few().id);
    expect(restore()!.textContent!.trim()).toBe('Restore previous view');
    restore()!.focus();
    await userEvent.keyboard('{Enter}');
    await expect.poll(() => world.session.state.selectedFunction).toBeNull();
    await expect.poll(() => document.activeElement).toBe(rowOf(few().id));
    expect(restore()).toBeNull();
    expect(world.session.state.notice?.text).toBe('Previous view restored.');
  });

  test('focus goes to the field when the row has gone', async () => {
    mount();
    await open(few().id);
    await search('zzzqqq');
    await userEvent.click(restore()!);
    await expect.poll(() => document.activeElement).toBe(fieldElement());
  });

  test('stays in the page and keeps focus while it runs and when it fails', async () => {
    mount();
    await open(few().id);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    world.reader.apply.mockImplementationOnce(async () => [{ error: new Error('cut') } as never]);
    const button = restore()!;
    button.focus();
    await userEvent.keyboard('{Enter}');
    await expect
      .poll(() => meta().textContent)
      .toBe('The previous view could not be fully restored.');
    expect(restore()).toBe(button);
    expect(document.activeElement).toBe(button);
    expect(button.getAttribute('aria-disabled')).toBeNull();
    // A second try, with the reader working, succeeds.
    await userEvent.keyboard('{Enter}');
    await expect.poll(() => world.session.state.selectedFunction).toBeNull();
    error.mockRestore();
  });

  test('says it is unavailable while another run is in flight', async () => {
    mount();
    await open(few().id);
    const gate = deferred();
    world.hold.reveal = () => gate.promise;
    area().focus();
    await userEvent.keyboard('{Enter}');
    expect(restore()!.getAttribute('aria-disabled')).toBe('true');
    const before = world.reader.apply.mock.calls.length;
    restore()!.click();
    expect(world.reader.apply.mock.calls.length).toBe(before);
    gate.resolve();
    await expect.poll(() => restore()!.getAttribute('aria-disabled')).toBeNull();
    world.hold.reveal = null;
  });

  test('is French in French', async () => {
    mount('fr');
    await open(few().id);
    expect(restore()!.textContent!.trim()).toBe('Rétablir la vue précédente');
  });
});

describe('accessibility', () => {
  // One run per state: the theme and the width each get their own state, and French one more.
  test.each([
    ['the list', 'en', 'light', 1280],
    ['an open profile with its areas', 'en', 'dark', 390],
    ['a search', 'en', 'dark', 1280],
    ['an open profile with its areas', 'fr', 'light', 390],
  ] as const)('axe: %s, %s, %s, %i px', async (state, lang, theme, width) => {
    mount(lang);
    if (state === 'an open profile with its areas') {
      await userEvent.click(rowOf(many().id));
      await expect.poll(() => meta().textContent).toMatch(/HCP-MMP/);
      await userEvent.click(document.querySelector('summary')!);
    } else if (state === 'a search') {
      await search('aphasia');
    }
    await expectAxeCleanOnce(theme, width);
  });

  test('forced colours and more contrast keep the open row, the swatches and the focus ring visible', async () => {
    mount();
    await open(few().id);
    await withMedia([{ name: 'forced-colors', value: 'active' }], async () => {
      const swatch = rowOf(few().id).querySelector<HTMLElement>('.function-swatch')!;
      expect(getComputedStyle(swatch).forcedColorAdjust).toBe('none');
      expect(getComputedStyle(swatch).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
      expect(getComputedStyle(rowOf(few().id)).outlineStyle).toBe('solid');
      fieldElement().focus();
      await userEvent.keyboard('{ArrowDown}');
      expect(getComputedStyle(document.activeElement!).outlineStyle).toBe('solid');
    });
    await withMedia([{ name: 'prefers-contrast', value: 'more' }], async () => {
      await expectAxeCleanOnce('light', 1280);
    });
  });

  test('targets: 24 px or more with a fine pointer', async () => {
    mount();
    await open(many().id);
    await userEvent.click(page.getByText(/more areas$/));
    await search('x');
    const targets = [...document.querySelectorAll<HTMLElement>('button, summary')].filter((b) =>
      b.checkVisibility(),
    );
    expect(targets.length).toBeGreaterThan(3);
    for (const target of targets)
      expect(target.getBoundingClientRect().height, target.outerHTML).toBeGreaterThanOrEqual(24);
  });

  test('targets: 44 px with a coarse pointer, asserted with touch emulation', async () => {
    const session = cdp();
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await page.viewport(390, 844);
    try {
      mount();
      expect(matchMedia('(pointer: coarse)').matches).toBe(true);
      await open(many().id);
      await userEvent.click(page.getByText(/more areas$/));
      const check = (selector: string) => {
        const targets = [...document.querySelectorAll<HTMLElement>(selector)].filter((e) =>
          e.checkVisibility(),
        );
        expect(targets.length, selector).toBeGreaterThan(0);
        for (const target of targets) {
          expect(target.getBoundingClientRect().height, target.outerHTML).toBeGreaterThanOrEqual(
            44,
          );
        }
      };
      check('.function-row');
      check('.function-area');
      check('summary');
      check('.restore');
      await userEvent.click(rowOf(many().id));
      await search('lang');
      check('.search-clear');
      const clear = document.querySelector<HTMLElement>('.search-clear')!.getBoundingClientRect();
      expect(clear.width).toBeGreaterThanOrEqual(44);
    } finally {
      await session.send('Emulation.setTouchEmulationEnabled', { enabled: false });
      await page.viewport(1280, 800);
    }
  });

  test('200 % text with the WCAG 1.4.12 spacing: names wrap, nothing is clipped or overflows', async () => {
    mount();
    await open(many().id);
    await userEvent.click(page.getByText(/more areas$/));
    const style = document.head.appendChild(document.createElement('style'));
    style.textContent = `html { font-size: 200%; }
      * { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }
      p { margin-bottom: 2em !important; }`;
    document.body.style.width = '320px';
    try {
      for (const element of document.querySelectorAll<HTMLElement>(
        'button, summary, h2, h3, p, label',
      )) {
        if (!element.checkVisibility()) continue;
        expect(element.scrollWidth, element.outerHTML).toBeLessThanOrEqual(element.clientWidth + 1);
        // A name that grows is taller, never cut: no fixed height on any control.
        if (element.matches('button, summary')) {
          expect(element.scrollHeight, element.outerHTML).toBeLessThanOrEqual(
            element.clientHeight + 1,
          );
        }
      }
      const root = document.documentElement;
      expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth + 1);
    } finally {
      style.remove();
      document.body.style.width = '';
    }
  });
});
