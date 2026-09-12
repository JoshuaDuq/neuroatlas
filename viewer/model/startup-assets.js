import { decodeState } from '../state/url-state.js';

/**
 * The files the first paint needs, named from the URL hash before the
 * manifest has been read.
 *
 * Filenames here are the published names, not a second source of truth: a
 * shared link that names an atlas this build does not carry still starts the
 * default download, and `BrainAtlas.load` replaces it from the manifest.
 */
export function startupAssets(hash, base = '/') {
  const wanted = decodeState(hash);
  const root = base.endsWith('/') ? base : `${base}/`;
  const cortex = wanted.atlas === 'hcp-mmp' ? 'cortex-hcp-mmp.glb' : 'cortex-destrieux.glb';
  const interior = wanted.detail === 'aseg' ? 'structures.glb' : 'nextbrain.glb';
  return [
    `${root}models/manifest.json`,
    `${root}models/${cortex}`,
    `${root}models/${interior}`,
  ];
}
