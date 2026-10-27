// Source text for the style tests. Read from disk because Vitest blanks `?raw` imports of .css files.
import { readdirSync, readFileSync } from 'node:fs';

const webRoot = new URL('../../', import.meta.url);

const read = (url: URL) => readFileSync(url, 'utf8');

/** The stylesheets of src/styles, keyed by file name. */
export const sheets: Record<string, string> = Object.fromEntries(
  readdirSync(new URL('src/styles/', webRoot))
    .filter((name) => name.endsWith('.css'))
    .map((name) => [name, read(new URL(`src/styles/${name}`, webRoot))]),
);

/** Every Svelte component under src/, keyed by path relative to src/. */
export const components: Record<string, string> = Object.fromEntries(
  readdirSync(new URL('src/', webRoot), { recursive: true })
    .map(String)
    .filter((path) => path.endsWith('.svelte'))
    .map((path) => [path, read(new URL(`src/${path}`, webRoot))]),
);

/** The stage's token mapping (stage-vars.css), which restates the panel tokens over the overlay palette. */
export const stageVars = read(new URL('src/features/stage/stage-vars.css', webRoot));

export const main = read(new URL('src/main.ts', webRoot));

export const fontsource = read(
  new URL('node_modules/@fontsource-variable/source-sans-3/wght.css', webRoot),
);
