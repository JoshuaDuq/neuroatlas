// The app shell: landmarks and their order, the skip link, and the data-status cascade.
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { expectAxeClean } from '../lib/ui/a11y-test-support.ts';
import type { Language, SessionState } from '../lib/types/index.ts';
import App from './App.svelte';

let target: HTMLElement;
let app: Record<string, unknown>;
let props = $state<{ status?: SessionState['status']; lang?: Language }>({});

/** `#app` is the mount point of index.html; the shell sets its data-status and lays it out. */
function mountShell(shellProps: typeof props = {}) {
  Object.assign(props, shellProps);
  app = mount(App, { target, props });
  flushSync();
}

beforeEach(async () => {
  // The test frame is phone-sized by default.
  await page.viewport(1280, 800);
  target = document.body.appendChild(document.createElement('div'));
  target.id = 'app';
  target.dataset.status = 'loading';
  for (const key of Object.keys(props)) delete props[key as keyof typeof props];
});
afterEach(() => {
  unmount(app);
  target.remove();
  history.replaceState(null, '', location.pathname);
});

const skipLink = (name = 'Skip to model') => page.getByRole('link', { name, exact: true });

describe('landmarks', () => {
  test('one banner, complementary, main and contentinfo, in that order', async () => {
    mountShell();
    const landmarks = [...target.querySelectorAll('header, aside, main, footer')].map(
      (element) => element.tagName,
    );
    expect(landmarks).toEqual(['HEADER', 'ASIDE', 'MAIN', 'FOOTER']);
    for (const role of ['banner', 'complementary', 'main', 'contentinfo']) {
      await expect.element(page.getByRole(role)).toBeInTheDocument();
    }
    expect(document.querySelectorAll('nav')).toHaveLength(0);
  });

  test('the complementary landmark is named in the reader’s language', async () => {
    mountShell({ lang: 'fr' });
    await expect
      .element(page.getByRole('complementary', { name: 'Détails anatomiques' }))
      .toBeInTheDocument();
  });

  test('the footer is gone on a phone, where the sheet carries its text', async () => {
    mountShell();
    await page.viewport(390, 844);
    try {
      expect(getComputedStyle(target.querySelector('footer')!).display).toBe('none');
      expect(getComputedStyle(target.querySelector('aside')!).display).toBe('contents');
    } finally {
      await page.viewport(1280, 800);
    }
  });
});

describe('skip link', () => {
  test('is the first Tab stop, clipped until focused, in the reader’s language', async () => {
    mountShell({ lang: 'fr' });
    const link = skipLink('Aller au modèle').element() as HTMLElement;
    expect(link.getBoundingClientRect().width).toBeLessThanOrEqual(1);
    await userEvent.tab();
    expect(document.activeElement).toBe(link);
    const box = link.getBoundingClientRect();
    expect(box.width).toBeGreaterThan(24);
    expect(box.height).toBeGreaterThanOrEqual(24);
  });

  test('Enter focuses the canvas and leaves the link state alone', async () => {
    mountShell();
    const canvas = target.querySelector('main')!.appendChild(document.createElement('canvas'));
    canvas.tabIndex = 0;
    location.hash = '#tab=functions';
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(document.activeElement).toBe(canvas);
    expect(location.hash).toBe('#tab=functions');
  });

  test('Enter focuses the main landmark while no canvas can take focus', async () => {
    mountShell();
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(document.activeElement).toBe(target.querySelector('main'));
    // A canvas that is not focusable leaves focus on main as well.
    target.querySelector('main')!.appendChild(document.createElement('canvas'));
    await userEvent.tab({ shift: true });
    await userEvent.keyboard('{Enter}');
    expect(document.activeElement).toBe(target.querySelector('main'));
  });

  test('is present on the error screen', async () => {
    mountShell({ status: 'error' });
    await expect.element(skipLink()).toBeInTheDocument();
  });

  test('passes axe focused, in both themes and at phone width', async () => {
    mountShell();
    await userEvent.tab();
    await expectAxeClean();
  });
});

describe('data-status', () => {
  test('follows the status on the mount point, from loading', async () => {
    mountShell();
    expect(target.dataset.status).toBe('loading');
    for (const status of ['ready', 'switching', 'error', 'context-lost'] as const) {
      props.status = status;
      flushSync();
      expect(target.dataset.status).toBe(status);
    }
  });
});
