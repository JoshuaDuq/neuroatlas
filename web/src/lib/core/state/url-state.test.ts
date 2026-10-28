import assert from 'node:assert/strict';
import { test } from 'vitest';
import { Box3, Vector3 } from 'three';
import { cameraConstraints } from '../../engine/render/camera-views.ts';
import type { LinkInput, Orbit, Region } from '../../types/index.ts';
import {
  DEFAULTS,
  PARAMS,
  decodeState,
  encodeState,
  orbitWithin,
  towardZero,
} from './url-state.ts';

/** A link every field of which parses. */
function decoded(hash: string) {
  const { state, rejected } = decodeState(hash);
  assert.deepEqual(rejected, [], `${hash} should decode whole`);
  return state;
}

test('a shared dissection link round trips sorted hidden region identifiers', () => {
  const hiddenRegions = new Set(['destrieux:right:18', 'aseg:left:11']);
  const hash = encodeState({ hiddenRegions });
  assert.equal(hash, 'hidden=aseg:left:11,destrieux:right:18');
  assert.deepEqual(decoded(hash).hiddenRegions, ['aseg:left:11', 'destrieux:right:18']);
  assert.equal(encodeState({ hiddenRegions: new Set() }), '');
});

test('MRI appearance survives a shared URL', () => {
  assert.deepEqual(decoded(encodeState({ surfaceColor: 'mri' })), { surfaceColor: 'mri' });
});

test('a default view produces a bare URL carrying only the atlas', () => {
  assert.equal(
    encodeState({
      atlas: 'destrieux',
      hemisphere: 'both',
      cortexVisible: true,
      cortexOpacity: 1,
      surfaceColor: 'atlas',
      view: 'oblique',
      selectedRegion: null,
      isolatedRegion: null,
      explorer: 'anatomy',
      selectedDeficit: null,
      circuit: null,
      circuitStep: 0,
      orbit: null,
      mriWindow: null,
    }),
    'atlas=destrieux',
  );
});

test('everything that differs from the default survives a round trip', () => {
  const state: Partial<LinkInput> = {
    atlas: 'hcp-mmp',
    hemisphere: 'left',
    cortexVisible: false,
    cortexOpacity: 0.35,
    surfaceColor: 'network',
    view: 'superior',
    selectedRegion: 'aseg:left:11',
    isolatedRegion: 'aseg:left:11',
  };
  assert.deepEqual(decoded(encodeState(state)), state);
});

test('CAB-NP colours survive a round trip', () => {
  assert.deepEqual(decoded(encodeState({ surfaceColor: 'cab-np' })), { surfaceColor: 'cab-np' });
});

test('a link from the functional-division colouring keeps its other fields and names the colour it cannot show', () => {
  const { state, rejected } = decodeState('colors=functional&level=sections&opacity=0.5');
  assert.deepEqual(state, { cortexOpacity: 0.5 });
  assert.deepEqual(rejected, ['colors']);
});

test('tissue colors explicitly survive reload over the region default', () => {
  const saved = encodeState({ surfaceColor: 'tissue' });
  assert.equal(saved, 'colors=tissue');
  assert.equal({ surfaceColor: 'atlas', ...decoded(saved) }.surfaceColor, 'tissue');
});

test('links from when colors was a flag still open with the colouring they meant', () => {
  assert.deepEqual(decoded('#colors=1'), { surfaceColor: 'atlas' });
  assert.deepEqual(decoded('#colors=0'), { surfaceColor: 'tissue' });
});

test('a leading hash is accepted, because that is what location.hash gives', () => {
  assert.deepEqual(decoded('#atlas=destrieux'), { atlas: 'destrieux' });
});

test('empty links and unknown keys carry no scene state', () => {
  for (const hash of ['', '#', '???', '#=&=&', '#%%%%', '#unrelated=1']) {
    assert.deepEqual(
      decodeState(hash),
      { state: {}, rejected: [] },
      `${hash} should decode to nothing`,
    );
  }
});

