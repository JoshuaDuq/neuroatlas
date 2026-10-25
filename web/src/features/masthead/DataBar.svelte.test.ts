// The data bar against the APG Disclosure table and the legacy header.js cases
// (chrome.contract.test.js:167-200, 249-273, header.test.js), as behaviour in a real browser.
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-svelte';
import type { ManifestAnatomy } from '../../lib/types/index.ts';
import axe from 'axe-core';
import type { ComponentProps } from 'svelte';
import { withMedia } from '../../lib/ui/a11y-test-support.ts';
import Fixture from './data-bar-test-support.svelte';

type Bar = ComponentProps<typeof Fixture>['bar'];
const WIDE = [1600, 900] as const;
const PHONE = [390, 844] as const;

const anatomy = (id: string, individual = true): ManifestAnatomy => ({
  id,
  subject: id,
  display_name: `CDMD “${id}”`,
  label: id,
  individual,
});
const subjects = [anatomy('sub_013'), anatomy('sub_014')];

function barProps(overrides: Record<string, unknown> = {}) {
  const props: Bar = {
    lang: 'en' as const,
    status: 'ready' as const,
    progress: null,
    atlas: 'destrieux',
    surfaceColor: 'tissue' as const,
    detail: 'learning',
    paint: null,
    atlases: ['destrieux', 'hcp-mmp', 'aseg'],
    detailLevels: ['learning', 'nextbrain'],
    colourings: {
      networks: {},
      cabNp: { atlas: 'hcp-mmp' },
      functionalRegions: { atlas: 'hcp-mmp' },
    } as never,
    anatomy: subjects[0],
    anatomies: subjects,
    reference: null,
    ...overrides,
  };
  return props;
}

const el = (locator: { element(): Element }) => locator.element() as HTMLElement;
const field = (name: string) => page.getByRole('combobox', { name, exact: true });
const summary = () =>
  page.getByRole('button', {
    name: /^(Atlas and display settings|Réglages de l’atlas et de l’affichage)/,
  });
const more = () => page.getByRole('button', { name: 'More settings', exact: true });
const bar = () => document.querySelector<HTMLElement>('.data-bar')!;
const announced = () => document.getElementById('announcer')!.textContent;
const texts = (select: HTMLElement) =>
  [...(select as HTMLSelectElement).options].map((option) => option.textContent);
