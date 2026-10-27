/**
 * The engine contract: every call the application makes into the imperative
 * Three.js / NiiVue side, and every event it hears back, in plain data.
 *
 * Nothing here names a Three.js, NiiVue or DOM-canvas type except the canvas
 * element itself. Points are RAS millimetres (`Vec3`), the units the links and
 * the manifest use; the engine converts to its own world metres inside.
 * Legacy call sites are cited as `file:line` against `viewer/` at the commit
 * this contract was written from (`viewer/app.js` unless a path is given).
 *
 * Ownership: F2 writes it, E7 implements it, and changes after merge go through
 * the serial engine-contract queue on the tracking issue.
 */
import type { CabNpPartition } from '../core/catalog/networks.ts';
import type { FunctionalRegions } from '../core/catalog/functional-regions.ts';
import type { NeuropsychDomains } from '../core/catalog/neuropsych-domains.ts';
import type {
  CutMode,
  DisplaySettings,
  FunctionalLevel,
  Hemisphere,
  Language,
  LoadProgress,
  Manifest,
  ModelState,
  Orbit,
  Paint,
  Region,
  SurfaceColor,
  Theme,
  ViewName,
} from '../types/index.ts';

export type Vec3 = readonly [number, number, number];

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

/** An error the engine raises with a machine-readable code (`unknown-layer`, `asset-fetch`, `asset-updated`; brain-atlas.js:50, published-assets.js:8). */
export type EngineError = Error & { code?: string };

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/** What the camera shows the stage chrome, derived from the camera (viewport-chrome.js:834). */
export interface CameraView {
  /** Anatomical letter at each stage edge (orientation.js:72). */
  edges: Record<'top' | 'right' | 'bottom' | 'left', 'R' | 'L' | 'S' | 'I' | 'P' | 'A'>;
  /** The scale bar in true millimetres, or null while the stage has no size (scale-bar.js:28). */
  scale: { millimetres: number; pixels: number } | null;
}

/** Where the pointer is over the stage, in CSS pixels relative to the canvas (picking.js:93). */
export interface HoverEvent {
  region: Region | null;
  position: { x: number; y: number } | null;
}

/** The stage's measured size and the part of it the interface leaves uncovered (app.js:122). */
export interface ViewportEvent {
  visibleRect: Rect;
  hostSize: Size;
}

/** The model or the sections changed (app.js:2096-2097: both ran the one render). */
export interface DisplayChange {
  model: ModelState;
  sections: SectionsState;
}

export interface EngineEvents {
  /** Display snapshot after a model or sections change (app.js:2096-2097). */
  change: DisplayChange;
  /** A download the model started by itself failed, e.g. the white-matter envelopes (app.js:2099-2103). */
  loadError: EngineError;
  /** The WebGL context was lost (app.js:119). */
  contextLost: undefined;
  /** The WebGL context came back (app.js:120). */
  contextRestored: undefined;
  /** Whether the camera still sits on a named view; the held preset button follows it (viewport-chrome.js:560-597). */
  viewHeld: { held: boolean };
  /**
   * The camera was placed or came to rest; the link is written then (app.js:1825). A move the application
   * makes reports at once; one the reader makes, or a coast after it, reports once the camera has rested.
   */
  cameraSettled: undefined;
  /** A click on the model chose a region (app.js:1813). */
  pick: { id: string };
  /**
   * The tract reference became active or inactive: the Tracts tab is open on an anatomy the tracts do not belong to
   * (app.js:1431). The engine has already reframed the last named view, as legacy did, and cleared the hover.
   */
  tractsActive: { active: boolean };
  /** The first tract reference finished loading (app.js:1442); while it is shown, the engine has reframed it. */
  tractsReady: undefined;
  /** Which streamlines are drawn changed (app.js:1447). */
  tractsVisibility: undefined;
  /** While the lesion is being placed, a click met the brain or a cut face here, in RAS millimetres. */
  lesionPoint: { point: Vec3 };
  /** High frequency: every camera move. Never route through reactive state (app.js:1819-1823). */
  camera: CameraView;
  /** High frequency: pointer-over-region, once per frame of a pointer move (app.js:1804). */
  hover: HoverEvent;
  /** High frequency during a sheet drag or resize (app.js:121-125, 1524-1536). */
  viewport: ViewportEvent;
}

