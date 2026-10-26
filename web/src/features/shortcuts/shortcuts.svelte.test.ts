// The shortcuts dialog in Chromium: APG Dialog (Modal) keyboard paths, the focus hand-offs of the
// decision record on #37, `data-instant`, the key list against the keymap, and axe. The key
// handling itself is S5a's (controller/keymap.test.ts).
import { beforeEach, describe, expect, test } from 'vitest';
import { cdp, page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { SHORTCUT_KEYS } from '../../lib/controller/keymap.ts';
import { expectAxeClean, expectAxeCleanHere, withMedia } from '../../lib/ui/a11y-test-support.ts';
import '../../app/layout.css';
import Fixture from './shortcuts-test-support.svelte';

beforeEach(() => page.viewport(1280, 800));

const opener = () => page.getByRole('button', { name: 'Keyboard shortcuts' });
const dialog = () => document.querySelector('dialog') as HTMLDialogElement;
const title = () => dialog().querySelector('h2') as HTMLElement;
const more = () => page.getByRole('button', { name: 'More' }).element();

/** Runs `action` and waits for the dialog's `close` event, after which Dialog has returned focus. */
async function closing(action: () => Promise<unknown>) {
  const closed = new Promise((resolve) =>
    dialog().addEventListener('close', resolve, { once: true }),
  );
  await action();
  await closed;
}

async function openFromKeyboard() {
  opener().element().focus();
  await userEvent.keyboard('{Enter}');
  await expect.poll(() => dialog().open).toBe(true);
}

describe('content', () => {
  test('a titled dialog of three groups with 21 key rows, the keys as caps', async () => {
    render(Fixture, { lang: 'en' });
    await openFromKeyboard();
    await expect.element(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
    await expect
      .element(page.getByRole('heading', { name: 'Keyboard shortcuts', level: 2 }))
      .toBeVisible();
    expect([...dialog().querySelectorAll('h3')].map((h) => h.textContent)).toEqual([
      'Panel',
      'Model',
      'Display',
    ]);
    expect(dialog().querySelectorAll('dt')).toHaveLength(21);
    expect(dialog().querySelectorAll('dd')).toHaveLength(21);
    expect(dialog().querySelectorAll('section')).toHaveLength(0);
    const caps = (row: number) =>
      [...dialog().querySelectorAll('dt')[row]!.children].map((cap) => [
        cap.tagName,
        cap.className,
        cap.textContent,
      ]);
    // `← → ↑ ↓` is four caps; `1 – 6` is two caps around a range that reads "to".
    expect(caps(9)).toHaveLength(4);
    expect(dialog().querySelectorAll('dt')[11]!.textContent).toBe('1–to6');
    expect(caps(11)).toEqual([
      ['KBD', '', '1'],
      ['SPAN', 'key-range', '–to'],
      ['KBD', '', '6'],
    ]);
    expect(dialog().querySelector('.key-range [aria-hidden="true"]')!.textContent).toBe('–');
  });

  test('every key the keymap acts on is listed', async () => {
    render(Fixture, { lang: 'en' });
    await openFromKeyboard();
    // The keys the dialog shows, read from its caps; a range lists every key between its ends.
    const listed = new Set<string>();
    for (const cap of dialog().querySelectorAll('kbd')) listed.add(cap.textContent!);
    for (const range of dialog().querySelectorAll('.key-range')) {
      const from = Number(range.previousElementSibling!.textContent);
      const to = Number(range.nextElementSibling!.textContent);
      for (let digit = from; digit <= to; digit++) listed.add(String(digit));
    }
    const arrows: Record<string, string> = { ArrowDown: '↓', ArrowUp: '↑' };
    const { views, ...single } = SHORTCUT_KEYS;
    for (const key of [...Object.values(single), ...Object.values(views)]) {
      expect(listed.has(arrows[key] ?? key), key).toBe(true);
    }
  });

  test('the note follows the single-key preference', async () => {
    const screen = await render(Fixture, { lang: 'en' });
    await openFromKeyboard();
    expect(dialog().querySelector('.shortcuts-note')!.textContent).toContain('can be turned off');
    await screen.rerender({ lang: 'en', singleKeys: false });
    expect(dialog().querySelector('.shortcuts-note')!.textContent).toContain('are off');
  });

  test('French strings, range read as "à", and the language of the dialog follows', async () => {
    render(Fixture, { lang: 'fr' });
    (document.querySelector('.opener') as HTMLElement).focus();
    await userEvent.keyboard('{Enter}');
    await expect.element(page.getByRole('dialog', { name: 'Raccourcis clavier' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Fermer' })).toBeVisible();
    expect(dialog().querySelector('.key-range .visually-hidden')!.textContent).toBe('à');
    expect([...dialog().querySelectorAll('h3')].map((h) => h.textContent)).toEqual([
      'Panneau',
      'Modèle',
      'Affichage',
    ]);
  });

  test('a language change while open re-labels in place and keeps focus', async () => {
    const screen = await render(Fixture, { lang: 'en' });
    await openFromKeyboard();
    await screen.rerender({ lang: 'fr' });
    await expect.element(page.getByRole('heading', { name: 'Raccourcis clavier' })).toBeVisible();
    expect(document.activeElement).toBe(title());
  });
});

describe('keyboard, focus and instant', () => {
  test('a keyboard open is instant, a pointer open is not; focus starts on the title', async () => {
    render(Fixture, { lang: 'en' });
    await opener().click();
    await expect.poll(() => dialog().open).toBe(true);
    expect(dialog().hasAttribute('data-instant')).toBe(false);
    await closing(() => userEvent.keyboard('{Escape}'));

    await openFromKeyboard();
    expect(dialog().hasAttribute('data-instant')).toBe(true);
    expect(document.activeElement).toBe(title());
  });

  test('Escape closes instantly and returns focus to the opener', async () => {
    render(Fixture, { lang: 'en' });
    await openFromKeyboard();
    await closing(() => userEvent.keyboard('{Escape}'));
    expect(dialog().hasAttribute('data-instant')).toBe(true);
    expect(document.activeElement).toBe(opener().element());
  });

  test('Tab cycles inside the dialog and never reaches the page', async () => {
    render(Fixture, { lang: 'en' });
    await openFromKeyboard();
    for (let step = 0; step < 4; step++) {
      await userEvent.keyboard('{Tab}');
      const active = document.activeElement;
      expect(active === document.body || dialog().contains(active)).toBe(true);
    }
    expect(
      [...dialog().querySelectorAll('button, a[href], input, select, [tabindex="0"]')].map(
        (element) => element.classList.contains('dialog-close'),
      ),
    ).toEqual([true]);
  });

  test('`?` is not isolated from the page: it reaches it and closes the dialog', async () => {
    render(Fixture, { lang: 'en' });
    await userEvent.keyboard('?');
    await expect.poll(() => dialog().open).toBe(true);
    expect(dialog().hasAttribute('data-instant')).toBe(true);
    expect(document.activeElement).toBe(title());
    await closing(() => userEvent.keyboard('?'));
    // Nothing had focus when it opened, so focus stays on the page, as in legacy.
    expect(document.activeElement).toBe(document.body);
  });

  test('keys that scroll are not cancelled', async () => {
    render(Fixture, { lang: 'en' });
    await openFromKeyboard();
    let prevented = true;
    const listener = (event: KeyboardEvent) => (prevented = event.defaultPrevented);
    dialog().addEventListener('keydown', listener);
    await userEvent.keyboard('{ArrowDown}');
    dialog().removeEventListener('keydown', listener);
    expect(prevented).toBe(false);
  });

  test('Close with the pointer animates; with the keyboard it is instant', async () => {
    render(Fixture, { lang: 'en' });
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
    render(Fixture, { lang: 'en' });
    await openFromKeyboard();
    (document.querySelector('.opener') as HTMLElement).style.display = 'none';
    await closing(() => userEvent.keyboard('{Escape}'));
    expect(document.activeElement).toBe(more());
  });
});

describe('size, reflow and media', () => {
  test('Close is 24 px, and 44 px on a coarse pointer', async () => {
    render(Fixture, { lang: 'en' });
    await openFromKeyboard();
    const close = () => dialog().querySelector('.dialog-close')!.getBoundingClientRect();
    expect(close().width).toBeGreaterThanOrEqual(24);
    expect(close().height).toBeGreaterThanOrEqual(24);

    const session = cdp();
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    try {
      expect(matchMedia('(pointer: coarse)').matches).toBe(true);
      expect(close().width).toBe(44);
      expect(close().height).toBe(44);
    } finally {
      await session.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    }
  });

  test('text at 200 % and the WCAG 1.4.12 spacing keep every row inside the dialog', async () => {
    const screen = await render(Fixture, { lang: 'en' });
    await openFromKeyboard();
    document.documentElement.style.fontSize = '200%';
    const spacing = document.head.appendChild(document.createElement('style'));
    spacing.textContent =
      '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }';
    try {
      for (const lang of ['en', 'fr'] as const) {
        await screen.rerender({ lang });
        for (const width of [1280, 320]) {
          await page.viewport(width, 800);
          const spilling = [...dialog().querySelectorAll<HTMLElement>('dt, dd')]
            .filter((element) => element.scrollWidth > element.clientWidth + 0.5)
            .map((element) => element.textContent);
          expect(spilling, `${lang} ${width}px`).toEqual([]);
          expect(dialog().scrollWidth, `${lang} ${width}px`).toBeLessThanOrEqual(
            dialog().clientWidth,
          );
          // A row never has a fixed height, so the text cannot overflow it.
          for (const element of dialog().querySelectorAll<HTMLElement>('dd')) {
            expect(element.scrollHeight, `${lang} ${width}px`).toBeLessThanOrEqual(
              element.clientHeight,
            );
          }
        }
      }
    } finally {
      spacing.remove();
      document.documentElement.style.fontSize = '';
    }
  });

  test('on a landscape phone the title and Close stay visible while the list scrolls', async () => {
    render(Fixture, { lang: 'en' });
    await openFromKeyboard();
    await page.viewport(740, 360);
    dialog().scrollTop = dialog().scrollHeight;
    const header = dialog().querySelector('.dialog-header')!.getBoundingClientRect();
    expect(header.top).toBeGreaterThanOrEqual(0);
    const close = dialog().querySelector('.dialog-close')!.getBoundingClientRect();
    expect(close.top).toBeGreaterThanOrEqual(header.top);
    expect(close.bottom).toBeLessThanOrEqual(header.bottom);
  });

  test('axe is clean with the dialog open, light and dark, desktop and phone, English and French', async () => {
    const screen = await render(Fixture, { lang: 'en' });
    await openFromKeyboard();
    await expectAxeClean();
    await screen.rerender({ lang: 'fr' });
    await expectAxeCleanHere();
    await withMedia([{ name: 'prefers-contrast', value: 'more' }], async () => {
      expect(matchMedia('(prefers-contrast: more)').matches).toBe(true);
      await expectAxeCleanHere();
    });
  });

  test('reduced motion keeps no scale, forced colours keep an edge', async () => {
    render(Fixture, { lang: 'en' });
    await withMedia([{ name: 'prefers-reduced-motion', value: 'reduce' }], async () => {
      await openFromKeyboard();
      expect(getComputedStyle(dialog()).transform).toBe('none');
      await closing(() => userEvent.keyboard('{Escape}'));
    });
    await withMedia([{ name: 'forced-colors', value: 'active' }], async () => {
      await openFromKeyboard();
      expect(getComputedStyle(dialog()).borderTopStyle).not.toBe('none');
      expect(getComputedStyle(dialog().querySelector('kbd')!).borderTopStyle).not.toBe('none');
    });
  });
});
