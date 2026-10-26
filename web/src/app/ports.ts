import type { KeymapCommands } from '../lib/controller/keymap.ts';
import type { ExcursionDeps, MriDialog, Shell } from '../lib/controller/excursion.svelte.ts';
import type { SelectionInterface } from '../lib/controller/anatomy.ts';

/**
 * What the regions provide once they are mounted: the pieces of the interface that the controllers
 * and the keymap reach, each owned by one component (the workspace and sheet, the stage's dialogs,
 * the masthead's shortcuts sheet). The controllers are built once in the composition root, so they
 * cannot take these as props; each region registers its own.
 */
export interface UiPorts
  extends
    Shell,
    Pick<SelectionInterface, 'revealOnSelect'>,
    Pick<
      KeymapCommands,
      | 'back'
      | 'focusSearch'
      | 'walkTree'
      | 'openDiffusionMri'
      | 'openMpr'
      | 'closeMpr'
      | 'toggleShortcuts'
    > {
  /** The linked MRI dialog (`MriDialog.show`), opened by the controllers. */
  showMri: MriDialog['show'];
  openPreparedPlane: MriDialog['openPreparedPlane'];
  /** The panels' entry points (`ExcursionDeps.panels`), under their own busy and failure handling. */
  openFunction: ExcursionDeps['panels']['openFunction'];
  openDeficit: ExcursionDeps['panels']['openDeficit'];
  openLessonMri: ExcursionDeps['panels']['openMri'];
  /**
   * Shows the detail without raising a phone's sheet over the camera: a link restores a view,
   * it does not pick (`links.hooks.showDetail`). `showDetail` (a selection) raises it.
   */
  showDetailInPlace(): void;
  /** Focus is inside a region's detail view, where Escape is Back. */
  focusInDetail(): boolean;
  mprOpen(): boolean;
  diffusionMriOpen(): boolean;
  shortcutsOpen(): boolean;
}

/** Questions whose honest answer, while nothing has mounted to ask, is no. */
const QUERIES = ['focusInDetail', 'mprOpen', 'diffusionMriOpen', 'shortcutsOpen'] as const;

const COMMANDS: Record<Exclude<keyof UiPorts, (typeof QUERIES)[number]>, true> = {
  showDetail: true,
  showList: true,
  showDetailInPlace: true,
  showMri: true,
  openPreparedPlane: true,
  revealOnSelect: true,
  back: true,
  focusSearch: true,
  walkTree: true,
  openDiffusionMri: true,
  openMpr: true,
  closeMpr: true,
  toggleShortcuts: true,
  openFunction: true,
  openDeficit: true,
  openLessonMri: true,
};

/**
 * The ports as stable functions that call whatever is registered, so a controller built before
 * the regions mount still reaches them. A command with nothing registered throws: no region has
 * mounted what it needs. A question answers false.
 */
export function createPorts() {
  const mounted: Partial<UiPorts> = {};
  const ports: Record<string, (...args: never[]) => unknown> = {};
  for (const name of Object.keys(COMMANDS) as (keyof typeof COMMANDS)[]) {
    ports[name] = (...args) => {
      const port = mounted[name] as ((...args: never[]) => unknown) | undefined;
      if (!port) throw new Error(`The ${name} port is not mounted.`);
      return port(...args);
    };
  }
  for (const name of QUERIES) ports[name] = () => mounted[name]?.() ?? false;

  return {
    ports: ports as unknown as UiPorts,
    /** Provide ports; returns the function that withdraws them (a region unmounting). */
    register(parts: Partial<UiPorts>): () => void {
      Object.assign(mounted, parts);
      return () => {
        for (const [name, port] of Object.entries(parts)) {
          if (mounted[name as keyof UiPorts] === port) delete mounted[name as keyof UiPorts];
        }
      };
    },
  };
}

export type Ports = ReturnType<typeof createPorts>;
