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
  assert.equal(volume.nearest([1.4,1.4,1.4]), 51);
  assert.equal(volume.nearest([1.6,1.6,1.6]), 102);
});

test('nontrivial affine preserves hemisphere, voxel centers and spacing', () => {
  const data = new Uint8Array(24); data[1+2*(2+3*3)] = 73;
  const volume = new Volume({shape:[2,3,4],order:'F',voxel_to_surface_ras_mm:
    [[-2,0,0,11],[0,0,4,-7],[0,-3,0,13],[0,0,0,1]]}, data);
  assert.equal(volume.nearest([9,5,7]),73);
  assert.equal(volume.linear([9,5,7]),73);
  assert.throws(() => new Volume({shape:[2,3,4],order:'F',voxel_to_surface_ras_mm:identity}, new Uint8Array(1)), /length/i);
});
