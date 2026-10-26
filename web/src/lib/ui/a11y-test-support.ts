// Shared by the U3 component browser tests: axe-core in both themes and at phone width, and
// forced-colour emulation. Imports the real stylesheets so contrast is measured on real tokens.
import type {} from '@vitest/browser-playwright';
import axe from 'axe-core';
import { expect } from 'vitest';
import { cdp, page } from 'vitest/browser';
import '../../styles/index.css';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];

/** axe (wcag2a/aa, 21aa, 22aa) on what is rendered now, in one theme and at one width. */
export async function expectAxeCleanOnce(
  theme: 'light' | 'dark',
  width: 1280 | 390,
): Promise<void> {
  const root = document.documentElement;
  // Colour transitions would let axe read a half-way colour on a slow runner.
  const still = document.head.appendChild(document.createElement('style'));
  still.textContent = '*, *::before, *::after { transition: none !important; }';
  try {
    root.dataset.theme = theme;
    await page.viewport(width, width === 1280 ? 800 : 844);
    // A component fixture has no landmarks; page-level rules are the integration chunks' job.
    const results = await axe.run(document.body, {
      runOnly: TAGS,
      rules: { region: { enabled: false } },
    });
    expect(
      results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' ')}`),
      `${theme} ${width}px`,
    ).toEqual([]);
  } finally {
    still.remove();
    delete root.dataset.theme;
    await page.viewport(1280, 800);
  }
}

/** axe on what is rendered now: light and dark, desktop and 390 px. */
export async function expectAxeClean(): Promise<void> {
  for (const theme of ['light', 'dark'] as const) {
    for (const width of [1280, 390] as const) await expectAxeCleanOnce(theme, width);
  }
}

/** Runs `check` with the browser emulating a media feature, then restores it. */
export async function withMedia(
  features: { name: string; value: string }[],
  check: () => void | Promise<void>,
): Promise<void> {
  const session = cdp();
  await session.send('Emulation.setEmulatedMedia', { features });
  try {
    await check();
  } finally {
    await session.send('Emulation.setEmulatedMedia', {
      features: features.map((f) => ({ ...f, value: '' })),
    });
  }
}
