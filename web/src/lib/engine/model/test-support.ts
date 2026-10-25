import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { readModel } from '../../core/catalog/test-support.ts';
import type { AtlasManifest, GlbLoader } from './brain-atlas.ts';

/** A published anatomy's directory under `public/models/`. */
export const modelDirectory = (id: string) =>
  new URL(`../../../../../public/models/${id}/`, import.meta.url);

/** The manifest an anatomy publishes, as the model reads it. */
export const readManifest = (id: string) => readModel<AtlasManifest>(`${id}/manifest.json`);

/** Parse each GLB from the published directory rather than over the network. */
export function publishedLoader(directory: URL, onLoad?: (file: string) => void): GlbLoader {
  const gltf = new GLTFLoader();
  return {
    async loadAsync(file) {
      onLoad?.(file);
      const bytes = await readFile(new URL(file, directory));
      return gltf.parseAsync(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
        '',
      );
    },
  };
}
