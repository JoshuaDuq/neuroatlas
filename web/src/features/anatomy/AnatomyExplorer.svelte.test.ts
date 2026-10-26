// The anatomy explorer in Chromium: the search over a real catalog against the APG combobox table,
// the legacy navigator cases (navigator.js:390-461, 704-815; search-escape.test.js) and the A2
// decision record on #52, as behaviour.
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { cdp, page, userEvent } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-svelte';
import { expectAxeClean, withMedia } from '../../lib/ui/a11y-test-support.ts';
import Fixture from './anatomy-explorer-test-support.svelte';

type Props = Parameters<typeof render<typeof Fixture>>[1];

const mount = (props: NonNullable<Props> = {}) => {
  const calls: string[] = [];
  render(Fixture, { calls, ...props });
  return calls;
};
const field = () =>
  page.getByRole('combobox', { name: /^(Search regions|Rechercher des régions)$/ });
const input = () => field().element() as HTMLInputElement;
const grid = () => document.querySelector<HTMLElement>('[role="treegrid"]')!;
const options = () => [...document.querySelectorAll<HTMLElement>('[role="option"]')];
const optionNamed = (name: string | RegExp) => page.getByRole('option', { name });
const armed = () => document.getElementById(input().getAttribute('aria-activedescendant') ?? '');
const announced = () => document.getElementById('announcer')!.textContent;
const visible = (element: Element) => element.checkVisibility();

async function search(text: string) {
  input().focus();
  await userEvent.keyboard(text);
}

beforeEach(async () => {
  await page.viewport(1280, 800);
});
afterEach(() => cleanup());

describe('results', () => {
  test('a query lists its matches as options named name, side and group, arms the first and takes the place of the tree', async () => {
    mount();
    expect(visible(grid())).toBe(true);
    await search('cuneus');
    await expect.element(optionNamed('Cuneus, left, Occipital')).toBeInTheDocument();
    await expect.element(optionNamed('Cuneus, right, Occipital')).toBeInTheDocument();
    expect(input().getAttribute('aria-expanded')).toBe('true');
    expect(armed()?.textContent).toContain('Cuneus, left');
    expect(visible(grid())).toBe(false);
    // Down walks to the other one, and Escape empties the field and brings the tree back.
    await userEvent.keyboard('{ArrowDown}');
    expect(armed()?.textContent).toContain('Cuneus, right');
    await userEvent.keyboard('{Escape}');
    expect(input().value).toBe('');
    expect(visible(grid())).toBe(true);
    expect(document.activeElement).toBe(input());
  });

  test('the match is marked whatever its case and accents, and an alias says why a name that does not contain the query matched', async () => {
    mount({ lang: 'fr' });
    await search('CUNEUS');
    await expect.element(optionNamed(/^Cunéus, gauche/)).toBeInTheDocument();
    expect([...document.querySelectorAll('mark.query-match')].map((m) => m.textContent)).toEqual([
      'Cunéus',
      'Cunéus',
    ]);
    cleanup();

    mount();
    await search('ifg');
    const row = optionNamed('Opercular part of the inferior frontal gyrus, IFG, left, Frontal');
    await expect.element(row).toBeInTheDocument();
    expect(row.element().querySelector('mark.query-match')?.textContent).toBe('IFG');
    expect(row.element().textContent).toContain('(IFG)');
  });

  test('a row that is not on screen says why in its name and is revealed by Enter, not selected', async () => {
    const calls = mount({ settings: { hemisphere: 'right' } });
    await search('cuneus');
    const hidden = optionNamed('Cuneus, left: Hemisphere hidden. Activate to reveal.');
    await expect.element(hidden).toBeInTheDocument();
    // Not a native `title`: the reason is in the name, and U5's one tooltip carries it on hover.
    expect(document.querySelectorAll('[role="listbox"] [title]')).toHaveLength(0);
    expect(hidden.element().querySelector('[data-tooltip]')?.getAttribute('data-tooltip')).toBe(
      'Cuneus, left: Hemisphere hidden. Activate to reveal.',
    );
    expect(armed()).toBe(hidden.element());
    await userEvent.keyboard('{Enter}');
    expect(calls).toEqual(['reveal hemisphere d:left:cuneus']);
    expect(input().value).toBe('');
  });

  test('a row too small for the cut is disabled: named as not shown, skipped by the arrows, and does nothing', async () => {
    const calls = mount();
    // "nucleus" is both a cut-only region that can be shown and one that cannot.
    await search('nucleus');
    const tiny = optionNamed('Tiny nucleus, left, not shown: Too small for the cut.');
    await expect.element(tiny).toBeInTheDocument();
    expect(tiny.element().getAttribute('aria-disabled')).toBe('true');
    // The armed one is the other, which a section can show.
    expect(armed()).not.toBe(tiny.element());
    await userEvent.keyboard('{ArrowDown}{ArrowUp}');
    expect(armed()).not.toBe(tiny.element());
    (tiny.element() as HTMLElement).click();
    expect(calls).toEqual([]);
    expect(input().value).toBe('nucleus');
  });

  test('Enter selects the armed region and empties the query; focus stays in the field', async () => {
    const calls = mount();
    await search('cuneus');
    await expect.element(optionNamed(/^Cuneus, left/)).toBeInTheDocument();
    await userEvent.keyboard('{Enter}');
    expect(calls).toEqual(['select d:left:cuneus']);
    expect(input().value).toBe('');
    expect(visible(grid())).toBe(true);
    expect(document.activeElement).toBe(input());
  });

  test('a click chooses a region and leaves focus in the field rather than on the removed row', async () => {
    const calls = mount();
    await search('cuneus');
    await optionNamed(/^Cuneus, right/).click();
    expect(calls).toEqual(['select d:right:cuneus']);
    expect(visible(grid())).toBe(true);
    expect(document.activeElement).toBe(input());
  });

  test('aria-selected marks the armed option only; the selected region is aria-current', async () => {
    mount({ selected: 'd:right:cuneus' });
    await search('cuneus');
    await expect.element(optionNamed(/^Cuneus, right/)).toBeInTheDocument();
    expect(
      options()
        .filter((option) => option.getAttribute('aria-selected') === 'true')
        .map((option) => option.textContent),
    ).toEqual([armed()!.textContent]);
    expect(armed()!.textContent).toContain('left');
    expect(
      options()
        .filter((option) => option.getAttribute('aria-current') === 'true')
        .map((option) => option.textContent),
    ).toEqual([expect.stringContaining('Cuneus, right')]);
  });
});

