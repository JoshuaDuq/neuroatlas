import type { CameraSnapshot } from '../../engine/api.ts';
import type { LinkState, Region } from '../../types/index.ts';
import type { ReaderModelPort, ReaderSectionsPort } from './ports.ts';
import type { SceneCommands } from './scene-commands.ts';
import { DEFAULTS } from './url-state.ts';

/** The scene fields a link carries with a fixed default. Layers default to what is loaded. */
const SCENE_FIELDS = [
  'hemisphere',
  'cortexVisible',
  'cortexOpacity',
  'internalVisible',
  'spinalCordVisible',
  'surfaceColor',
  'functionalLevel',
  'internalSystem',
  'view',
  'cut',
  'cutOffset',
  'cutReverse',
  'cutTilt',
  'cutAzimuth',
  'selectedRegion',
  'isolatedRegion',
  'orbit',
  'mriWindow',
] as const;

/** 'view' frames the named view, 'cut' faces the cut, or an exact pose. */
export type ReaderCamera = 'view' | 'cut' | CameraSnapshot;

/** Everything the scene shows, with nothing left implicit. */
export type ReaderState = Pick<LinkState, (typeof SCENE_FIELDS)[number] | 'atlas' | 'detail' | 'cutAtlas'> & {
  hiddenRegions: ReadonlySet<string>;
  camera: ReaderCamera;
};

type ReaderPartial = Partial<
  Omit<LinkState, 'selectedRegion' | 'isolatedRegion' | 'hiddenRegions'> & {
    selectedRegion: Region | string | null;
    isolatedRegion: Region | string | null;
    hiddenRegions: Iterable<string>;
    camera: ReaderCamera;
  }
>;

const identifier = (value: Region | string | null | undefined) =>
  value && typeof value === 'object' ? value.id : value;

/**
 * Everything the scene shows, with nothing left implicit: an absent field takes the
 * default a link omits it for, so applying it turns a cut off and clears isolation.
 * `camera` is 'view' (frame the named view), 'cut' (face the cut) or an exact pose;
 * `orbit` is a link's exact camera, placed after that framing. A null `mriWindow`
 * is the scan's published window.
 */
export function readerState(
  partial: ReaderPartial,
  loaded: Pick<LinkState, 'atlas' | 'detail' | 'cutAtlas'>,
): ReaderState {
  const state: Record<string, unknown> = {};
  for (const key of SCENE_FIELDS) {
    const value =
      key === 'selectedRegion' || key === 'isolatedRegion' ? identifier(partial[key]) : partial[key];
    state[key] = value ?? DEFAULTS[key as keyof typeof DEFAULTS];
  }
  for (const key of ['atlas', 'detail', 'cutAtlas'] as const) {
    state[key] = partial[key] ?? loaded[key];
    if (!state[key]) throw new Error(`Reader state has no ${key}.`);
  }
  state.hiddenRegions = new Set(partial.hiddenRegions ?? []);
  state.camera = partial.camera ?? 'view';
  return state as ReaderState;
}

export const sameRegions = (a: ReadonlySet<string>, b: ReadonlySet<string>): boolean =>
  a.size === b.size && [...a].every((id) => b.has(id));

/** A step that failed, with the link parameters it applies. */
export interface ReaderFailure {
  fields: string[];
  error: unknown;
}

/**
 * Restore layers before display, cuts, selection and camera. Each step names the
 * link parameters it applies; a step that fails is recorded with them and the
 * rest still apply, so one bad field does not cost the reader the others. Stops
 * once `current()` says a later scene command has taken over. Returns the failures.
 */