test('an invalid field is named and left out, and the valid ones beside it still decode', () => {
  const invalid = {
    anatomy: ['', ' '],
    atlas: [''],
    cuts: [''],
    system: [''],
    detail: [''],
    region: [''],
    isolate: [''],
    view: [''],
    hemi: ['banana'],
    opacity: ['5', '-0.1', '', ' ', 'NaN', 'Infinity', 'true'],
    cortex: ['maybe'],
    internal: ['true'],
    cord: ['2'],
    colors: ['2', 'true'],
    cut: ['sideways'],
    pos: ['9999', '', ' '],
    tilt: ['91', '95'],
    az: ['181'],
    rev: ['yes'],
    lang: ['es', 'de'],
    tab: ['tracts', ''],
    deficit: [''],
    circuit: [''],
    step: ['0', '1.5', 'x'],
    cam: ['1,2,3', '1,2,3,4,5,x', '0,0,200000,0,0,0', '1,2,3,4,5,6,0,0,0'],
    mri: ['90', '300,100', '90,0'],
  };
  for (const [field, values] of Object.entries(invalid)) {
    const [beside, kept] =
      field === 'cord'
        ? ['hemi=left', { hemisphere: 'left' }]
        : ['cord=1', { spinalCordVisible: true }];
    for (const value of values) {
      const { state, rejected } = decodeState(`#${field}=${encodeURIComponent(value)}&${beside}`);
      assert.deepEqual(rejected, [field], `${field}=${value} must be rejected`);
      assert.deepEqual(state, kept, `${field}=${value} must not cost the field beside it`);
    }
  }
  assert.deepEqual(decodeState('#atlas').rejected, ['atlas']);
  assert.deepEqual(decodeState('#anatomy=snail&lang=de'), {
    state: { anatomy: 'snail' },
    rejected: ['lang'],
  });
});

test('the URL decoder requires a string hash', () => {
  for (const value of [null, 5, {}, []]) {
    assert.throws(() => decodeState(value as unknown as string), /string/i);
  }
});

test('duplicate fields are ambiguous: named and left out, never guessed', () => {
  assert.deepEqual(decodeState('#opacity=0.2&opacity=0.8&hemi=left'), {
    state: { hemisphere: 'left' },
    rejected: ['opacity'],
  });
  assert.deepEqual(decodeState('#hidden=a&hidden=b').rejected, ['hidden']);
  assert.deepEqual(decodeState('#hidden=a,,b').rejected, ['hidden']);
});

test('opacity survives at the edges of its range but not beyond', () => {
  assert.equal(decoded('#opacity=0').cortexOpacity, 0);
  assert.equal(decoded('#opacity=1').cortexOpacity, 1);
  assert.deepEqual(decodeState('#opacity=-0.1').rejected, ['opacity']);
});

test('atlas, region and view pass through as opaque strings', () => {
  // url-state cannot know which atlases or regions exist; link-check.js judges
  // those against the loaded anatomy.
  assert.deepEqual(decoded('#atlas=made-up&region=not:a:region&view=sideways'), {
    atlas: 'made-up',
    selectedRegion: 'not:a:region',
    view: 'sideways',
  });
});

test('region identifiers containing colons are not mangled', () => {
  const encoded = encodeState({ atlas: 'destrieux', selectedRegion: 'destrieux:left:75' });
  assert.equal(decoded(encoded).selectedRegion, 'destrieux:left:75');
});

test('the selected region encodes by id, even though state holds the object', () => {
  // BrainAtlas.state.selectedRegion is the region record, not its id. Encoding
  // it with String() produced "[object Object]" in the shareable link.
  const encoded = encodeState({
    atlas: 'destrieux',
    selectedRegion: { id: 'destrieux:left:29', label: 'Precentral gyrus' } as Region,
  });
  assert.equal(encoded, 'atlas=destrieux&region=destrieux:left:29');
  assert.equal(decoded(encoded).selectedRegion, 'destrieux:left:29');
});