describe('the sentences after the list', () => {
  test('nothing found anywhere: the title and a hint, a collapsed field, and both said once', async () => {
    mount();
    // Browsing and an all-blank field show no sentence.
    expect(document.querySelector('.empty, .empty-title')).toBeNull();
    await search(' ');
    expect(document.querySelector('.empty, .empty-title')).toBeNull();
    await userEvent.keyboard('{Backspace}');
    await search('zzzz');
    await expect.element(page.getByText('No match for “zzzz”')).toBeInTheDocument();
    await expect
      .element(page.getByText(/^Try another spelling, an abbreviation or a synonym/))
      .toBeInTheDocument();
    expect(input().getAttribute('aria-expanded')).toBe('false');
    expect(options()).toEqual([]);
    await expect
      .poll(() => announced())
      .toMatch(/^No match for “zzzz”\. Try another spelling, an abbreviation or a synonym/);
  });

  test('the count is said after typing pauses, and only for a list that is complete', async () => {
    mount();
    await search('cuneus');
    await expect.poll(() => announced()).toBe('2 matches.');
  });

  test('matches in another atlas are reported with a button that switches to it, and focus goes back to the field', async () => {
    const calls = mount();
    await search('v1');
    // The only match is HCP-MMP's, and the atlas shown is Destrieux.
    await expect.element(page.getByText('No match for “v1”')).toBeInTheDocument();
    expect(page.getByText(/^Try another spelling/).elements()).toEqual([]);
    await expect
      .element(page.getByText(/^1 match in HCP-MMP1\.0 multimodal atlas/))
      .toBeInTheDocument();
    await expect
      .poll(() => announced())
      .toBe('No match for “v1”. 1 match in HCP-MMP1.0 multimodal atlas.');
    await page.getByRole('button', { name: 'Switch atlas' }).click();
    expect(calls).toEqual(['atlas hcp-mmp']);
    expect(document.activeElement).toBe(input());
    // The atlas is HCP-MMP's now: the match is listed.
    await expect.element(optionNamed(/^V1, left/)).toBeInTheDocument();
  });

  test('matches in another cut atlas have their own button, and a rejection from it is not caught', async () => {
    const calls = mount({ settings: { cutAtlas: 'other' }, rejectCutAtlas: true });
    const rejections: unknown[] = [];
    const record = (event: PromiseRejectionEvent) => {
      event.preventDefault();
      rejections.push(event.reason);
    };
    window.addEventListener('unhandledrejection', record);
    try {
      await search('small');
      await expect
        .element(page.getByText(/^1 match in NextBrain histological atlas, which labels cuts only/))
        .toBeInTheDocument();
      await page.getByRole('button', { name: 'Switch cut labels' }).click();
      expect(calls).toEqual(['cut nextbrain']);
      expect(document.activeElement).toBe(input());
      await expect.poll(() => rejections.map(String)).toEqual(['Error: cut atlas failed']);
    } finally {
      window.removeEventListener('unhandledrejection', record);
    }
  });

  test('a list cut off at fifty says how many there are, and the count is not said', async () => {
    mount({ crowd: 60 });
    await search('v1');
    await expect
      .element(page.getByText('Showing 50 of 61 matches. Refine the search to narrow it.'))
      .toBeInTheDocument();
    expect(options()).toHaveLength(50);
    await expect
      .poll(() => announced())
      .toBe('Showing 50 of 61 matches. Refine the search to narrow it.');
  });
});