export async function applyReaderState(
  target: ReaderState,
  {
    model,
    sections,
    commands,
    current,
    applyCamera,
    applyOrbit,
    revealInTree,
  }: {
    model: ReaderModelPort;
    sections: ReaderSectionsPort;
    commands: Pick<
      SceneCommands,
      'loadAtlas' | 'loadDetail' | 'showSpinalCord' | 'applySurfaceColor' | 'cut'
    >;
    current: () => boolean;
    applyCamera: (target: ReaderState) => void | Promise<void>;
    applyOrbit: (orbit: NonNullable<ReaderState['orbit']>) => void | Promise<void>;
    revealInTree: (id: string) => void;
  },
): Promise<ReaderFailure[]> {
  const failures: ReaderFailure[] = [];
  const step = async (fields: string[], run: () => void | Promise<unknown>) => {
    if (!current()) return false;
    try {
      await run();
      return true;
    } catch (error) {
      failures.push({ fields, error });
      return false;
    }
  };
  const settings = () => model.settings;

  await step(['atlas'], () => commands.loadAtlas(target.atlas, current));
  await step(['detail'], () => commands.loadDetail(target.detail, current));
  await step(['system'], () => {
    if (target.internalSystem !== settings().internalSystem) {
      model.setInternalSystem(target.internalSystem);
    }
  });
  await step(['hemi'], () => {
    if (target.hemisphere !== settings().hemisphere) model.setHemisphere(target.hemisphere);
  });
  await step(['cortex'], () => {
    if (target.cortexVisible !== settings().cortexVisible) {
      model.setCortexVisible(target.cortexVisible);
    }
  });
  await step(['internal'], () => {
    if (target.internalVisible !== settings().internalVisible) {
      model.setInternalVisible(target.internalVisible);
    }
  });
  // Always asked, even when already as wanted: a showing still downloading is otherwise left to land.
  await step(['cord'], () => commands.showSpinalCord(target.spinalCordVisible, current));
  await step(['opacity'], () => {
    if (target.cortexOpacity !== settings().cortexOpacity) {
      model.setCortexOpacity(target.cortexOpacity);
    }
  });
  await step(['hidden'], () => {
    if (!sameRegions(target.hiddenRegions, settings().hiddenRegions)) {
      model.loadHiddenRegions([...target.hiddenRegions]);
    }
  });
  await step(['level'], () => {
    if (target.functionalLevel !== settings().functionalLevel) {
      model.setFunctionalLevel(target.functionalLevel);
    }
  });
  await step(['colors'], () => commands.applySurfaceColor(target.surfaceColor, current));
  await step(['cuts'], async () => {
    if (target.cutAtlas !== sections.state.cutAtlas) await sections.setCutAtlas(target.cutAtlas);
  });
  // The position is judged against the range of the plane it lies in, so it goes once that plane is cut.
  const planeCut = await step(['cut', 'tilt', 'az', 'rev', 'pos'], async () => {
    if (target.cut === 'off') {
      if (sections.active) await sections.setMode('off');
      return;
    }
    if (target.cut === 'oblique') sections.setAngles(target.cutTilt, target.cutAzimuth);
    await commands.cut(target.cut, current);
    sections.setDisplay({ reverse: target.cutReverse });
  });
  if (planeCut && target.cut !== 'off') {
    await step(['pos'], () => sections.setOffset(target.cutOffset));
  }

  await step(['isolate'], () => {
    if (target.isolatedRegion === settings().isolatedRegion) return;
    if (!target.isolatedRegion) {
      model.clearIsolation();
      return;
    }
    model.select(target.isolatedRegion);
    model.isolate();
  });
  await step(['region'], () => {
    if (target.selectedRegion !== (model.state.selectedRegion?.id ?? null)) {
      model.select(target.selectedRegion);
    }
    if (target.selectedRegion) revealInTree(target.selectedRegion);
  });
  // Without a window of its own, the scene shows the scan's published one, once the scan is loaded.
  const mriWindow = target.mriWindow ?? sections.publishedWindow;
  const shown = sections.display;
  if (
    mriWindow &&
    (shown?.windowCenter !== mriWindow.center || shown?.windowWidth !== mriWindow.width)
  ) {
    await step(['mri'], async () => {
      await sections.load();
      if (current()) sections.setWindow(mriWindow.center, mriWindow.width);
    });
  }
  await step(['view'], () => applyCamera(target));
  if (target.orbit) await step(['cam'], () => applyOrbit(target.orbit!));
  return failures;
}
