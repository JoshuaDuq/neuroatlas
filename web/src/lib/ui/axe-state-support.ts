// One axe run on what is rendered now, in one theme and at one width. `expectAxeClean` runs the
// four theme x width combinations; a state whose DOM does not change with them needs only one.
import type {} from '@vitest/browser-playwright';
import axe from 'axe-core';
import { expect } from 'vitest';
import { page } from 'vitest/browser';
import '../../styles/index.css';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];

export async function expectAxeCleanOnce(theme: 'light' | 'dark', width: 1280 | 390) {
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