describe('browsing scope', () => {
  const radios = () => page.getByRole('radio');

  test('a radio group of the two scopes: arrows move and choose, the checked one is not chosen again', async () => {
    const calls = mount();
    expect(page.getByRole('radiogroup', { name: 'Browse' }).elements()).toHaveLength(1);
    await expect.element(page.getByRole('radio', { name: 'Whole brain' })).toBeChecked();
    expect(page.getByText('System picker').elements()).toEqual([]);
    (page.getByRole('radio', { name: 'Whole brain' }).element() as HTMLElement).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(calls).toEqual(['scope']);
    await expect.element(page.getByRole('radio', { name: 'By system' })).toBeChecked();
    // Inside the anatomy, A3's picker shows under the scope.
    await expect.element(page.getByText('System picker')).toBeVisible();
    await page.getByRole('radio', { name: 'By system' }).click();
    expect(calls).toEqual(['scope']);
  });

  test('while a load runs the scope cannot change, but focus stays on its radio', async () => {
    const calls = mount();
    const first = radios().first().element() as HTMLElement;
    first.focus();
    // A programmatic press: a mouse press would take focus itself.
    document.getElementById('switch')!.click();
    await expect.poll(() => first.getAttribute('aria-disabled')).toBe('true');
    expect(first.hasAttribute('disabled')).toBe(false);
    expect(document.activeElement).toBe(first);
    await userEvent.keyboard('{ArrowRight}');
    expect(calls).toEqual([]);
    expect(document.activeElement).toBe(radios().last().element());
    document.getElementById('switch')!.click();
    await expect.poll(() => first.hasAttribute('aria-disabled')).toBe(false);
  });

  test('searching puts the scope, the system picker and the tree away, and a French panel names it in French', async () => {
    mount({ lang: 'fr' });
    await expect.element(page.getByRole('radiogroup', { name: 'Parcourir' })).toBeVisible();
    await expect.element(page.getByRole('radio', { name: 'Cerveau entier' })).toBeChecked();
    await search('cun');
    expect(page.getByRole('radiogroup').elements()).toEqual([]);
    expect(visible(grid())).toBe(false);
  });
});

describe('keys from outside the field', () => {
  test('`/` focuses the field and selects its text', async () => {
    mount();
    await search('cuneus');
    (document.getElementById('before') as HTMLElement).focus();
    await page.getByRole('button', { name: 'search key' }).click();
    expect(document.activeElement).toBe(input());
    expect([input().selectionStart, input().selectionEnd]).toEqual([0, 6]);
  });

  test('Up and Down while searching go to the field, keeping the text; while browsing they walk the tree', async () => {
    mount();
    await search('cuneus');
    (document.getElementById('before') as HTMLElement).focus();
    await page.getByRole('button', { name: 'walk down' }).click();
    expect(document.activeElement).toBe(input());
    expect(input().value).toBe('cuneus');
    await userEvent.keyboard('{Escape}');
    (document.getElementById('before') as HTMLElement).focus();
    grid().querySelector<HTMLElement>('[role="row"]')!.focus();
    await page.getByRole('button', { name: 'walk down' }).click();
    expect((document.activeElement as HTMLElement).getAttribute('role')).toBe('row');
    expect(document.activeElement).not.toBe(grid().querySelector('[role="row"]'));
  });
});

