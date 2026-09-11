import assert from 'node:assert/strict';
import test from 'node:test';
import { createFrame, pointOnFrame } from './coordinates.js';
import { renderSlice } from './sampling.js';
import { Volume } from './volume.js';

const affine = [[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]];
const metadata = {shape:[4,4,4], order:'F', voxel_to_surface_ras_mm:affine};
const data = new Uint8Array(64);
for (let z=0; z<4; z++) for (let y=0; y<4; y++) for (let x=0; x<4; x++) data[x+4*(y+4*z)]=x+10*y+40*z;
const volumes = {mri:new Volume(metadata,data), segmentation:new Volume(metadata,new Uint16Array(64).fill(1)),
  metadata:{labels:{1:{name:'Test',color:[255,0,0]}}}};
const display = {fieldOfView:4,size:4,windowCenter:127.5,windowWidth:255,overlay:false};

test('pixel centers, canvas top, and patient left/right agree in axial slices', () => {
  const frame = createFrame('axial',[1.5,1.5,1]);
  const pixels = renderSlice(volumes,frame,display);
  assert.deepEqual([...pixels.slice(0,4)], [70,70,70,255]);
  assert.deepEqual([...pixels.slice(-4)], [43,43,43,255]);
  assert.deepEqual(pointOnFrame(frame,.125,.125,4),[0,3,1]);
});

test('overlay preserves discrete source labels; background is transparent', () => {
  const frame = createFrame('axial',[1.5,1.5,1]);
  const pixels = renderSlice(volumes,frame,{...display,overlay:true});
  assert.ok(pixels[0]>pixels[1]);
  const outside = renderSlice(volumes,createFrame('axial',[1.5,1.5,9]),display);
  assert.equal(outside[3],0);
});
