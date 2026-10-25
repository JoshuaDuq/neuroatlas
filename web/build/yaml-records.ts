import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';
import { parse } from 'yaml';

/**
 * The clinical data is authored as YAML and read once, at startup.
 * Parsing it here means the bundle carries the records rather than a
 * YAML parser and 400 lines of source text for it to chew through.
 */
export function yamlRecords(): Plugin {
  return {
    name: 'yaml-records',
    enforce: 'pre',
    load(id) {
      const file = id.split('?')[0];
      if (!file.endsWith('.yaml')) return null;
      return `export default ${JSON.stringify(parse(readFileSync(file, 'utf8')))};`;
    },
  };
}
