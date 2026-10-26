import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { repoRoot } from '../../../../test/repo.ts';

const reads = new Map<string, Promise<{ url: string; buffer: ArrayBuffer }>>();

/** Serve `public/diffusion/` from disk, so the outline and the bundles load in Node; each file is read once. */
export function readPublishedDiffusion(file: string) {
  if (!reads.has(file)) {
    reads.set(
      file,
      readFile(resolve(repoRoot, 'public/diffusion', file)).then((bytes) => ({
        url: file,
        buffer: bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ) as ArrayBuffer,
      })),
    );
  }
  // A fresh copy each time: the loaders may transfer or detach what they are given.
  return reads.get(file)!.then(({ url, buffer }) => ({ url, buffer: buffer.slice(0) }));
}
