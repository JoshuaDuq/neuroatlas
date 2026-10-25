/**
 * The parts of the engine contract the state modules call. Each module is typed against these
 * small ports rather than the whole model, so a test fake need only carry what is used.
 */
import type { EngineModel, EngineSections } from '../../engine/api.ts';

/** What `applyReaderState` reads and sets on the model. */
export type ReaderModelPort = Pick<
  EngineModel,
  | 'settings'
  | 'state'
  | 'select'
  | 'setInternalSystem'
  | 'setHemisphere'
  | 'setCortexVisible'
  | 'setInternalVisible'
  | 'setCortexOpacity'
  | 'setFunctionalLevel'
  | 'loadHiddenRegions'
  | 'isolate'
  | 'clearIsolation'
>;

/** What `applyReaderState` reads and sets on the sections. */
export type ReaderSectionsPort = Pick<
  EngineSections,
  | 'state'
  | 'active'
  | 'display'
  | 'publishedWindow'
  | 'load'
  | 'setCutAtlas'
  | 'setMode'
  | 'setAngles'
  | 'setDisplay'
  | 'setOffset'
  | 'setWindow'
>;

/** What the scene commands call on the model. */
export type ModelPort = Pick<
  EngineModel,
  | 'settings'
  | 'manifest'
  | 'regions'
  | 'cabNp'
  | 'functionalRegions'
  | 'disposed'
  | 'hasLayer'
  | 'envelopesLoaded'
  | 'spinalCordLoad'
  | 'setAtlas'
  | 'setDetail'
  | 'ensureEnvelopes'
  | 'ensureSpinalCord'
  | 'setSpinalCordVisible'
  | 'setInternalVisible'
  | 'select'
  | 'clearIsolation'
  | 'setInternalSystem'
  | 'setHemisphere'
  | 'setCortexVisible'
  | 'setCortexOpacity'
  | 'showRegions'
>;

/** What the scene commands call on the sections. */
export type SectionsPort = Pick<EngineSections, 'solidsReady' | 'setMode' | 'setSurfaceColor'>;
