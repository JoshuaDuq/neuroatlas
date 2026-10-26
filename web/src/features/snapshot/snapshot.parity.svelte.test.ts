// The snapshot's drawing, pixel for pixel against legacy `viewer/ui/chrome/snapshot.js`. Parity only: it
// goes with `viewer/` at cutover (decision 45), leaving the behaviour tests in snapshot.svelte.test.ts.
import '../../styles/index.css';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { flushSync } from 'svelte';
import { page } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-svelte';
import manifest from '../../../../public/models/cdmd/manifest.json' with { type: 'json' };
// @ts-expect-error TS7016: the legacy module is JavaScript and publishes no declarations.
import * as legacySnapshot from '../../../../viewer/ui/chrome/snapshot.js';
import type { Legend } from '../../lib/core/state/paint.ts';
import { createFakeEngine } from '../../lib/engine/fake.ts';
import { createStageLayout } from '../../lib/state/stage-layout.svelte.ts';
import type { StageLayout } from '../../lib/state/stage-layout.svelte.ts';
import type { Manifest } from '../../lib/types/index.ts';
import type { StageKeysModel } from './markings.ts';
import { annotateSnapshot, snapshotFonts, snapshotPlan } from './snapshot.ts';
import type { SnapshotStage } from './snapshot.ts';
import Fixture from './snapshot-test-support.svelte';

const legacyAnnotate: typeof annotateSnapshot = legacySnapshot.annotateSnapshot;

/** A deficit's findings, the first picked: its rows are toggles (G3's toolbar). */
const DEFICIT: Legend = {
  map: 'deficit',
  title: 'Aphasia',
  note: 'Each finding names the regions it cites.',
  rows: [
    { id: 'f1', color: [70, 120, 200], label: 'Broca', pressed: true },
    { id: 'f22', color: [100, 120, 200], label: 'Wernicke', pressed: false, absent: true },
    { id: 'f333', color: [160, 120, 200], label: 'Arcuate', pressed: false },
  ],
};

let stopLayout: (() => void) | undefined;

afterEach(() => {
  cleanup();
  stopLayout?.();
});

describe('the drawing', () => {
  test('matches legacy snapshot.js pixel for pixel: caption, letters, keys, statement and scale bar', async () => {
    await page.viewport(1280, 900);
    const [width, height] = [560, 520];
    const engine = createFakeEngine({
      manifest: manifest as unknown as Manifest,
      hostSize: { width, height },
    });
    let stage!: StageLayout;
    stopLayout = $effect.root(() => {
      stage = createStageLayout({ media: { phone: false }, storage: null });
    });
    const live = $state({
      lang: 'en' as const,
      status: 'ready' as const,
      surfaceColor: 'atlas' as const,
      functionalLevel: 'named' as const,
      networks: null,
      functionalRegions: null,
      legend: DEFICIT as Legend | null,
    });
    const handle: { keys?: StageKeysModel } = {};
    render(Fixture, { engine, stage, live, handle, width, height });
    flushSync();
    await vi.waitFor(() => expect(stage.visibleRect).not.toBeNull(), { timeout: 5000 });
    const scene: SnapshotStage = {
      host: document.querySelector<HTMLElement>('#viewport')!,
      stage,
      keys: handle.keys!,
      engine,
    };
    // A long subject and a section so the caption packs and shortens in a narrow image.
    const { plan } = snapshotPlan(scene, {
      lang: 'en',
      anatomy: { display_name: 'A subject whose name is far too long for the room it has here' },
      atlas: 'hcp-mmp',
      surfaceColor: 'atlas',
      detail: 'learning',
      offersDetail: true,
      view: 'left',
      reference: null,
      section: { plane: 'oblique', offset: -12.34, tilt: 30, azimuth: -45 },
    });
    await snapshotFonts(plan);
    const ratio = 2;
    const draw = (annotate: typeof annotateSnapshot) => {
      const canvas = document.createElement('canvas');
      canvas.width = plan.width * ratio;
      canvas.height = plan.height * ratio;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#7a7f86';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      annotate(canvas, { ...plan, ratio });
      return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    };
    const ours = draw(annotateSnapshot);
    const theirs = draw(legacyAnnotate);
    let marked = 0;
    let differing = 0;
    for (let i = 0; i < ours.length; i += 4) {
      if (ours[i] !== 0x7a || ours[i + 1] !== 0x7f || ours[i + 2] !== 0x86) marked++;
      if (
        ours[i] !== theirs[i] ||
        ours[i + 1] !== theirs[i + 1] ||
        ours[i + 2] !== theirs[i + 2] ||
        ours[i + 3] !== theirs[i + 3]
      )
        differing++;
    }
    // Something was drawn, and identically.
    expect(marked).toBeGreaterThan(5000);
    expect(differing).toBe(0);
  });
});