// axe in both themes at desktop and phone width, once the measured collapse has caught up with each size.
async function expectAxeClean(sizes: (readonly [number, number])[] = [WIDE, PHONE]) {
  const still = document.head.appendChild(document.createElement('style'));
  still.textContent = '*, *::before, *::after { transition: none !important; }';
  try {
    for (const theme of ['light', 'dark']) {
      document.documentElement.dataset.theme = theme;
      for (const [width, height] of sizes) {
        await page.viewport(width, height);
        await expect.poll(() => bar().hasAttribute('data-collapsed')).toBe(width === PHONE[0]);
        const results = await axe.run(document.body, {
          runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'],
          rules: { region: { enabled: false } },
        });
        expect(
          results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' ')}`),
          `${theme} ${width}px`,
        ).toEqual([]);
      }
    }
  } finally {
    still.remove();
    delete document.documentElement.dataset.theme;
    await page.viewport(...WIDE);
  }
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 150));

async function wide(props = barProps(), extra: Record<string, unknown> = {}) {
  await page.viewport(...WIDE);
  const view = await render(Fixture, { bar: props, ...extra });
  await settle();
  return view;
}
async function phone(props = barProps(), extra: Record<string, unknown> = {}) {
  await page.viewport(...PHONE);
  const view = await render(Fixture, { bar: props, ...extra });
  await settle();
  return view;
}

beforeEach(() => page.viewport(...WIDE));
afterEach(() => {
  cleanup();
});

describe('DataBar on the bar', () => {
  test('four named fields, each described by its note; subject is a select only with a choice', async () => {
    await wide();
    expect(bar().hasAttribute('data-collapsed')).toBe(false);
    for (const name of ['Subject', 'Atlas', 'Colour', 'Internal anatomy']) {
      const control = el(field(name));
      const note = document.getElementById(control.getAttribute('aria-describedby')!)!;
      expect(note.textContent!.length, name).toBeGreaterThan(0);
    }
    expect(el(field('Atlas')).getAttribute('aria-describedby')).not.toBeNull();
    expect(
      document.getElementById(el(field('Atlas')).getAttribute('aria-describedby')!)!.textContent,
    ).toBe('Sulcal and gyral regions, 74 per hemisphere');
    expect(texts(el(field('Subject')))).toEqual(['CDMD sub_013', 'CDMD sub_014']);
  });

  test('one subject and one detail level offer no field at all', async () => {
    await wide(barProps({ anatomies: [subjects[0]], detailLevels: ['learning'] }));
    expect(page.getByRole('combobox', { name: 'Subject' }).elements()).toHaveLength(0);
    expect(page.getByRole('combobox', { name: 'Internal anatomy' }).elements()).toHaveLength(0);
    // One published subject is not a field: the colophon names it (legacy hides the whole field).
    expect(bar().querySelector('.study-name')).toBeNull();
    expect(page.getByText('Subject', { exact: true }).elements()).toHaveLength(0);
  });

  test('options name what choosing them changes, in optgroups; the selected one shows progress', async () => {
    const props = barProps();
    const view = await wide(props);
    expect(texts(el(field('Atlas')))).toEqual(['Destrieux', 'HCP-MMP', 'FreeSurfer aseg']);
    expect(texts(el(field('Colour')))).toEqual([
      '',
      'Tissue',
      'T1 MRI',
      'Regions',
      'Yeo 7 networks',
      'CAB-NP networks (atlas becomes HCP-MMP)',
      'Functional divisions (atlas becomes HCP-MMP)',
    ]);
    expect(
      [...el(field('Colour')).querySelectorAll('optgroup')].map((group) => group.label),
    ).toEqual(['Appearance', 'Parcellation', 'Networks']);
    // Colour defined on HCP-MMP areas: the atlas option for another atlas names the colour it drops.
    await view.rerender({ bar: barProps({ atlas: 'hcp-mmp', surfaceColor: 'cab-np' }) });
    expect(texts(el(field('Atlas')))).toEqual([
      'Destrieux (colour becomes Regions)',
      'HCP-MMP',
      'FreeSurfer aseg (colour becomes Regions)',
    ]);
    expect(texts(el(field('Colour')))[1]).toBe('Tissue');
  });

  test('a choice downloading shows its progress in the select, and reverts if it does not land', async () => {
    const bar = $state(barProps());
    await wide(bar, { onCommand: () => Object.assign(bar, { status: 'switching' }) });
    await userEvent.selectOptions(field('Atlas'), 'hcp-mmp');
    await settle();
    expect((el(field('Atlas')) as HTMLSelectElement).selectedOptions[0].textContent).toBe(
      'HCP-MMP · Loading…',
    );
    bar.progress = { loaded: 34, total: 100 };
    await settle();
    expect((el(field('Atlas')) as HTMLSelectElement).selectedOptions[0].textContent).toMatch(
      /^HCP-MMP · Loading 34/,
    );
    bar.status = 'ready';
    await settle();
    expect((el(field('Atlas')) as HTMLSelectElement).value).toBe('destrieux');
    expect((el(field('Atlas')) as HTMLSelectElement).selectedOptions[0].textContent).toBe(
      'Destrieux',
    );
  });

  test('each field calls its command; the subject calls onAnatomy', async () => {
    const calls: string[] = [];
    await wide(barProps(), { calls });
    await userEvent.selectOptions(field('Atlas'), 'aseg');
    await userEvent.selectOptions(field('Colour'), 'mri');
    await userEvent.selectOptions(field('Internal anatomy'), 'nextbrain');
    await userEvent.selectOptions(field('Subject'), 'sub_014');
    expect(calls).toEqual(['atlas:aseg', 'colour:mri', 'detail:nextbrain', 'anatomy:sub_014']);
  });

  test('a tab painting the brain shows its name in the hidden paint option', async () => {
    const paint = { id: 'function:memory', colors: new Map() };
    await wide(barProps({ paint }));
    const colour = el(field('Colour')) as HTMLSelectElement;
    expect(colour.selectedOptions[0].textContent).toBe('Functions');
    expect(colour.selectedOptions[0].hidden).toBe(true);
    expect(document.getElementById(colour.getAttribute('aria-describedby')!)!.textContent).toMatch(
      /^Set by the Functions tab/,
    );
  });

  test('the subject select is disabled while switching, and focus is not dropped to the page', async () => {
    const props = $state(barProps());
    await wide(props);
    el(field('Subject')).focus();
    props.status = 'switching';
    await settle();
    expect((el(field('Subject')) as HTMLSelectElement).disabled).toBe(true);
    expect(document.activeElement).toBe(el(field('Atlas')));
  });

  test('the note is the tooltip on the bar, never a title', async () => {
    await wide();
    for (const name of ['Subject', 'Atlas', 'Colour', 'Internal anatomy']) {
      const control = el(field(name));
      expect(control.dataset.tooltip, name).toBe(
        document.getElementById(control.getAttribute('aria-describedby')!)!.textContent,
      );
      expect(control.hasAttribute('title')).toBe(false);
    }
  });

  test('French strings and names', async () => {
    await wide(barProps({ lang: 'fr' }));
    for (const name of ['Sujet', 'Atlas', 'Couleur', 'Anatomie interne']) {
      expect(el(field(name)), name).toBeTruthy();
    }
    expect(
      [...el(field('Couleur')).querySelectorAll('optgroup')].map((group) => group.label),
    ).toEqual(['Apparence', 'Parcellisation', 'Réseaux']);
  });

  test('every field is a 24 px target at least (WCAG 2.5.8)', async () => {
    await wide();
    for (const select of bar().querySelectorAll('select')) {
      const box = select.getBoundingClientRect();
      expect(box.height).toBeGreaterThanOrEqual(24);
      expect(box.width).toBeGreaterThanOrEqual(24);
    }
  });
});

describe('DataBar collapsed behind its summary', () => {
  test('a phone is always collapsed; the summary names its parts, label first (WCAG 2.5.3)', async () => {
    await phone();
    expect(bar().hasAttribute('data-collapsed')).toBe(true);
    const toggle = el(summary());
    expect(toggle.getAttribute('aria-label')).toBe(
      'Atlas and display settings: CDMD sub_013 · Destrieux · Tissue · Teaching set',
    );
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-controls')).toBe(bar().querySelector('.masthead-data')!.id);
    for (const part of toggle.querySelectorAll('.data-summary-part')) {
      expect(toggle.getAttribute('aria-label')).toContain(part.textContent!);
    }
    expect(toggle.dataset.tooltip).toBe('Atlas and display settings');
  });

  test('the popover opens on the summary, keeps focus there, and prints the notes', async () => {
    await phone();
    expect(page.getByRole('combobox', { name: 'Atlas' }).elements()).toHaveLength(0);
    await summary().click();
    await expect.element(field('Atlas')).toBeVisible();
    expect(el(summary()).getAttribute('aria-expanded')).toBe('true');
    expect(
      bar().querySelector<HTMLElement>('.data-note')!.checkVisibility(),
      'notes are printed',
    ).toBe(true);
    expect(el(field('Atlas')).hasAttribute('data-tooltip')).toBe(false);
    expect(
      Math.abs(
        bar().querySelector('.masthead-data')!.getBoundingClientRect().right -
          (window.innerWidth - 12),
      ),
    ).toBeLessThan(2);
  });

  test('Tab leaves the summary into the fields in order, then onward; leaving closes it', async () => {
    await phone();
    el(summary()).focus();
    await userEvent.keyboard('{Enter}');
    await expect.element(field('Subject')).toBeVisible();
    expect(document.activeElement).toBe(el(summary()));
    for (const name of ['Subject', 'Atlas', 'Colour', 'Internal anatomy']) {
      await userEvent.keyboard('{Tab}');
      expect(document.activeElement, name).toBe(el(field(name)));
    }
    // Full screen is not offered on a phone: the next stop is Save image.
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(el(page.getByRole('button', { name: 'Save image (PNG)' })));
    expect(el(summary()).getAttribute('aria-expanded')).toBe('false');
  });

  test('Escape closes, returns focus to the summary and is marked handled', async () => {
    await phone();
    await summary().click();
    el(field('Colour')).focus();
    let prevented = false;
    document.addEventListener('keydown', (event) => (prevented = event.defaultPrevented), {
      once: true,
    });
    await userEvent.keyboard('{Escape}');
    expect(prevented).toBe(true);
    expect(el(summary()).getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(el(summary()));
  });

  test('a press outside closes it without moving focus', async () => {
    await phone();
    await summary().click();
    // The popover covers the canvas on a phone: press on a masthead control beside it.
    const save = page.getByRole('button', { name: 'Save image (PNG)' });
    await save.click();
    expect(el(summary()).getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(el(save));
  });

  test('the data popover and the settings panel are never open together', async () => {
    await phone();
    await summary().click();
    await more().click();
    expect(el(summary()).getAttribute('aria-expanded')).toBe('false');
    expect(el(more()).getAttribute('aria-expanded')).toBe('true');
    await summary().click();
    expect(el(summary()).getAttribute('aria-expanded')).toBe('true');
    expect(el(more()).getAttribute('aria-expanded')).toBe('false');
  });

  test('a keyboard open is instant; a pointer open animates', async () => {
    await phone();
    el(summary()).focus();
    await userEvent.keyboard('{Enter}');
    expect(bar().querySelector('.masthead-data')!.hasAttribute('data-instant')).toBe(true);
    await userEvent.keyboard('{Enter}');
    await summary().click();
    expect(bar().querySelector('.masthead-data')!.hasAttribute('data-instant')).toBe(false);
  });

  test('reduced motion keeps the opacity transition and drops the chevron turn', async () => {
    await phone();
    await withMedia([{ name: 'prefers-reduced-motion', value: 'reduce' }], async () => {
      await summary().click();
      expect(getComputedStyle(bar().querySelector('.masthead-data')!).transitionProperty).toBe(
        'opacity',
      );
      expect(getComputedStyle(el(summary()), '::after').transitionDuration).toBe('0s');
    });
  });

  test('the bar collapsing under a focused field opens the popover with focus kept', async () => {
    await wide();
    el(field('Atlas')).focus();
    await page.viewport(...PHONE);
    await expect.poll(() => bar().hasAttribute('data-collapsed')).toBe(true);
    expect(el(summary()).getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(el(field('Atlas')));
  });

  test('widening under the focused summary hands focus to the first enabled field', async () => {
    await phone();
    el(summary()).focus();
    await page.viewport(...WIDE);
    await expect.poll(() => bar().hasAttribute('data-collapsed')).toBe(false);
    expect(document.activeElement).toBe(el(field('Subject')));
  });

  test('the summary drops internal anatomy, then colour, as room shrinks; atlas is never dropped', async () => {
    await page.viewport(300, 800);
    await render(Fixture, { bar: barProps() });
    await settle();
    const node = bar().querySelector<HTMLElement>('.data-summary')!;
    const hidden = (part: string) =>
      getComputedStyle(node.querySelector(`.data-summary-part[data-part=${part}]`)!).display ===
      'none';
    expect(node.dataset.short).toBeTruthy();
    expect(hidden('detail')).toBe(true);
    expect(hidden('atlas')).toBe(false);
    expect(el(summary()).getAttribute('aria-label')).toContain('Teaching set');
  });

  test('landscape ≤ 480 px tall lays the popover out in two columns', async () => {
    await page.viewport(844, 390);
    await render(Fixture, { bar: barProps() });
    await settle();
    await summary().click();
    const columns = getComputedStyle(bar().querySelector('.masthead-data')!).gridTemplateColumns;
    expect(columns.split(' ')).toHaveLength(2);
  });

  test('the fields fit at 320 px with spaced, enlarged text (WCAG 1.4.10, 1.4.12)', async () => {
    await page.viewport(320, 640);
    await render(Fixture, { bar: barProps() });
    document.documentElement.style.fontSize = '200%';
    const spacing = document.head.appendChild(document.createElement('style'));
    spacing.textContent =
      '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }';
    try {
      await settle();
      await summary().click();
      const popover = bar().querySelector<HTMLElement>('.masthead-data')!;
      const box = popover.getBoundingClientRect();
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(window.innerWidth);
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
    } finally {
      spacing.remove();
      document.documentElement.style.fontSize = '';
    }
  });
});

describe('DataBar tract reference', () => {
  const reference = { label: 'Tract reference', description: 'Bundles drawn on the HCP template' };

  test('shows its name only, with its description reachable by keyboard and described', async () => {
    await wide(barProps({ reference }));
    expect(bar().hasAttribute('data-reference')).toBe(true);
    expect(page.getByRole('combobox').elements()).toHaveLength(0);
    const name = bar().querySelector<HTMLElement>('.study-name')!;
    expect(name.textContent!.trim()).toBe('Tract reference');
    expect(name.dataset.tooltip).toBe(reference.description);
    expect(name.tabIndex).toBe(0);
    expect(document.getElementById(name.getAttribute('aria-describedby')!)!.textContent).toBe(
      reference.description,
    );
    el(page.getByRole('link', { name: 'Skip to model' })).focus();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(name);
    await expect.element(page.getByRole('tooltip')).toHaveTextContent(reference.description);
  });

  test('on a phone the summary is the name alone and there is no popover to open', async () => {
    await phone(barProps({ reference }));
    expect(bar().hasAttribute('data-collapsed')).toBe(true);
    expect(bar().querySelector<HTMLElement>('.data-toggle')!.checkVisibility()).toBe(false);
    expect(page.getByRole('combobox').elements()).toHaveLength(0);
    expect(bar().querySelector('.study-name')!.checkVisibility()).toBe(true);
  });

  test('focus inside the data bar when the reference starts moves on, not to the page', async () => {
    const props = $state(barProps());
    await wide(props);
    el(field('Colour')).focus();
    props.reference = reference;
    await settle();
    expect(document.activeElement).not.toBe(document.body);
    expect(bar().contains(document.activeElement)).toBe(false);
  });
});

describe('DataBar announcements', () => {
  test('a download started here is announced when it starts and when it lands', async () => {
    const props = $state(barProps());
    await wide(props, { onCommand: () => Object.assign(props, { status: 'switching' }) });
    await userEvent.selectOptions(field('Atlas'), 'hcp-mmp');
    await settle();
    expect(announced()).toBe('HCP-MMP: Loading…');
    Object.assign(props, { status: 'ready', atlas: 'hcp-mmp' });
    await settle();
    expect(announced()).toBe('Anatomy loaded.');
  });

  test('in French, with a French spacing before the colon', async () => {
    const props = $state(barProps({ lang: 'fr' }));
    await wide(props, { onCommand: () => Object.assign(props, { status: 'switching' }) });
    await userEvent.selectOptions(field('Atlas'), 'hcp-mmp');
    await settle();
    expect(announced()).toBe('HCP-MMP : Chargement…');
    Object.assign(props, { status: 'ready', atlas: 'hcp-mmp' });
    await settle();
    expect(announced()).toBe('Anatomie chargée.');
  });

  test('a download that fails says nothing more (the notice does)', async () => {
    const props = $state(barProps());
    await wide(props, { onCommand: () => Object.assign(props, { status: 'switching' }) });
    await userEvent.selectOptions(field('Atlas'), 'hcp-mmp');
    await settle();
    Object.assign(props, { status: 'ready' });
    await settle();
    expect(announced()).toBe('HCP-MMP: Loading…');
  });

  test('a choice that needs no download says nothing', async () => {
    await wide();
    await userEvent.selectOptions(field('Colour'), 'mri');
    await settle();
    expect(announced()).toBe('');
  });
});

describe('DataBar accessibility', () => {
  test('axe clean on the bar, in both themes and at phone width', async () => {
    await wide();
    await expectAxeClean();
  });

  test('axe clean with the popover open, in English and French', async () => {
    for (const lang of ['en', 'fr'] as const) {
      await phone(barProps({ lang }));
      await summary().click();
      await expectAxeClean([PHONE]);
      cleanup();
    }
  });

  test('forced colours: the caret is drawn in the system text colour', async () => {
    await wide();
    await withMedia([{ name: 'forced-colors', value: 'active' }], async () => {
      const select = el(field('Atlas'));
      const probe = document.body.appendChild(document.createElement('span'));
      probe.style.color = 'CanvasText';
      const canvasText = getComputedStyle(probe).color;
      probe.remove();
      expect(getComputedStyle(select.parentElement!, '::after').borderRightColor).toBe(canvasText);
      expect(getComputedStyle(select).borderTopColor).toBe(canvasText);
    });
  });

  test('increased contrast: the bar fields have a visible border', async () => {
    await wide();
    await withMedia([{ name: 'prefers-contrast', value: 'more' }], async () => {
      const border = getComputedStyle(el(field('Atlas'))).borderTopColor;
      expect(border).not.toBe('rgba(0, 0, 0, 0)');
    });
  });
});
