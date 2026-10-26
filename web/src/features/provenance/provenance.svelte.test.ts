// The Provenance dialog and the colophon in Chromium: APG Dialog (Modal) keyboard paths, the focus
// hand-offs of decision record on #42, `data-instant`, language of parts and axe. The row content
// is C5's (core/panels/provenance.test.ts).
import { beforeEach, describe, expect, test } from 'vitest';
import { cdp, page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import manifest from '../../../../public/models/cdmd/manifest.json';
import { withMedia } from '../../lib/ui/a11y-test-support.ts';
import { expectAxeCleanOnce } from '../../lib/ui/axe-state-support.ts';
import type { Manifest } from '../../lib/types/index.ts';
import '../../app/layout.css';
import Fixture from './provenance-test-support.svelte';

const props = (extra = {}) => ({
  lang: 'en' as const,
  manifest: manifest as unknown as Manifest,
  manifestUrl: '/neuroatlas/models/cdmd/manifest.json',
  indexUrl: '/neuroatlas/models/anatomies.json',
  domains: null,
  reference: null,
  ...extra,
});
const reference = {
  label: 'Tract reference subject',
  links: [{ href: 'https://example.org/tracts', text: 'example.org/tracts' }],
};

// The status bar is a desktop surface: the browser's default frame is phone-sized.
beforeEach(() => page.viewport(1280, 800));

const opener = () => page.getByRole('button', { name: /^Provenance$|^Provenance, / });
const dialog = () => document.querySelector('dialog') as HTMLDialogElement;
const title = () => dialog().querySelector('h2') as HTMLElement;
/** Whether focus is on a page element behind the dialog. */
const inPage = (element: Element | null) =>
  element !== null && element !== document.body && !dialog().contains(element);
const links = () => [...dialog().querySelectorAll<HTMLAnchorElement>('a')];

/** Runs `action` and waits for the dialog's `close` event, after which Dialog has returned focus. */
async function closing(action: () => Promise<unknown>) {
  const closed = new Promise((resolve) =>
    dialog().addEventListener('close', resolve, { once: true }),
  );
  await action();
  await closed;
}

async function openFromKeyboard() {
  (document.querySelector('.provenance-opener') as HTMLElement).focus();
  await userEvent.keyboard('{Enter}');
  await expect.poll(() => dialog().open).toBe(true);
}

describe('Colophon', () => {
  test('the statement, the description, the count and the opener, in that order', async () => {
    render(Fixture, props());
    const text = document.querySelector('.colophon')!.textContent!.replace(/\s+/g, ' ').trim();
    expect(text).toBe(
      'Not clinical anatomy Bert · one individual’s MRI reconstruction 12 visible regions Provenance',
    );
    expect(document.querySelector('footer')).not.toBeNull();
    expect(opener().element().getAttribute('aria-haspopup')).toBe('dialog');
  });

  test('French labels', async () => {
    render(Fixture, props({ lang: 'fr' }));
    await expect.element(page.getByText('Pas une anatomie clinique')).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Provenance' })).toBeVisible();
  });

  test('the Provenance button is 24 px tall with a fine pointer', async () => {
    render(Fixture, props());
    expect(opener().element().getBoundingClientRect().height).toBe(24);
  });

  test('a coarse pointer gets a 44 px bar filled by the button, and the page does not scroll', async () => {
    const session = cdp();
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await page.viewport(1180, 820);
    const app = document.body.appendChild(document.createElement('div'));
    app.id = 'app';
    try {
      await render(Fixture, { props: props(), target: app });
      expect(matchMedia('(pointer: coarse)').matches).toBe(true);
      const bar = document.querySelector('footer')!.getBoundingClientRect();
      const button = opener().element().getBoundingClientRect();
      expect(bar.height).toBe(45);
      expect(button.height).toBe(44);
      expect(button.top).toBe(bar.top + 1);
      const hit = document.elementFromPoint(button.left + 8, button.top + 3);
      expect(hit).toBe(opener().element());
      const root = document.documentElement;
      expect(root.scrollHeight).toBeLessThanOrEqual(root.clientHeight);
    } finally {
      app.remove();
      await session.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    }
  });

  test('the button appears only when the owner supplies an opener', async () => {
    const { Colophon } = { Colophon: (await import('../colophon/Colophon.svelte')).default };
    render(Colophon, { lang: 'en', regionCount: '' });
    expect(document.querySelector('button')).toBeNull();
  });
});

describe('Provenance dialog', () => {
  test('a keyboard open is instant, a pointer open is not; focus starts on the title', async () => {
    render(Fixture, props());
    await opener().click();
    await expect.poll(() => dialog().open).toBe(true);
    expect(dialog().hasAttribute('data-instant')).toBe(false);
    await closing(() => userEvent.keyboard('{Escape}'));
    expect(dialog().open).toBe(false);

    await openFromKeyboard();
    expect(dialog().hasAttribute('data-instant')).toBe(true);
    expect(document.activeElement).toBe(title());
    await expect.element(page.getByRole('dialog', { name: 'Provenance' })).toBeVisible();
    await expect.element(page.getByRole('heading', { name: 'Provenance', level: 2 })).toBeVisible();
  });

  test('Tab and Shift+Tab loop inside the dialog and never reach the page', async () => {
    render(Fixture, props());
    await openFromKeyboard();
    const focusable = [dialog().querySelector('.dialog-close'), ...links()];
    const seen = new Set<Element | null>();
    for (let step = 0; step < focusable.length + 2; step++) {
      await userEvent.keyboard('{Tab}');
      // Past the last control a native modal hands focus to the browser's own UI, not the page.
      expect(inPage(document.activeElement)).toBe(false);
      seen.add(document.activeElement);
    }
    for (const element of focusable) expect(seen.has(element)).toBe(true);
    for (let step = 0; step < 3; step++) {
      await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
      expect(inPage(document.activeElement)).toBe(false);
    }
  });

  test('Escape closes instantly, returns focus to the opener and is kept from the page', async () => {
    render(Fixture, props());
    const seen: string[] = [];
    const listener = (event: KeyboardEvent) => seen.push(event.key);
    await openFromKeyboard();
    window.addEventListener('keydown', listener);
    await userEvent.keyboard('v');
    await userEvent.keyboard('{Escape}');
    window.removeEventListener('keydown', listener);

    await expect.poll(() => dialog().open).toBe(false);
    expect(dialog().hasAttribute('data-instant')).toBe(true);
    await expect.poll(() => document.activeElement).toBe(opener().element());
    expect(seen).toEqual([]);
  });

  test('keys that scroll are not cancelled', async () => {
    render(Fixture, props());
    await openFromKeyboard();
    let prevented = true;
    const listener = (event: KeyboardEvent) => (prevented = event.defaultPrevented);
    dialog().addEventListener('keydown', listener);
    await userEvent.keyboard('{ArrowDown}');
    dialog().removeEventListener('keydown', listener);
    expect(prevented).toBe(false);
  });

  test('Close with the pointer closes with the animation; with the keyboard, instantly', async () => {
    render(Fixture, props());
    await opener().click();
    await expect.poll(() => dialog().open).toBe(true);
    await closing(() => page.getByRole('button', { name: 'Close' }).click());
    expect(dialog().hasAttribute('data-instant')).toBe(false);
    expect(document.activeElement).toBe(opener().element());

    await openFromKeyboard();
    page.getByRole('button', { name: 'Close' }).element().focus();
    await userEvent.keyboard('{Enter}');
    await expect.poll(() => dialog().open).toBe(false);
    expect(dialog().hasAttribute('data-instant')).toBe(true);
  });

  test('focus goes to the fallback when the opener is hidden by then', async () => {
    render(Fixture, props());
    await openFromKeyboard();
    (document.querySelector('.colophon') as HTMLElement).style.display = 'none';
    await closing(() => userEvent.keyboard('{Escape}'));
    expect(document.activeElement).toBe(page.getByRole('button', { name: 'More' }).element());
  });

  test('a language change while open re-labels in place; English data is marked only in French', async () => {
    const screen = await render(Fixture, props());
    await openFromKeyboard();
    const reconstruction = () =>
      [...dialog().querySelectorAll<HTMLElement>('.provenance-value.code')][0]!;
    expect(reconstruction().hasAttribute('lang')).toBe(false);
    const link = links()[0]!;
    link.focus();

    await screen.rerender(props({ lang: 'fr' }));
    await expect.element(page.getByRole('heading', { name: 'Provenance' })).toBeVisible();
    expect(dialog().querySelector('dt')!.textContent).toBe('Sujet');
    expect(page.getByRole('button', { name: 'Fermer' }).element()).toBeTruthy();
    // The link's node was updated, not replaced, so focus stayed on it.
    expect(document.activeElement).toBe(link);
    expect(reconstruction().getAttribute('lang')).toBe('en');
    const subject = dialog().querySelector('dd .provenance-value')!;
    expect(subject.getAttribute('lang')).toBe('en');
    for (const note of dialog().querySelectorAll('dd .provenance-note')) {
      if (note.textContent!.startsWith('Reconstruction IRM')) {
        expect(note.hasAttribute('lang')).toBe(false);
      }
    }
    expect(document.querySelector('.provenance-use')!.hasAttribute('lang')).toBe(false);
  });

  test('a reference swap that removes the focused link moves focus to the title', async () => {
    const screen = await render(Fixture, props());
    await openFromKeyboard();
    links()[0]!.focus();
    await screen.rerender(props({ reference }));
    // The same node now holds the reference's first link: focus stays.
    expect(dialog().contains(document.activeElement)).toBe(true);
    expect(dialog().querySelector('dd')!.textContent).toContain('Tract reference subject');
    expect(links().map((link) => link.href)).toEqual(['https://example.org/tracts']);

    // A reference with no source links removes the focused node: focus goes to the title.
    links()[0]!.focus();
    await screen.rerender(props({ reference: { label: 'No sources', links: [] } }));
    expect(links()).toHaveLength(0);
    expect(document.activeElement).toBe(title());
  });

  test('every link scrolls clear of the sticky header on a phone', async () => {
    render(Fixture, props());
    try {
      await openFromKeyboard();
      await page.viewport(390, 844);
      const header = dialog().querySelector('.dialog-header')!;
      for (const link of links()) {
        link.focus();
        const { top } = link.getBoundingClientRect();
        expect(top, link.href).toBeGreaterThanOrEqual(header.getBoundingClientRect().bottom);
      }
    } finally {
      await page.viewport(1280, 800);
    }
  });

  test.each([
    ['en', '(opens in a new tab)'],
    ['fr', '(s’ouvre dans un nouvel onglet)'],
  ] as const)(
    'every link opens a new tab and says so, with the external-link icon, in %s',
    async (lang, cue) => {
      render(Fixture, props({ lang }));
      await openFromKeyboard();
      expect(links().length).toBeGreaterThan(0);
      for (const link of links()) {
        expect(link.target, link.href).toBe('_blank');
        expect(link.rel).toBe('noreferrer');
        const text = link.querySelector('.visually-hidden')!.previousSibling!.textContent!;
        expect(link.textContent!.trim(), link.href).toBe(`${text} ${cue}`);
        expect(link.querySelector('svg.control-icon'), link.href).not.toBeNull();
      }
      const first = links()[0]!;
      await expect
        .element(page.getByRole('link', { name: first.textContent!.trim() }).first())
        .toBeVisible();
    },
  );

  // One run per state; the keyboard open is instant, so there is no animation to wait out.
  test.each([
    ['en', null, 'light', 1280],
    ['fr', null, 'dark', 390],
    ['en', reference, 'dark', 1280],
  ] as const)(
    'axe is clean with the dialog open: %s, reference %j, %s, %i px',
    async (lang, shown, theme, width) => {
      render(Fixture, props({ lang, reference: shown }));
      await openFromKeyboard();
      await expectAxeCleanOnce(theme, width);
    },
  );

  test('an item that is only a link lists it before its note', async () => {
    render(Fixture, props());
    await openFromKeyboard();
    const files = [...dialog().querySelectorAll('dt')].find(
      (dt) => dt.textContent === 'Published files',
    )!.nextElementSibling!;
    const [manifestItem, indexItem] = [...files.querySelectorAll('.provenance-item')];
    for (const [item, name] of [
      [manifestItem, 'manifest.json'],
      [indexItem, 'anatomies.json'],
    ] as const) {
      const children = [...item!.children];
      expect(children[0]!.tagName).toBe('A');
      expect(children[0]!.textContent).toBe(`${name} (opens in a new tab)`);
      expect(children[1]!.className).toContain('provenance-note');
    }
  });

  test('text at 200 % and the WCAG 1.4.12 spacing keep labels and notes inside the dialog', async () => {
    const screen = await render(Fixture, props());
    await openFromKeyboard();
    document.documentElement.style.fontSize = '200%';
    const spacing = document.head.appendChild(document.createElement('style'));
    spacing.textContent =
      '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }';
    try {
      for (const lang of ['en', 'fr'] as const) {
        await screen.rerender(props({ lang }));
        for (const width of [1280, 320]) {
          await page.viewport(width, 800);
          const spilling = [...dialog().querySelectorAll<HTMLElement>('dt, dd, .provenance-note')]
            .filter((element) => element.scrollWidth > element.clientWidth + 0.5)
            .map((element) => element.textContent);
          expect(spilling, `${lang} ${width}px`).toEqual([]);
          expect(dialog().scrollWidth, `${lang} ${width}px`).toBeLessThanOrEqual(
            dialog().clientWidth,
          );
        }
      }
    } finally {
      spacing.remove();
      document.documentElement.style.fontSize = '';
    }
  });

  test('a French tract reference label is not marked as English', async () => {
    await render(Fixture, props({ lang: 'fr', reference: { ...reference, label: 'Référence' } }));
    await openFromKeyboard();
    expect(dialog().querySelector('[lang]')).toBeNull();
  });

  test('reduced motion keeps no scale, forced colours keep an edge', async () => {
    render(Fixture, props());
    await withMedia([{ name: 'prefers-reduced-motion', value: 'reduce' }], async () => {
      await openFromKeyboard();
      expect(getComputedStyle(dialog()).transform).toBe('none');
      await closing(() => userEvent.keyboard('{Escape}'));
    });
    await withMedia([{ name: 'forced-colors', value: 'active' }], async () => {
      await openFromKeyboard();
      expect(getComputedStyle(dialog()).borderTopStyle).not.toBe('none');
      await expect.element(page.getByRole('dialog', { name: 'Provenance' })).toBeVisible();
    });
  });
});
