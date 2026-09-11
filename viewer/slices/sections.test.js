import assert from 'node:assert/strict';
import test from 'node:test';
import { Raycaster, Vector3 } from 'three';
import { BrainSections } from './sections.js';
import { Volume } from './volume.js';

function fixture() {
  const region = {id:'aseg:left:10',kind:'structure',source_label_id:10};
  const model = {
    planes: [], regions:new Map([[region.id,region]]), visibleMeshes:[{userData:{region_id:region.id}}],
    setClippingPlanes(planes) { this.planes = planes; }, intersect() { return null; },
  };
  const sections = new BrainSections(model, new URL('https://example.invalid/volumes.json'));
  const metadata={shape:[4,4,4],order:'F',voxel_to_surface_ras_mm:[[1,0,0,-2],[0,1,0,-2],[0,0,1,-2],[0,0,0,1]]};
  sections.volumes = {mri:new Volume(metadata,new Uint8Array(64).fill(100)),
    segmentation:new Volume(metadata,new Uint16Array(64).fill(10)),metadata:{labels:{0:{name:'Unknown',color:[0,0,0]},10:{name:'Thalamus',color:[255,0,0]}}}};
  sections.display={fieldOfView:4,size:4,windowCenter:90,windowWidth:180};
  sections.state.status='ready';
  sections.createFace();
  return {model,sections,region};
}

test('section face stays exactly on its clipping plane at fractional positions', async () => {
  const {sections,model}=fixture();
  await sections.setMode('coronal');
  sections.setOffset(.5);
  assert.deepEqual(sections.face.position.toArray(),[0,0,-.0005]);
  assert.ok(Math.abs(model.planes[0].distanceToPoint(sections.face.position))<1e-12);
  sections.setDisplay({reverse:true});
  assert.ok(model.planes[0].distanceToPoint(new Vector3(0,0,-.001))>0);
  await sections.setMode('off');
  assert.equal(sections.group.visible,false);
  assert.deepEqual(model.planes,[]);
  sections.dispose();
});

test('MRI face selects original segmentation label and occludes deeper surface', async () => {
  const {sections,model,region}=fixture();
  await sections.setMode('axial');
  const ray=new Raycaster(new Vector3(0,.01,0),new Vector3(0,-1,0));
  assert.equal(sections.pick(ray).id,region.id);
  model.visibleMeshes=[];
  assert.equal(sections.pick(ray),null);
  sections.dispose();
});

test('latest cut request wins if MRI load was still pending', async () => {
  const {sections}=fixture();
  let resolve;
  sections.load=()=>new Promise(done=>{resolve=done;});
  const loading=sections.setMode('coronal');
  await sections.setMode('off');
  resolve(); await loading;
  assert.equal(sections.state.mode,'off');
  sections.dispose();
});

test('oblique offsets are independent of a distant orthogonal crosshair', async () => {
  const {sections}=fixture();
  await sections.setMode('oblique');
  sections.setAngles(45,0);
  sections.setCrosshair([100,0,-100]);
  sections.setOffset(60);
  assert.ok(sections.state.crosshair.every(value=>Math.abs(value)<=128));
  assert.ok(Math.abs(new Vector3(...sections.state.crosshair).dot(sections.frame.normal)-60)<1e-10);
  sections.dispose();
});
