import assert from 'node:assert/strict';
import test from 'node:test';
import { Volume } from './volume.js';

const identity = [[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]];
function ramp() {
  const data = new Uint8Array(64);
  for (let z=0; z<4; z++) for (let y=0; y<4; y++) for (let x=0; x<4; x++) {
    data[x+4*(y+4*z)] = x + 10*y + 40*z;
  }
  return new Volume({ shape:[4,4,4], voxel_to_surface_ras_mm:identity, order:'F' }, data);
}

test('MRI interpolation preserves a coordinate ramp and native voxel centers', () => {
  const volume = ramp();
  assert.equal(volume.linear([1,2,3]), 141);
  assert.equal(volume.linear([1.5,1.5,1.5]), 76.5);
  assert.equal(volume.linear([3,3,3]), 153);
  assert.equal(volume.linear([-1,0,0]), 0);
});

test('segmentation sampling never invents intermediate labels', () => {
  const volume = ramp();
  assert.equal(volume.label([1.4,1.4,1.4]), 51);
  assert.equal(volume.label([1.6,1.6,1.6]), 102);
  // Eight different labels weigh the same here; the lowest corner wins.
  assert.equal(volume.label([1.5,1.5,1.5]), 51);
});

function corner(labels) {
  return new Volume({ shape:[2,2,2], voxel_to_surface_ras_mm:identity, order:'F' },
    new Uint8Array(labels));
}

test('a label boundary runs between voxel centres rather than along the voxel grid', () => {
  // Voxels (0,0,*) are 4; the other six are 9. The nearest centre is a 4, but
  // 9 holds most of the weight here: the 4s' corner is rounded off.
  const volume = corner([4,9,9,9, 4,9,9,9]);
  assert.equal(volume.label([0.4,0.4,0.5]), 9);
  assert.equal(volume.label([0.2,0.2,0.5]), 4);
});

test('every voxel centre keeps its own label', () => {
  const volume = corner([4,9,9,9, 9,9,9,9]);
  assert.equal(volume.label([0,0,0]), 4);
  assert.equal(volume.label([1,1,1]), 9);
});

test('outside the grid is background, weighed like any other label', () => {
  const volume = corner([7,7,7,7, 7,7,7,7]);
  assert.equal(volume.label([-0.4,0.5,0.5]), 7);
  assert.equal(volume.label([-0.6,0.5,0.5]), 0);
  assert.equal(volume.label([5,0,0]), 0);
});

test('nontrivial affine preserves hemisphere, voxel centers and spacing', () => {
  const data = new Uint8Array(24); data[1+2*(2+3*3)] = 73;
  const volume = new Volume({shape:[2,3,4],order:'F',voxel_to_surface_ras_mm:
    [[-2,0,0,11],[0,0,4,-7],[0,-3,0,13],[0,0,0,1]]}, data);
  assert.equal(volume.label([9,5,7]),73);
  assert.equal(volume.linear([9,5,7]),73);
  assert.throws(() => new Volume({shape:[2,3,4],order:'F',voxel_to_surface_ras_mm:identity}, new Uint8Array(1)), /length/i);
});
