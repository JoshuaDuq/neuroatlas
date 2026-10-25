/** The site's published path: the live viewer, and the development server. */
export const ASSET_BASE = '/neuroatlas/';

/** The Svelte build is previewed beside the live site until the cutover. */
export const PREVIEW_BASE = '/neuroatlas/next/';

/** `build:preview` publishes under the preview path; everything else uses the site path. */
export function siteBase(mode: string): string {
  return mode === 'preview' ? PREVIEW_BASE : ASSET_BASE;
}
