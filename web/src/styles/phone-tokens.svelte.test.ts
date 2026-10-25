import { afterEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import './index.css';

const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name);

describe('phone tokens (viewer/styles/phone.css:15)', () => {
  afterEach(() => page.viewport(1280, 800));

  test('touch sizes at 390 px wide', async () => {
    await page.viewport(390, 844);
    expect(token('--control-height')).toBe('44px');
    expect(token('--row-height')).toBe('44px');
    expect(token('--tab-height')).toBe('44px');
    expect(token('--header-height')).toBe('max(52px, 3.25rem)');
    expect(token('--panel-inset')).toBe('16px');
  });

  test('a landscape phone (812 by 375) gets them too', async () => {
    await page.viewport(812, 375);
    expect(token('--control-height')).toBe('44px');
  });

  test('desktop keeps instrument density', async () => {
    await page.viewport(1280, 800);
    expect(token('--control-height')).toBe('32px');
    expect(token('--row-height')).toBe('32px');
  });
});
