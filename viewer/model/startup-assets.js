import { decodeState } from '../state/url-state.js';

/**
 * The files the first paint needs, named from the URL hash before the
 * manifest has been read.
 *
 * Filenames here are the published names, not a second source of truth: a
 * shared link that names an atlas this build does not carry still starts the
 * default download, and `BrainAtlas.load` replaces it from the manifest.
 *
 * `anatomies.json` is always first: until it has been read there is no way to
 * know which brain a link without an `anatomy` means, and guessing would
 * download the wrong one.
 */
export function startupAssets(hash, base = '/', published) {
  const wanted = decodeState(hash);
  const root = base.endsWith('/') ? base : `${base}/`;
  const brain = wanted.anatomy ?? published;
  if (!brain) return [`${root}models/anatomies.json`];
  const cortex = wanted.atlas === 'hcp-mmp' ? 'cortex-hcp-mmp.glb' : 'cortex-destrieux.glb';
  const interior = { aseg: 'structures.glb', nextbrain: 'nextbrain.glb', learning: 'learning.glb' }[wanted.detail] ?? 'learning.glb';
  return [
    `${root}models/anatomies.json`,
    `${root}models/${brain}/manifest.json`,
    `${root}models/${brain}/${cortex}`,
    `${root}models/${brain}/${interior}`,
    `${root}models/${brain}/spinal-cord.glb`,
  ];
}
