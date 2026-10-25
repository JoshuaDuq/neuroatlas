/// <reference types="node" />
import { createHash } from 'node:crypto';
import { afterEach, vi } from 'vitest';
import PUBLISHED, { type PublishedRecord } from './published-files.ts';

/** Test-only helpers: publish a file map for the test, and put the unpublished state back after it. */
afterEach(() => {
  Object.assign(PUBLISHED, { base: '/', files: null });
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete globalThis.__planumAssets;
});

export const sha256 = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');

export function publish(files: Record<string, PublishedRecord>): void {
  Object.assign(PUBLISHED, { base: '/neuroatlas/', files });
}

export function recordOf(bytes: Uint8Array): PublishedRecord {
  const digest = sha256(bytes);
  return { version: digest.slice(0, 16), sha256: digest, size: bytes.byteLength };
}
