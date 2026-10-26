import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';

/**
 * A small stand-in for `public/`, so the build plugin's tests do not hash the 325 MB published
 * tree. Its versions are the first 16 hex digits of each file's SHA-256 (`sha256sum`), written out
 * here as fixed values.
 */
export const FIXTURE_FILES = {
  'models/anatomies.json': { text: '{"default":"bert"}', version: 'c24aea467c0bc797' },
  'models/bert/manifest.json': { text: '{"atlases":[]}', version: 'b96049c398b69d08' },
  'models/bert/cortex-destrieux.glb': { text: 'glTF destrieux', version: '034abd800e367720' },
} as const;

/** `gzip` of "decoded tract" with a zero timestamp, and the versions of the file and its contents. */
export const FIXTURE_GZ = {
  path: 'diffusion/snail/tract.trk.gz',
  base64: 'H4sIAAAAAAAC/0tJTc5PSU1RKClKTC4BAG9TDeQNAAAA',
  version: '08b387294bbf61f1',
  contentsVersion: '3c777d4653085577',
} as const;

export function createPublishedFixture(): string {
  const directory = mkdtempSync(resolve(tmpdir(), 'planum-public-'));
  const write = (path: string, contents: string | Buffer) => {
    mkdirSync(dirname(resolve(directory, path)), { recursive: true });
    writeFileSync(resolve(directory, path), contents);
  };
  for (const [path, { text }] of Object.entries(FIXTURE_FILES)) write(path, text);
  write(FIXTURE_GZ.path, Buffer.from(FIXTURE_GZ.base64, 'base64'));
  return directory;
}
