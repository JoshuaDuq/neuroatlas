import { describe, expect, it } from 'vitest';
import { ASSET_BASE, PREVIEW_BASE, siteBase } from './site.ts';

describe('site base', () => {
  it('serves the live path in development and builds, the preview path for build:preview', () => {
    expect(siteBase('development')).toBe(ASSET_BASE);
    expect(siteBase('production')).toBe(ASSET_BASE);
    expect(siteBase('preview')).toBe(PREVIEW_BASE);
  });
});