test('a cut plane survives a shared link, and an uncut brain does not mention one', () => {
  assert.equal(encodeState({ atlas: 'destrieux', cut: 'off' }).includes('cut='), false);
  const sagittal: Partial<LinkInput> = {
    atlas: 'destrieux',
    cut: 'sagittal',
    cutOffset: 12.5,
    cutReverse: true,
  };
  assert.deepEqual(decoded(encodeState(sagittal)), sagittal);
  const oblique: Partial<LinkInput> = { cut: 'oblique', cutTilt: 10, cutAzimuth: -20 };
  assert.deepEqual(decoded(encodeState(oblique)), oblique);
  assert.deepEqual(decoded('#cut=off&pos=-512&tilt=0&az=-180&rev=0'), {
    cut: 'off',
    cutOffset: -512,
    cutTilt: 0,
    cutAzimuth: -180,
    cutReverse: false,
  });
  assert.deepEqual(decoded('#pos=512&tilt=90&az=180'), {
    cutOffset: 512,
    cutTilt: 90,
    cutAzimuth: 180,
  });
});

test('a written cut position is rounded toward zero, so it stays inside the range it came from', () => {
  assert.equal(towardZero(127.96), 127.9);
  assert.equal(towardZero(-127.96), -127.9);
  assert.equal(towardZero(12.3), 12.3);
  // 12.3 computed as a dot product can land a float error short of it.
  assert.equal(towardZero(12.299999999999), 12.3);
  assert.equal(encodeState({ cut: 'axial', cutOffset: 127.96 }), 'cut=axial&pos=127.9');
  assert.equal(encodeState({ cut: 'axial', cutOffset: -0.04 }), 'cut=axial&pos=0');
});

test('a system study survives sharing a link', () => {
  const state = decoded(encodeState({ detail: 'learning', internalSystem: 'Basal ganglia' }));
  assert.equal(state.detail, 'learning');
  assert.equal(state.internalSystem, 'Basal ganglia');
});

test('showing the spinal cord survives sharing a link', () => {
  const encoded = encodeState({ atlas: 'destrieux', spinalCordVisible: true });
  assert.equal(encoded, 'atlas=destrieux&cord=1');
  assert.equal(decoded(encoded).spinalCordVisible, true);
  assert.equal(decoded('#atlas=destrieux&cord=0').spinalCordVisible, false);
});

test('hiding internal anatomy survives sharing a link', () => {
  const encoded = encodeState({ atlas: 'destrieux', internalVisible: false });
  assert.equal(encoded, 'atlas=destrieux&internal=0');
  assert.equal(decoded(encoded).internalVisible, false);
  assert.equal(decoded('#atlas=destrieux&internal=1').internalVisible, true);
});

test('a default view omits the cord flag, because the cord is off', () => {
  assert.equal(encodeState({ atlas: 'destrieux', spinalCordVisible: false }), 'atlas=destrieux');
});

test('which brain travels in the link', () => {
  // Region ids are shared between brains on purpose: destrieux:left:6 names
  // the same parcel in each. A link that carries the region but not the brain
  // therefore opens the right region on someone else's anatomy.
  const encoded = encodeState({
    atlas: 'destrieux',
    anatomy: 'aomic',
    selectedRegion: 'destrieux:left:6',
  });
  assert.ok(encoded.includes('anatomy=aomic'));
  const back = decoded(encoded);
  assert.equal(back.anatomy, 'aomic');
  assert.equal(back.selectedRegion, 'destrieux:left:6');
});

test('a link naming no brain leaves the choice to the published default', () => {
  // Undefined, not a guess: the index decides, and it is read before anything
  // of a brain is fetched.
  assert.equal(decoded('#atlas=destrieux').anatomy, undefined);
  assert.ok(!encodeState({ atlas: 'destrieux' }).includes('anatomy'));
});

test('a supplied language survives serialization even when English is active', () => {
  for (const lang of ['en', 'fr'] as const) {
    const hash = encodeState({ atlas: 'destrieux', lang });
    assert.equal(hash, `atlas=destrieux&lang=${lang}`);
    assert.equal(decoded(hash).lang, lang);
  }
});

