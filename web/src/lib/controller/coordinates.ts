import type { Coordinate } from '../core/coordinates/parse.ts';
import type { Coordinates } from '../core/coordinates/spaces.ts';
import type { SceneCommands } from '../core/state/scene-commands.ts';
import type { Engine } from '../engine/api.ts';
import type { LesionStore } from '../state/lesion.svelte.ts';

/**
 * Placing a published coordinate from the stage: carried onto this brain by its space's field, then
 * marked by the one sphere, with the cut and the camera brought to it and its report as Anatomy's detail.
 */
export function createCoordinatePlacement({
  coordinates,
  lesion,
  engine,
  commands,
  ui,
}: {
  coordinates: Pick<Coordinates, 'metadata' | 'map'>;
  lesion: Pick<LesionStore, 'placeCoordinate' | 'sphere'>;
  engine: {
    sections: Pick<Engine['sections'], 'setCrosshair'>;
    camera: Pick<Engine['camera'], 'focusPoint'>;
  };
  commands: Pick<SceneCommands, 'begin'>;
  ui: { showAnatomy(): void; showDetail(): void };
}) {
  return {
    metadata: coordinates.metadata,
    /** Place it unless it lies beyond its template's brain; false then. A later command takes over. */
    async place(entered: Coordinate, space: string): Promise<boolean> {
      const current = commands.begin();
      const landing = await coordinates.map(entered, space);
      if (landing && current()) {
        ui.showAnatomy();
        lesion.placeCoordinate({ entered, space }, landing, coordinates.metadata.radius_mm);
        const { centre } = lesion.sphere!;
        engine.sections.setCrosshair(centre);
        engine.camera.focusPoint(centre);
        ui.showDetail();
      }
      return landing !== null;
    },
  };
}

export type CoordinatePlacement = ReturnType<typeof createCoordinatePlacement>;
