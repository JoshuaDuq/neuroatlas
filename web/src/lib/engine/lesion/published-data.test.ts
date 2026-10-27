import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { NVMeshLoaders } from '@niivue/niivue';
import { test } from 'vitest';
import { readRepoJson, repoRoot } from '../../../../test/repo.ts';
import type { TissueMetadata } from '../tissues/gpu-sections.ts';
import { Volume } from '../slices/volume.ts';
import type { VolumeFile } from '../slices/volume.ts';
import { labelTotals, regionsInSphere, streamlinesCrossing, tissueInSphere } from './measure.ts';

/*
 * The expected figures come from an independent NumPy measurement of the same published files
 * (voxel centres through the affine, every streamline point through `scanner_ras_to_surface_ras`):
 * a 15 mm lesion at the left temporoparietal junction of CDMD sub_013.
 */
const sphere = { centre: [-45, -25, 30], radius: 15 } as const;
const models = 'public/models/cdmd/';
const metadata = readRepoJson<TissueMetadata>(`${models}tissue-labels.json`);

function read(record: VolumeFile): Volume {
  const bytes = gunzipSync(readFileSync(resolve(repoRoot, models, record.file)));
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const data = record.dtype === '<u2' ? new Uint16Array(buffer) : new Uint8Array(buffer);
  return new Volume(record, data);
}

test('a lesion measures on the published label volumes as NumPy measures it', () => {
  const destrieux = metadata.atlases['destrieux']!;
  const volume = read(destrieux);
  assert.deepEqual(tissueInSphere(volume, destrieux.labels, sphere), {
    cortex: 5693,
    white: 7069,
    deep: 0,
    fluid: 1127,
    outside: 258,
  });
  const regions = regionsInSphere(volume, destrieux.labels, sphere, labelTotals(volume));
  assert.deepEqual(regions.get('destrieux:left:41'), { inside: 964, whole: 1181 });
  assert.deepEqual(regions.get('destrieux:left:38'), { inside: 9, whole: 5293 });

  const hcp = metadata.atlases['hcp-mmp']!;
  const hcpVolume = read(hcp);
  assert.deepEqual(
    regionsInSphere(hcpVolume, hcp.labels, sphere, labelTotals(hcpVolume)).get('hcp-mmp:left:139'),
    { inside: 732, whole: 851 },
  );

  const white = metadata.white_matter!;
  const whiteVolume = read(white);
  const labels = white.labels.map(({ region_id }) => ({
    kind: 'tissue',
    region_id: region_id ?? null,
  }));
  assert.deepEqual(
    regionsInSphere(whiteVolume, labels, sphere, labelTotals(whiteVolume)).get('wmparc:left:3031'),
    { inside: 2167, whole: 6520 },
  );
});

test('a lesion crosses the published arcuate streamlines as NumPy counts them', async () => {
  const space = readRepoJson<{ scanner_ras_to_surface_ras: number[][] }>(
    'public/diffusion/cdmd-sub-013/surface-space.json',
  );
  const shift = space.scanner_ras_to_surface_ras.slice(0, 3).map((row) => row[3]!);
  const bytes = gunzipSync(
    readFileSync(resolve(repoRoot, 'public/diffusion/cdmd-sub-013/af.left.trk.gz')),
  );
  const tract = await NVMeshLoaders.readTRK(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
  const centre = sphere.centre.map((value, axis) => value - shift[axis]!) as [
    number,
    number,
    number,
  ];
  assert.equal(tract.offsetPt0.length - 1, 3639);
  assert.equal(streamlinesCrossing(tract.pts, tract.offsetPt0, { centre, radius: 15 }), 3025);
});