test('an absent language is omitted so startup can use the saved preference', () => {
  for (const state of [{}, { lang: undefined }, { lang: null }] as Partial<LinkInput>[]) {
    assert.equal(encodeState({ atlas: 'destrieux', ...state }), 'atlas=destrieux');
  }
});

test('the panel tab, open deficit and lesson step survive a link; the first step is the default', () => {
  const state: Partial<LinkInput> = {
    explorer: 'circuits',
    selectedDeficit: 'aphasia',
    circuit: 'visual',
    circuitStep: 2,
  };
  assert.equal(encodeState(state), 'tab=circuits&deficit=aphasia&circuit=visual&step=3');
  assert.deepEqual(decoded(encodeState(state)), state);
  assert.equal(encodeState({ circuit: 'visual', circuitStep: 0 }), 'circuit=visual');
});

test('the exact camera travels in tenths of a millimetre, its up vector only when it has its own', () => {
  const orbit: Orbit = { position: [-312.44, 95.06, -140.61], target: [1.23, -10.27, 4.5] };
  const hash = encodeState({ orbit });
  assert.equal(hash, 'cam=-312.4,95.1,-140.6,1.2,-10.3,4.5');
  assert.deepEqual(decoded(hash).orbit, {
    position: [-312.4, 95.1, -140.6],
    target: [1.2, -10.3, 4.5],
  });
  const tilted = decoded(encodeState({ orbit: { ...orbit, up: [0, 0.6, 0.8] } })).orbit;
  assert.deepEqual(tilted!.up, [0, 0.6, 0.8]);
  // A hand-written up vector is normalised rather than trusted.
  assert.deepEqual(decoded('#cam=0,0,300,0,0,0,0,2,0').orbit!.up, [0, 1, 0]);
});

test('the MRI window travels as level then width over the scan’s intensities', () => {
  assert.equal(encodeState({ mriWindow: { center: 90, width: 180 } }), 'mri=90,180');
  assert.deepEqual(decoded('#mri=128,256').mriWindow, { center: 128, width: 256 });
});

test('every camera the orbit limits allow is written as a link that reads back within them', () => {
  // Deterministic: a fixed linear congruential sequence rather than Math.random.
  let seed = 7;
  const random = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  const frames = {
    region: new Box3(new Vector3(-0.012, -0.01, 0.02), new Vector3(-0.004, 0.0, 0.03)),
    brain: new Box3(new Vector3(-0.075, -0.06, -0.105), new Vector3(0.075, 0.09, 0.07)),
    // Brain and cord together, the cord ending 0.73 m below.
    cord: new Box3(new Vector3(-0.075, -0.73, -0.105), new Vector3(0.075, 0.09, 0.07)),
  };
  for (const [frame, box] of Object.entries(frames)) {
    const { minDistance, maxDistance } = cameraConstraints(box);
    for (let trial = 0; trial < 500; trial++) {
      const target = new Vector3(
        ...[0, 1, 2].map(
          (axis) =>
            box.min.getComponent(axis) +
            random() * (box.max.getComponent(axis) - box.min.getComponent(axis)),
        ),
      );
      const direction = new Vector3(random() - 0.5, random() - 0.5, random() - 0.5).normalize();
      // OrbitControls clamps a full zoom-out to exactly the limit, so the limit itself is tested often.
      const distance =
        trial % 2 ? maxDistance : minDistance + random() * (maxDistance - minDistance);
      const position = target.clone().addScaledVector(direction, distance);
      const mm = (vector: Vector3) =>
        vector.toArray().map((value) => value * 1000) as Orbit['position'];
      const { state, rejected } = decodeState(
        encodeState({ orbit: { position: mm(position), target: mm(target) } }),
      );
      assert.deepEqual(rejected, [], `${frame}: written camera rejected`);
      assert.ok(
        orbitWithin(state.orbit!, maxDistance * 1000),
        `${frame}: read back beyond ${maxDistance} m`,
      );
    }
  }
  assert.equal(orbitWithin({ position: [0, 0, 0], target: [0, 0, 0] }, 100), false);
  assert.equal(orbitWithin({ position: [0, 0, 101], target: [0, 0, 0] }, 100), false);
});