describe('layout and accessibility', () => {
  test('axe is clean browsing, with results, and with the sentences, in English and French', async () => {
    for (const lang of ['en', 'fr'] as const) {
      mount({ lang });
      await expectAxeClean();
      await search(lang === 'en' ? 'cuneus' : 'cun');
      await expect.poll(() => options().length).toBeGreaterThan(0);
      await expectAxeClean();
      cleanup();
    }
    mount();
    await search('v1');
    await expect
      .element(page.getByText(/^1 match in HCP-MMP1\.0 multimodal atlas/))
      .toBeInTheDocument();
    await expectAxeClean();
  });

  test('forced colours: the matched text is underlined, not only heavier', async () => {
    mount();
    await search('cuneus');
    await expect.element(optionNamed(/^Cuneus, left/)).toBeInTheDocument();
    await withMedia([{ name: 'forced-colors', value: 'active' }], () => {
      const mark = document.querySelector('mark.query-match')!;
      expect(getComputedStyle(mark).textDecorationLine).toBe('underline');
    });
  });

  test('reflow at 320 px under WCAG 1.4.12 text spacing: results wrap, nothing spills or is clipped', async () => {
    mount({ settings: { hemisphere: 'right' } });
    await search('cuneus');
    await expect.element(optionNamed(/^Cuneus, left/)).toBeInTheDocument();
    await page.viewport(320, 700);
    const spacing = document.head.appendChild(document.createElement('style'));
    spacing.textContent =
      '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }';
    try {
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
      for (const option of options()) {
        expect(option.scrollWidth, option.textContent!).toBeLessThanOrEqual(option.clientWidth + 1);
        expect(option.scrollHeight, option.textContent!).toBeLessThanOrEqual(
          option.clientHeight + 1,
        );
      }
    } finally {
      spacing.remove();
    }
  });

  test('200 % text: result rows grow with it instead of clipping', async () => {
    mount();
    await search('cuneus');
    await expect.element(optionNamed(/^Cuneus, left/)).toBeInTheDocument();
    const normal = options()[0].getBoundingClientRect().height;
    document.documentElement.style.fontSize = '200%';
    try {
      expect(options()[0].getBoundingClientRect().height).toBeGreaterThan(normal * 1.5);
      for (const option of options()) {
        expect(option.scrollHeight).toBeLessThanOrEqual(option.clientHeight + 1);
      }
    } finally {
      document.documentElement.style.fontSize = '';
    }
  });

  test('coarse pointer: the clear button and the scope radios are 44 px, the rows too', async () => {
    mount();
    await search('cuneus');
    await expect.element(optionNamed(/^Cuneus, left/)).toBeInTheDocument();
    const session = cdp();
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    try {
      expect(matchMedia('(pointer: coarse)').matches).toBe(true);
      const clear = page.getByRole('button', { name: 'Clear search' }).element();
      expect(clear.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
      expect(clear.getBoundingClientRect().width).toBeGreaterThanOrEqual(44);
      for (const option of options()) {
        expect(option.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
      }
      await userEvent.keyboard('{Escape}');
      await expect.element(page.getByRole('radio', { name: 'Whole brain' })).toBeVisible();
      for (const radio of page.getByRole('radio').elements()) {
        expect(radio.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
      }
    } finally {
      await session.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    }
  });

  test('the field stays pinned above a long result list that scrolls', async () => {
    mount({ crowd: 60 });
    await search('v1');
    await expect.poll(() => options().length).toBe(50);
    const scroller = document.querySelector<HTMLElement>('.explorer')!;
    expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight);
    scroller.scrollTop = 400;
    const box = document.querySelector('.search-box')!.getBoundingClientRect();
    expect(box.top).toBeGreaterThanOrEqual(scroller.getBoundingClientRect().top);
    expect(box.top).toBeLessThan(scroller.getBoundingClientRect().top + 24);
  });

  test('the armed result is never under the pinned field, after typing or arrowing back to the first', async () => {
    mount({ crowd: 60 });
    await search('v1');
    await expect.poll(() => options().length).toBe(50);
    const covered = () => {
      const box = armed()!.getBoundingClientRect();
      // The title line of the armed row is what the reader points at.
      return !armed()!.contains(document.elementFromPoint(box.left + 40, box.top + 6));
    };
    await expect.poll(covered).toBe(false);
    await userEvent.keyboard('{ArrowDown>20/}');
    await expect.poll(covered).toBe(false);
    await userEvent.keyboard('{ArrowUp>20/}');
    expect(armed()).toBe(options()[0]);
    await expect.poll(covered).toBe(false);
  });
});
