// The stage status against the legacy paintLoadProgress and update() cases
// (viewport-chrome.js:63-83, 763-781), the failure screen of main.js:43-60, and the focus and
// announcement rules of the H1b decision record (#39).
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-svelte';
import { reloadWithoutStoredModels } from '../../lib/core/assets/published-assets.ts';
import { expectAxeClean, withMedia } from '../../lib/ui/a11y-test-support.ts';
import Fixture from './stage-status-test-support.svelte';

vi.mock('../../lib/core/assets/published-assets.ts', () => ({
  reloadWithoutStoredModels: vi.fn(),
}));

const announced = () => document.getElementById('announcer')!.textContent;
const message = () => document.getElementById('stage-message');
const progressbar = () => document.querySelector('progress');
const retry = (name = 'Retry') => page.getByRole('button', { name, exact: true });

beforeEach(async () => {
  await page.viewport(1280, 800);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  history.replaceState(null, '', location.pathname + location.search);
});

describe('loading', () => {
  test('without a total it says so and shows no bar', async () => {
    await render(Fixture, { status: 'loading' });
    expect(message()!.textContent?.trim()).toBe('Loading anatomy…');
    expect(progressbar()).toBeNull();
  });

  test('with a total it shows a named determinate bar and the megabytes', async () => {
    await render(Fixture, {
      status: 'loading',
      progress: { loaded: 12.3 * 1_048_576, total: 45.6 * 1_048_576 },
    });
    const bar = page.getByRole('progressbar', { name: 'Anatomy download' });
    await expect.element(bar).toBeVisible();
    expect(progressbar()!.value).toBe(27);
    expect(progressbar()!.max).toBe(100);
    expect(message()!.textContent).toContain('Loading anatomy');
    expect(message()!.textContent).toContain('12.3');
    expect(message()!.textContent).toContain('45.6');
  });

  test('the value is written only when the rounded percent changes; the message follows every event', async () => {
    const MB = 1_048_576;
    const total = 100 * MB;
    const view = await render(Fixture, {
      status: 'loading',
      progress: { loaded: 10 * MB, total },
    });
    const writes: (string | null)[] = [];
    new MutationObserver((records) => {
      for (const record of records) writes.push(record.attributeName);
    }).observe(progressbar()!, { attributes: true, attributeFilter: ['value'] });
    const messages = [message()!.textContent];
    // 10 % for the first five events, 11 % for the last.
    for (const loaded of [10.1, 10.2, 10.3, 10.4, 11]) {
      await view.rerender({ progress: { loaded: loaded * MB, total } });
      messages.push(message()!.textContent);
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(writes).toEqual(['value']);
    expect(progressbar()!.value).toBe(11);
    expect(new Set(messages).size).toBe(messages.length);
  });

  test('has no Retry, and the bar leaves when the total is unknown', async () => {
    const view = await render(Fixture, { status: 'loading', progress: { loaded: 1, total: 10 } });
    await expect.element(retry()).not.toBeInTheDocument();
    await view.rerender({ progress: { loaded: 1, total: 0 } });
    expect(progressbar()).toBeNull();
  });

  test('speaks when the load starts and ends, and never per progress event', async () => {
    const view = await render(Fixture, { status: 'loading' });
    expect(announced()).toBe('Loading anatomy…');
    const seen: string[] = [];
    new MutationObserver(() => seen.push(announced()!)).observe(
      document.getElementById('announcer')!,
      {
        childList: true,
        characterData: true,
        subtree: true,
      },
    );
    for (const loaded of [1, 2, 3, 4]) {
      await view.rerender({ progress: { loaded, total: 10 } });
    }
    expect(seen).toEqual([]);
    await view.rerender({ status: 'ready' });
    expect(announced()).toBe('Anatomy loaded.');
    expect(message()).toBeNull();
  });

  test('is in French under French', async () => {
    await render(Fixture, {
      status: 'loading',
      lang: 'fr',
      progress: { loaded: 1_048_576, total: 4_194_304 },
    });
    await expect
      .element(page.getByRole('progressbar', { name: 'Téléchargement de l’anatomie' }))
      .toBeVisible();
    expect(message()!.textContent).toContain('Chargement de l’anatomie');
    expect(message()!.textContent).toContain('1,0');
  });
});

describe('error', () => {
  const download = {
    text: 'Could not load the anatomy. A file could not be downloaded. Check the connection and try again.',
    button: 'Retry',
  };

  test('shows the failure in danger ink with a tonal Retry, announced once', async () => {
    await render(Fixture, { status: 'error', failure: download });
    expect(message()!.textContent?.trim()).toBe(download.text);
    expect(announced()).toBe(download.text);
    await expect.element(retry()).toBeVisible();
    expect(progressbar()).toBeNull();
    expect(getComputedStyle(message()!).color).not.toBe(
      getComputedStyle(document.querySelector('.stage-status')!).backgroundColor,
    );
  });

  test('a capability error has no Retry', async () => {
    await render(Fixture, { status: 'error', failure: { text: 'This viewer needs WebGL 2.' } });
    expect(message()!.textContent?.trim()).toBe('This viewer needs WebGL 2.');
    expect(document.querySelectorAll('.stage-status button')).toHaveLength(0);
  });

  test('an error without a failure says the generic text, with Retry', async () => {
    await render(Fixture, { status: 'error' });
    expect(message()!.textContent?.trim()).toBe('Something went wrong.');
    await expect.element(retry()).toBeVisible();
  });

  test('Enter and Space on Retry reload without the stored anatomy, keeping the link', async () => {
    history.replaceState(null, '', `${location.pathname}${location.search}#tab=functions`);
    await render(Fixture, { status: 'error', failure: download });
    (retry().element() as HTMLElement).focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(reloadWithoutStoredModels).toHaveBeenCalledTimes(2);
    expect(location.hash).toBe('#tab=functions');
  });

  test('Retry after a failed link drops the hash, then reloads', async () => {
    history.replaceState(null, '', `${location.pathname}${location.search}#region=nope&lang=fr`);
    await render(Fixture, {
      status: 'error',
      failure: { text: 'Could not open this link.', button: 'Retry', dropLink: true },
    });
    await retry().click();
    expect(location.hash).toBe('');
    expect(reloadWithoutStoredModels).toHaveBeenCalledTimes(1);
  });

  test('the new-deploy failure offers Reload', async () => {
    await render(Fixture, {
      status: 'error',
      failure: { text: 'Planum was updated. Reload to continue.', button: 'Reload' },
    });
    await retry('Reload').click();
    expect(reloadWithoutStoredModels).toHaveBeenCalledTimes(1);
  });

  test('Retry is the Tab stop after the hidden dock, and at least 24 px', async () => {
    await render(Fixture, { status: 'error', failure: download });
    await userEvent.tab();
    expect(document.activeElement).toBe(retry().element());
    const box = (retry().element() as HTMLElement).getBoundingClientRect();
    expect(box.height).toBeGreaterThanOrEqual(24);
  });
});

describe('context lost', () => {
  test('says the view was interrupted, with no Retry and no bar, announced once', async () => {
    await render(Fixture, { status: 'context-lost' });
    expect(message()!.textContent?.trim()).toBe(
      'The 3D view was interrupted by the graphics driver. Restoring…',
    );
    expect(announced()).toBe(message()!.textContent?.trim());
    expect(document.querySelectorAll('.stage-status button')).toHaveLength(0);
    expect(progressbar()).toBeNull();
  });

  test('restoring says the anatomy is loaded and hides the stage', async () => {
    const view = await render(Fixture, { status: 'context-lost' });
    await view.rerender({ status: 'ready' });
    expect(announced()).toBe('Anatomy loaded.');
    expect(message()).toBeNull();
  });
});

describe('focus', () => {
  test('a status that hides the focused control takes focus, and gives it back', async () => {
    const view = await render(Fixture, { status: 'ready' });
    const dock = document.getElementById('dock-tool')!;
    dock.focus();
    await view.rerender({ status: 'context-lost' });
    await vi.waitFor(() => expect(document.activeElement).toBe(message()));
    await view.rerender({ status: 'ready' });
    await vi.waitFor(() => expect(document.activeElement).toBe(dock));
  });

  test('on error, focus goes to Retry', async () => {
    const view = await render(Fixture, { status: 'ready' });
    document.getElementById('dock-tool')!.focus();
    await view.rerender({ status: 'error', failure: { text: 'Failed.', button: 'Retry' } });
    await vi.waitFor(() => expect(document.activeElement).toBe(retry().element()));
  });

  test('a control the status does not hide keeps focus, and focus is not stolen at boot', async () => {
    const outside = document.body.appendChild(document.createElement('button'));
    outside.textContent = 'Elsewhere';
    try {
      const view = await render(Fixture, { status: 'loading' });
      expect(document.activeElement).toBe(document.body);
      await view.rerender({ status: 'ready' });
      outside.focus();
      await view.rerender({ status: 'error', failure: { text: 'Failed.', button: 'Retry' } });
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(document.activeElement).toBe(outside);
    } finally {
      outside.remove();
    }
  });
});

describe('accessibility', () => {
  const states = [
    { status: 'loading', progress: { loaded: 12 * 1_048_576, total: 45 * 1_048_576 } },
    { status: 'error', failure: { text: 'Could not load the anatomy.', button: 'Retry' } },
    { status: 'error', failure: { text: 'This viewer needs WebGL 2.' } },
    { status: 'context-lost' },
  ] as const;

  test.each(
    states.map(
      (state) =>
        [
          state.status +
            ('failure' in state && !('button' in state.failure) ? ' (capability)' : ''),
          state,
        ] as const,
    ),
  )('axe is clean in light and dark, desktop and phone, English: %s', async (_name, state) => {
    await render(Fixture, { ...state, lang: 'en' });
    await expectAxeClean();
  });

  test('axe is clean in French', async () => {
    await render(Fixture, { status: 'context-lost', lang: 'fr' });
    await expectAxeClean();
  });

  test('forced colours keep the message and the bar visible', async () => {
    await render(Fixture, { status: 'loading', progress: { loaded: 1, total: 4 } });
    await withMedia([{ name: 'forced-colors', value: 'active' }], async () => {
      await expect.element(page.getByRole('progressbar')).toBeVisible();
      expect(getComputedStyle(message()!).color).toBe(
        getComputedStyle(document.querySelector('.stage-status')!).color,
      );
    });
  });

  test('a 320 px viewport reflows the message and keeps Retry in view', async () => {
    await page.viewport(320, 256);
    await render(Fixture, {
      status: 'error',
      failure: {
        text: 'Could not load the anatomy. A file could not be downloaded.',
        button: 'Retry',
      },
    });
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
      document.documentElement.clientWidth,
    );
    const box = (retry().element() as HTMLElement).getBoundingClientRect();
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(320);
  });

  test('on a phone the message sits in the upper part of the stage', async () => {
    await page.viewport(390, 844);
    await render(Fixture, { status: 'error', failure: { text: 'Failed.', button: 'Retry' } });
    const box = (retry().element() as HTMLElement).getBoundingClientRect();
    expect(box.bottom).toBeLessThan(844 / 2);
  });
});