// Owed by C1 (i18n.test.js:28).
test('url-state encodes and decodes lang', () => {
  const stateEn: Partial<LinkInput> = {
    atlas: 'destrieux',
    hemisphere: 'both',
    cortexVisible: true,
    cortexOpacity: 1,
    surfaceColor: 'atlas',
    view: 'oblique',
    selectedRegion: null,
    isolatedRegion: null,
    lang: 'en',
  };
  assert.equal(encodeState(stateEn), 'atlas=destrieux&lang=en');
  assert.equal(encodeState({ ...stateEn, lang: 'fr' }), 'atlas=destrieux&lang=fr');
  assert.equal(decodeState('#atlas=destrieux&lang=fr').state.lang, 'fr');
  assert.equal(decodeState('#atlas=destrieux&lang=en').state.lang, 'en');
  assert.deepEqual(decodeState('#atlas=destrieux&lang=unknown').rejected, ['lang']);
});

test('STATE-02 every field has one parameter, written in a fixed order after the hidden parts', () => {
  const written = encodeState({
    hiddenRegions: new Set(['b', 'a']),
    anatomy: 'cdmd',
    atlas: 'destrieux',
    cutAtlas: 'nextbrain',
    internalSystem: 'limbic',
    detail: 'aseg',
    selectedRegion: 'r',
    isolatedRegion: 'i',
    view: 'left',
    orbit: { position: [1, 2, 3], target: [4, 5, 6] },
    cut: 'axial',
    cutOffset: 5,
    cutReverse: true,
    cutTilt: 40,
    cutAzimuth: 50,
    hemisphere: 'left',
    cortexVisible: false,
    internalVisible: false,
    spinalCordVisible: true,
    surfaceColor: 'cab-np',
    cortexOpacity: 0.5,
    mriWindow: { center: 1, width: 2 },
    explorer: 'functions',
    selectedFunction: 'language',
    selectedDeficit: 'aphasia',
    circuit: 'visual',
    circuitStep: 1,
    lang: 'fr',
  });
  assert.deepEqual(
    written.split('&').map((pair) => pair.split('=')[0]),
    [
      'hidden',
      'anatomy',
      'atlas',
      'cuts',
      'system',
      'detail',
      'region',
      'isolate',
      'view',
      'cam',
      'cut',
      'pos',
      'rev',
      'tilt',
      'az',
      'hemi',
      'cortex',
      'internal',
      'cord',
      'colors',
      'opacity',
      'mri',
      'tab',
      'function',
      'deficit',
      'circuit',
      'step',
      'lang',
    ],
  );
  assert.equal(
    written,
    'hidden=a,b&anatomy=cdmd&atlas=destrieux&cuts=nextbrain&system=limbic&detail=aseg&region=r&isolate=i&view=left&cam=1,2,3,4,5,6&cut=axial&pos=5&rev=1&tilt=40&az=50&hemi=left&cortex=0&internal=0&cord=1&colors=cab-np&opacity=0.5&mri=1,2&tab=functions&function=language&deficit=aphasia&circuit=visual&step=2&lang=fr',
  );
  assert.deepEqual(PARAMS, {
    anatomy: 'anatomy',
    atlas: 'atlas',
    cutAtlas: 'cuts',
    internalSystem: 'system',
    detail: 'detail',
    selectedRegion: 'region',
    isolatedRegion: 'isolate',
    view: 'view',
    orbit: 'cam',
    cut: 'cut',
    cutOffset: 'pos',
    cutReverse: 'rev',
    cutTilt: 'tilt',
    cutAzimuth: 'az',
    hemisphere: 'hemi',
    cortexVisible: 'cortex',
    internalVisible: 'internal',
    spinalCordVisible: 'cord',
    surfaceColor: 'colors',
    cortexOpacity: 'opacity',
    mriWindow: 'mri',
    explorer: 'tab',
    selectedFunction: 'function',
    selectedDeficit: 'deficit',
    circuit: 'circuit',
    circuitStep: 'step',
    lang: 'lang',
    hiddenRegions: 'hidden',
  });
});