/** The events that fire per frame and must stay out of reactive app state. */
export const HIGH_FREQUENCY_EVENTS = ['camera', 'hover', 'viewport'] as const;

export type EventName = keyof EngineEvents;

export interface Emitter<Events> {
  /** Subscribe; returns the unsubscribe function. */
  on<K extends keyof Events>(type: K, listener: (event: Events[K]) => void): () => void;
}

// ---------------------------------------------------------------------------
// Published data the model carries
// ---------------------------------------------------------------------------

/** CAB-NP's partition (`manifest.cab_np` file, validated at brain-atlas.js:163). The atlas it colours is `atlas`. */
export type CabNpData = CabNpPartition;

/** The published functional divisions (`manifest.functional_regions` file, brain-atlas.js:164). */
export type FunctionalRegionsData = FunctionalRegions;

/** The neuropsychological domains (`manifest.neuropsych_domains` file, brain-atlas.js:166). */
export type DomainsData = NeuropsychDomains;

// ---------------------------------------------------------------------------
// Model (BrainAtlas, model/brain-atlas.js)
// ---------------------------------------------------------------------------

export type SpinalCordLoad = 'unloaded' | 'loading' | 'ready' | 'error';

/** A download's progress callback (brain-atlas.js:221). */
export type OnProgress = (progress: LoadProgress | undefined) => void;

export interface EngineModel {
  readonly manifest: Manifest;
  readonly regions: ReadonlyMap<string, Region>;
  readonly cabNp: CabNpData | null;
  readonly functionalRegions: FunctionalRegionsData | null;
  readonly domains: DomainsData | null;
  /** The grouped learning overview when published, else the first level (brain-atlas.js:212). */
  readonly defaultDetail: string;
  /** Display settings: cheap, never walks the meshes (brain-atlas.js:480). */
  readonly settings: DisplaySettings;
  /** Settings plus the selection and the drawn-mesh count (brain-atlas.js:501). */
  readonly state: ModelState;
  /** The model has been disposed; commands stop when it is (scene-commands.js:30). */
  readonly disposed: boolean;
  /** Layer `id` (an atlas, a detail level or a supplemental layer) is downloaded (scene-commands.js:80). */
  hasLayer(id: string): boolean;
  /** The tissue envelopes are downloaded (scene-commands.js:109). */
  readonly envelopesLoaded: boolean;
  readonly spinalCordLoad: SpinalCordLoad;
  /** A region has a visible mesh on screen (sections.js:259: `visibleMeshes.some(region_id)`). */
  isRegionDrawn(id: string): boolean;
  /** The region's centre in RAS millimetres, rounded to 0.1, or null with no geometry (brain-atlas.js:676). */
  centroidOf(id: string | null): Vec3 | null;
  /** The shared visibility rule for the current settings (brain-atlas.js:714). */
  canSelect(region: Region): boolean;

  /** Throws for an unknown, non-region or invisible id (brain-atlas.js:719). */
  select(id: string | null): void;
  setInternalSystem(system: string | null): void;
  setHemisphere(hemisphere: Hemisphere): void;
  setCortexVisible(visible: boolean): void;
  /** Throws a `RangeError` outside 0..1 (brain-atlas.js:761). */
  setCortexOpacity(opacity: number): void;
  setInternalVisible(visible: boolean): void;
  /** Downloads the cord on first showing (brain-atlas.js:776). */
  setSpinalCordVisible(visible: boolean, onProgress?: OnProgress): Promise<void>;
  setFunctionalLevel(level: FunctionalLevel): void;
  /**
   * Colour the surface at once, leaving the cut's state alone; the sections' `setSurfaceColor` is the
   * one that downloads and reports (brain-atlas.js:789). Throws for a colour the model cannot show.
   */
  setSurfaceColor(mode: SurfaceColor): void;
  /** A paint is replaced whole by id; null lifts it; the same id is a no-op (brain-atlas.js:824). */
  setPaint(paint: Paint | null): void;
  /** Throws without a selection (brain-atlas.js:844). */
  isolate(): void;
  clearIsolation(): void;
  hideRegions(ids: readonly string[]): void;
  showRegions(ids: readonly string[]): void;
  restoreHiddenRegions(): void;
  undoDissection(): void;
  /** Replace the hidden set from a link, clearing the undo history (brain-atlas.js:885). */
  loadHiddenRegions(ids: readonly string[]): void;
  /** The opening display; the camera is the engine's, not the model's (brain-atlas.js:890). */
  reset(): void;