test('STATE-05 a repeated hidden id is read once', () => {
  assert.deepEqual(decoded('#hidden=a,a').hiddenRegions, ['a']);
});

test('STATE-10 cut angles are whole degrees in range', () => {
  assert.deepEqual(
    [decoded('#tilt=0').cutTilt, decoded('#tilt=90').cutTilt, decoded('#tilt=44.6').cutTilt],
    [0, 90, 45],
  );
  assert.deepEqual([decoded('#az=-180').cutAzimuth, decoded('#az=180').cutAzimuth], [-180, 180]);
  for (const hash of ['#tilt=91', '#tilt=-1', '#az=181', '#az=-181']) {
    assert.equal(decodeState(hash).rejected.length, 1, hash);
  }
});

test('STATE-11 opacity is written to hundredths and read in 0 to 1', () => {
  assert.equal(encodeState({ cortexOpacity: 0.456 }), 'opacity=0.46');
  assert.equal(encodeState({ cortexOpacity: 0.35 }), 'opacity=0.35');
  assert.equal(decoded('#opacity=0.456').cortexOpacity, 0.456);
  for (const value of ['1.01', '-0.1', '5', 'NaN', 'Infinity', 'true', '']) {
    assert.deepEqual(decodeState(`#opacity=${value}`).rejected, ['opacity'], value);
  }
});

test('STATE-13 a camera counts as within an orbit limit up to 0.17 mm beyond it, not 0.18', () => {
  const at = (distance: number): Orbit => ({ position: [0, 0, distance], target: [0, 0, 0] });
  assert.equal(orbitWithin(at(100), 100), true);
  assert.equal(orbitWithin(at(100.17), 100), true);
  assert.equal(orbitWithin(at(100.18), 100), false);
});

test('STATE-14 the MRI window has level 0 to 255 and width 1 to 256, written in tenths', () => {
  assert.equal(encodeState({ mriWindow: { center: 90.04, width: 180.06 } }), 'mri=90,180.1');
  assert.deepEqual(decoded('#mri=0,1').mriWindow, { center: 0, width: 1 });
  assert.deepEqual(decoded('#mri=255,256').mriWindow, { center: 255, width: 256 });
  for (const value of ['90', '300,100', '90,0', '256,1', '-1,10', '10,257', '1,2,3', 'a,b']) {
    assert.deepEqual(decodeState(`#mri=${value}`).rejected, ['mri'], value);
  }
});

test('STATE-17 a fixed corpus of links reads back as the same scene once written', () => {
  const corpus = [
    'anatomy=cdmd&atlas=hcp-mmp&cuts=nextbrain&system=limbic&detail=aseg',
    'region=destrieux:left:29&isolate=aseg:left:17&view=superior&hemi=right',
    'hidden=aseg:left:17,destrieux:left:29&cortex=0&internal=0&cord=1',
    'cut=oblique&pos=-12.3&rev=1&tilt=44&az=-45',
    'cut=sagittal&pos=512&tilt=0&az=-180',
    'colors=cab-np&opacity=0.46',
    'colors=tissue&tab=functions&function=language',
    'tab=circuits&deficit=aphasia&circuit=visual&step=4&lang=fr',
    'cam=10,-20,30,0,0,0&mri=128,256',
    'cam=1,2,3,4,5,6,0,0.6,0.8&mri=0,1',
    'colors=0&hemi=both&cortex=1&view=oblique&opacity=1',
  ];
  for (const hash of corpus) {
    const first = decoded(hash);
    const written = encodeState({ ...first, hiddenRegions: new Set(first.hiddenRegions) });
    const withoutDefaults = Object.fromEntries(
      Object.entries(first).filter(
        ([key, value]) => !(key in DEFAULTS && value === DEFAULTS[key as keyof typeof DEFAULTS]),
      ),
    );
    assert.deepEqual(decoded(written), withoutDefaults, hash);
  }
});