  /** Throws an `unknown-layer` error for an unpublished atlas (brain-atlas.js:431). */
  setAtlas(id: string, onProgress?: OnProgress): Promise<void>;
  setDetail(id: string, onProgress?: OnProgress): Promise<void>;
  /** Download the tissue envelopes (brain-atlas.js:245); resolves at once once loaded. */
  ensureEnvelopes(onProgress?: OnProgress): Promise<void>;
  /** Download the spinal cord layers (brain-atlas.js:291). */
  ensureSpinalCord(onProgress?: OnProgress): Promise<void>;
  /**
   * Fetch an atlas or a detail level ahead of a switch, with no display change (app.js:76). Any other id, a
   * supplemental layer included, rejects with an `unknown-layer` error: those load with their own commands.
   */
  prefetchLayer(id: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Sections (BrainSections, slices/sections.js)
// ---------------------------------------------------------------------------

export type SectionsStatus = 'idle' | 'loading' | 'ready' | 'error';

/** The code the sections report for a failed cut (sections.js:461). */
export type SectionsErrorCode = 'asset-fetch' | 'asset-updated' | 'cut-failed';

/** `BrainSections.state` (sections.js:55) as a snapshot: each read or `change` gives a fresh, read-only copy. */
export interface SectionsState {
  readonly mode: CutMode;
  readonly cutAtlas: string;
  /** RAS millimetres. */
  readonly crosshair: Vec3;
  readonly reverse: boolean;
  readonly overlay: boolean;
  readonly tilt: number;
  readonly azimuth: number;
  readonly status: SectionsStatus;
  readonly error: SectionsErrorCode | null;
}

/** A plane through the volume, in RAS millimetres (coordinates.js:36). */
export interface PlaneFrame {
  center: Vec3;
  normal: Vec3;
  u: Vec3;
  v: Vec3;
  /** Anatomical letters at top, right, bottom, left; empty for an oblique cut. */
  edges: readonly string[];
}

/** The three orthogonal MPR planes (sections.js chrome AXES, ui/chrome/sections.js). */
export type MprPlane = 'sagittal' | 'coronal' | 'axial';

/** The linked MRI's resolution and window once loaded (sections.js:166). */
export interface MriDisplay {
  fieldOfView: number;
  size: number;
  windowCenter: number;
  windowWidth: number;
}

export interface MriWindow {
  center: number;
  width: number;
}

/** What a point in the volume is (sections.js:418). */
export interface VolumeSample {
  labelId: number;
  /** The label volume's raw name; the UI words it (ui/chrome/sections.js:517). */
  name: string;
  region: Region | undefined;
  intensity: number;
  ras: Vec3;
}

export interface EngineSections {
  readonly state: SectionsState;
  readonly active: boolean;
  /** A cut can be drawn without first downloading the envelopes it caps (sections.js:100). */
  readonly solidsReady: boolean;
  /** The cut's own frame (sections.js:103). */
  readonly frame: PlaneFrame;
  /** The permitted offsets along the cut's normal, `[min, max]` mm (sections.js:133). */
  readonly offsetRange: readonly [number, number];
  /** The offset of the crosshair along the cut's normal (ui/chrome/sections.js:198). */
  readonly offset: number;
  /** The linked MRI is loaded (sections.js:150). */
  readonly volumesLoaded: boolean;
  /** Null until the linked MRI loads. */
  readonly display: MriDisplay | null;
  /** The window the scan publishes, null until it loads (app.js:827). */
  readonly publishedWindow: MriWindow | null;
  /** The reader's window when it differs from the published one, else null (app.js:825-831). */
  mriWindowLink(): MriWindow | null;
  /** Voxel spacing of a cut atlas in mm, 1 when unpublished (ui/chrome/sections.js:496). */
  cutSpacingMm(atlas: string): number;

  /** Download and decode the linked MRI and its segmentation (sections.js:150). */
  load(): Promise<void>;
  /** Throws for an unknown mode (sections.js:241). The first cut downloads. */
  setMode(mode: CutMode): Promise<void>;
  /** Throws a `RangeError` beyond the coordinate limit (sections.js:258). */
  setCrosshair(point: Vec3): void;
  /** Throws a `RangeError` outside `offsetRange` (sections.js:270). */
  setOffset(offset: number): void;
  /** The slider's path: the picture stays on the last complete cut until the next is built (sections.js:278). */
  setOffsetReady(offset: number): Promise<void>;
  setAngles(tilt: number, azimuth: number): void;
  setAnglesReady(tilt: number, azimuth: number): Promise<void>;
  /** The label volume the cut samples; on failure the previous choice returns and the promise rejects (sections.js:337). */
  setCutAtlas(atlas: string): Promise<void>;
  /** Throws a `TypeError` for a non-boolean (sections.js:363). */
  setDisplay(options: { reverse?: boolean; overlay?: boolean }): void;
  /** Throws a `RangeError` before the scan loads or for a non-positive width (sections.js:377). */
  setWindow(center: number, width: number): void;
  /**
   * Colour the surface. `current` is the scene command's intent check: when it turns false the download lands
   * without changing the colour (sections.js:208).
   */
  setSurfaceColor(mode: SurfaceColor, current?: () => boolean): Promise<void>;

  /** The plane through the crosshair for an MPR panel (ui/chrome/sections.js:290, 354). */
  mprFrame(plane: MprPlane): PlaneFrame;
  /** RGBA pixels of a frame at `display.size` square (sections.js:414). Needs the MRI loaded. */
  pixels(frame: PlaneFrame): Uint8ClampedArray;
  /** Needs the MRI loaded (sections.js:418). */
  sample(point: Vec3): VolumeSample;
}

// ---------------------------------------------------------------------------
// Camera, framing and presentation (render/scene.js, app.js 249-540, 781-822, 1783)
// ---------------------------------------------------------------------------

/** How much the framing keeps clear of the dock, colour keys and markings (viewport-chrome.js:263). */
export interface FramingClearance {
  inset: { top?: number; right?: number; bottom?: number };
  scale: { horizontal: number; vertical: number };
}

/** The camera pose a reader state keeps and `restoreCamera` puts back. Opaque to everything but the engine (app.js:754-766). */
declare const cameraSnapshot: unique symbol;
export interface CameraSnapshot {
  readonly [cameraSnapshot]: true;
}

export interface MoveOptions {
  /** No eased move: the camera is there this frame. */
  immediate?: boolean;
}

/** Radians; the turn one arrow key makes (keyboard-orbit.js:19). */
export interface OrbitTurn {
  azimuth?: number;
  polar?: number;
}

/** The phone sheet's cover of the canvas, in CSS pixels (scene.js:488). */
export interface ChromeInsets {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export interface EngineCamera {
  /** The camera still sits where a named view put it (viewport-chrome.js:792). */
  readonly viewHeld: boolean;
  /** The stage's visible rectangle and size (scene.js:528, 546). */
  readonly visibleRect: Rect;
  readonly hostSize: Size;
  /** The camera as the camera event last reported it (viewport-chrome.js:834). */
  readonly view: CameraView;

  /**
   * Register the pull the engine measures the dock with, at the moment it frames: the section bar can
   * change it in the same task (app.js:372-378, viewport-chrome.js:263).
   */
  setFramingSource(source: () => FramingClearance): void;
  /** The phone sheet covers part of the canvas; `settle` is the sheet easing to a detent (scene.js:488). */
  setChromeInsets(insets: ChromeInsets, motion: { settle?: boolean }): void;
  /** The stage dock grew or shrank: keep the heading and scale the distance to the new room (app.js:388). */
  refitDock(): void;

  /**
   * Frame a named view of what is drawn, clear of the interface (app.js:406). Holds the view. Throws for a
   * view the camera does not publish, leaving the camera where it was.
   */
  frameCurrent(view: ViewName, options?: MoveOptions): void;
  /** Frame a named view, as the view keys and presets do (app.js:443). Holds the view. */
  applyView(view: ViewName, options?: MoveOptions): void;
  /**
   * Frame a deficit's regions together, from the side they lie on (app.js:474). Releases the view. A no-op,
   * leaving the held view alone, when none of the ids is drawn (app.js:476-477).
   */
  frameRegions(ids: readonly string[]): void;
  /** Frame one drawn region from the current heading (app.js:510-524). Releases the view; false when it has no drawn mesh. */
  frameRegion(id: string, options?: MoveOptions): boolean;
  /**
   * Frame a lesson landmark as authored: its view, with the context margin around it (app.js:457).
   * Releases the view. False when the region has no drawn mesh.
   */
  frameLandmark(
    regionId: string,
    view: ViewName,
    contextMarginMm: number,
    options?: MoveOptions,
  ): boolean;
  /** Pull back to everything drawn along the current heading (app.js:1135). */
  frameWhole(): void;
  /** Frame the drawn internal structures (app.js:1116). */
  frameInternal(): void;
  /**
   * Face the active cut and report the preset it faces, or null with no cut (app.js:1281). Holds the view,
   * except for an oblique cut, which is faced along its own normal and releases it.
   */
  faceCut(options?: MoveOptions): ViewName | null;
  /** Re-aim at the centre of the brain before a reset frames the opening view (app.js:1271). */
  recenter(): void;
  /** The distance at which the heading just fits, 0 when unknown: the sheet reads it before and after it moves (app.js:356, 1507). */
  fittedDistance(): number;
  /** Scale the camera's distance from a fit of `before` to the room it has now (app.js:1543). */
  keepFraming(before: number): void;
  /** Move the camera onto a surface point in RAS millimetres, released from any view (app.js:1783). */
  focusPoint(point: Vec3): void;

  /** One arrow key's turn, applied at once; releases the held view (app.js:1859, decision 22). */
  orbitBy(turn: OrbitTurn): void;
  /** One keyboard zoom step: a factor on the distance, about the surface in the middle of the view (app.js:1869). */
  dolly(factor: number): void;

  /** The camera as a reader state keeps it (app.js:754-766). */
  capture(): CameraSnapshot;
  /** Put a captured camera back and restore whether the view was held (app.js:781). */
  restore(view: ViewName, snapshot: CameraSnapshot, options?: MoveOptions): void;
  /**
   * A link's exact camera, placed in the framing just applied. Throws a `RangeError` beyond the orbit limit
   * (app.js:795). Releases the view.
   */
  placeOrbit(orbit: Orbit, options?: MoveOptions): void;
  /** The camera as a link carries it, null while a view is held or the tract reference is shown (app.js:814). */
  orbitLink(): Orbit | null;
}

/**
 * What `render()` pushes to the stage each time the app state changes (app.js:1618-1634). The paint goes
 * through `model.setPaint` (app.js:1613); the engine words the canvas's label and role from `lang` (decision 28).
 */
export interface Presentation {
  lang: Language;
  /** The tract reference is shown alone: the brain and the cut are hidden (app.js:1618-1620). */
  referenceOnly: boolean;
}

// ---------------------------------------------------------------------------
// Comparison overlay (comparison/overlay.js)
// ---------------------------------------------------------------------------

export interface EngineComparison {
  /**
   * Outline an atlas-pair overlap. The geometry file is verified against its hash on first use.
   * Resolves false when a later call or `clear` overtook it (overlay.js:78, app.js:741).
   */
  highlight(id: string, geometry: { file: string; sha256: string }): Promise<boolean>;
  clear(): void;
  /** Hidden while a cut or the tract reference is shown (app.js:1639). */
  setVisible(visible: boolean): void;
}

// ---------------------------------------------------------------------------
// Tracts (diffusion/native-viewer.js, native-ui.js)
// ---------------------------------------------------------------------------

/** One loaded bundle, with its length summary at the current minimum (native-viewer.js:116). */
export interface TractBundle {
  id: string;
  catalogId: string;
  name: string;
  label: Readonly<Record<string, string>>;
  file: string;
  visible: boolean;
  total: number;
  shown: number;
  mean: number | null;
  min: number | null;
  max: number | null;
}

export interface MriLocation {
  /** The scan's RAS in millimetres: three components, as `setScannerPoint` takes them. */
  mm: Vec3;
  /** The zero-based source voxel, the grid `setVoxel` takes and the dialog labels, whatever moved the crosshair. */
  vox: Vec3;
  values: { name: string; value: number }[];
}

export type MriPlaneChoice = 'MULTIPLANAR' | 'AXIAL' | 'CORONAL' | 'SAGITTAL' | 'RENDER';

/** The MRI navigator's NiiVue engine (diffusion/navigation-viewer.js:49). Dispose it to free the GPU context. */
export interface MriNavigator {
  /** NIfTI-style header: `dims[1..3]` is the grid, `pixDims[1..3]` the spacing in mm. */
  readonly header: { dims: readonly number[]; pixDims: readonly number[] };
  setPlane(plane: MriPlaneChoice): void;
  /** Throws a `RangeError` outside the grid. Reports the location. */
  setVoxel(voxel: Vec3): void;
  /** Step the crosshair in the display's direction; on a mirrored source axis a positive step lowers the source index. Reports the voxel it lands on. */
  moveVoxel(delta: Vec3): void;
  /** False when the point lies outside the scan's grid. */
  setScannerPoint(point: Vec3): boolean;
  setWindow(center: number, width: number): void;
  setFaOpacity(value: number): void;
  /** Show exactly these bundles, loading new ones, at a minimum length (navigation-viewer.js:71). */
  syncTracts(enabled: readonly string[], minimum: number): Promise<void>;
  resize(): void;
  dispose(): void;
}

export interface EngineTracts {
  /** The anatomy the tracts belong to (native-ui.js:249). */
  readonly anatomy: string;
  /** The loaded outline and the first bundles (native-ui.js:250). */
  readonly ready: boolean;
  /** Any streamline is drawn (native-ui.js:251). */
  readonly streamlinesVisible: boolean;
  /** The cortex opacity the overlay opens with (native-ui.js:253). */
  readonly defaultOpacity: number;
  /** The bundles loaded so far (native-viewer.js:116). */
  snapshot(): TractBundle[];
  hasBundle(id: string): boolean;
  /**
   * The Tracts tab opened or closed. The first opening loads the outline and the catalog's initial bundles
   * and emits `tractsReady`; an anatomy without tracts of its own emits `tractsActive` (native-ui.js:269-286).
   */
  setActive(active: boolean): Promise<void>;
  /** Download and show one bundle (native-viewer.js:48). */
  loadBundle(id: string): Promise<void>;
  /** Throws a `RangeError` for a bundle not loaded (native-viewer.js:69). */
  setVisible(id: string, visible: boolean): void;
  /** Hide the streamlines shorter than `minimum` mm (native-viewer.js:109). */
  setMinimum(minimum: number): void;
  /** The tract reference's own brain outline opacity; throws a `RangeError` outside 0..1 (native-viewer.js:104). */
  setOutlineOpacity(opacity: number): void;
  /** Draw the streamlines over the anatomy's own brain (native-ui.js:256-261). */
  setOverlay(visible: boolean): void;
  /** A point of the scan, in scanner RAS mm, where the sections' crosshair puts it (native-ui.js:109). */
  scannerToSurface(point: Vec3): Vec3;
  /** The sections' crosshair as a point of the scan, in scanner RAS mm (native-ui.js:107). */
  surfaceToScanner(point: Vec3): Vec3;
  /** Open the NiiVue navigator on a canvas. The scan, FA and the shared tract decode load with it. */
  createMriNavigator(
    canvas: HTMLCanvasElement,
    onLocation: (location: MriLocation) => void,
  ): Promise<MriNavigator>;
}

// ---------------------------------------------------------------------------
// Lesion (lesion/lesion.ts)
// ---------------------------------------------------------------------------

/** A spherical lesion: its centre in RAS millimetres and its radius in millimetres. */
export interface LesionSphere {
  centre: Vec3;
  radius: number;
}

/** What a lesion covers of each tissue, in mm³, on the FreeSurfer segmentation. */
export type LesionTissue = Record<'cortex' | 'white' | 'deep' | 'fluid' | 'outside', number>;

export interface LesionMeasurement {
  /** mm³ of the sphere on the label grid. */
  volume: number;
  tissue: LesionTissue;
  /** Every labelled region it reaches, in mm³: how much lies inside and the region's whole size. */
  regions: ReadonlyMap<string, { inside: number; whole: number }>;
}

/** One tract bundle's streamlines, and how many have a point inside the lesion. */
export interface TractCrossing {
  id: string;
  crossing: number;
  total: number;
}

export interface EngineLesion {
  /** Draw the lesion on the stage, or take it away with null. Throws a `RangeError` for a radius that is not positive. */
  show(sphere: LesionSphere | null): void;
  /** While on, a click on the brain or a cut face raises `lesionPoint` instead of choosing a region. */
  setPlacing(placing: boolean): void;
  /** Measure it on every published label volume; the first call downloads them. */
  measure(sphere: LesionSphere): Promise<LesionMeasurement>;
  /** The anatomy's own tract bundles on the sides the lesion reaches, in catalog order; none on an anatomy without tracts of its own. */
  tractBundles(sphere: LesionSphere): string[];
  /** Download those bundles and count the streamlines crossing the lesion, reporting each bundle as it is counted. */
  measureTracts(
    sphere: LesionSphere,
    onBundle?: (counted: number, total: number) => void,
  ): Promise<TractCrossing[]>;
}

// ---------------------------------------------------------------------------
// The engine
// ---------------------------------------------------------------------------

/** A snapshot of the settled frame, copied to a 2D canvas (scene.js:555). */
export interface SnapshotCapture {
  canvas: HTMLCanvasElement;
  /** Pixels in the copy per CSS pixel. */
  ratio: number;
}

export interface Engine extends Emitter<EngineEvents> {
  /** The stage canvas; the settings menu returns focus to it (header.js:169). */
  readonly canvas: HTMLCanvasElement;
  readonly model: EngineModel;
  readonly sections: EngineSections;
  readonly camera: EngineCamera;
  readonly comparison: EngineComparison;
  readonly tracts: EngineTracts;
  readonly lesion: EngineLesion;

  /** Re-read the colours from the token layer after a theme change (app.js:131, 2106). */
  applyTheme(theme: Theme): void;
  /** Push the app state's look to the stage (app.js:1611-1639). */
  present(presentation: Presentation): void;
  /** Ask for a redraw, e.g. when a hidden panel is shown (app.js:1494). */
  invalidate(): void;
  /** The settled frame, `crop` in CSS pixels of the stage (scene.js:555). */
  captureSnapshot(crop?: Rect): SnapshotCapture;
  /** Free every GPU resource and listener (app.js:2134). */
  dispose(): void;
}

/** Options for the engine factory E7 implements (app.js:118, 164, 2109-2123). */
export interface EngineOptions {
  /** The stage element the canvas is added to. */
  host: HTMLElement;
  manifestUrl: string;
  /** From the link; an unpublished one rejects with an `unknown-layer` error. */
  atlas?: string;
  detail?: string;
  theme: Theme;
  /** Combined download progress while the first layers load (app.js:164-171). */
  onProgress?: (progress: LoadProgress) => void;
}

/** Create the engine: scene first, then the model, then the compiled outline shaders (app.js:118-208, 2122). */
export type CreateEngine = (options: EngineOptions) => Promise<Engine>;
