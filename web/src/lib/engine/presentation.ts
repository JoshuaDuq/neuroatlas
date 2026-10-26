import type { Mesh, Object3D } from 'three';
import type { ModelState, Region } from '../types/index.ts';
import type { HoverEvent } from './api.ts';
import type { Emit } from './framing.ts';
import type { EngineScene } from './render/scene.ts';
import type { Highlight } from './tissues/gpu-sections.ts';

/** What the pointer is over, and where (app.js:1700). */
interface Hovered {
  region: Region;
  position: { x: number; y: number } | null;
}

/** What presentation reads of the model. */
export interface PresentationModel {
  readonly state: ModelState;
  readonly visibleMeshes: readonly Mesh[];
  canSelect(region: Region): boolean;
}

export interface PresentationOptions {
  scene: Pick<EngineScene, 'setOutlined' | 'invalidate'>;
  model: PresentationModel;
  sections: { readonly active: boolean; setHighlight(highlight: Highlight): void };
  overlay: { readonly outlined: readonly Object3D[] };
  /** The tract reference is shown: nothing is outlined or lit. */
  referenceActive: () => boolean;
  emit: Emit;
}

export interface Presentation {
  /** The pointer came over a region, moved on it, or left (app.js:1798-1806). */
  hover(region: Region | null, position: { x: number; y: number } | null): void;
  /** Forget what the pointer was over (app.js:1434). */
  clearHover(): void;
  /** Mark what the pointer is on and the selection: a cut face lights, a surface outlines. */
  outline(): void;
}

/**
 * What is marked on the stage: the pointer's region and the selection, lit on a cut and outlined on a
 * surface (app.js:1718-1751). Kept out of the state loop: hover answers once per frame of a pointer move.
 */
export function createPresentation({
  scene,
  model,
  sections,
  overlay,
  referenceActive,
  emit,
}: PresentationOptions): Presentation {
  let hovered: Hovered | null = null;

  const publishHover = () =>
    emit('hover', {
      region: hovered?.region ?? null,
      position: hovered?.position ?? null,
    } satisfies HoverEvent);

  /** Mark what the pointer is on — a cut face lights — and name it. */
  function highlight() {
    if (hovered && !model.canSelect(hovered.region)) hovered = null;
    sections.setHighlight({
      hovered: hovered?.region.id,
      selected: model.state.selectedRegion?.id,
    });
    publishHover();
    scene.invalidate();
  }

  function outline() {
    if (referenceActive()) {
      scene.setOutlined();
      return;
    }
    highlight();
    // An outline is drawn from an unclipped depth render, so on a cut it would ring the whole solid
    // rather than the face. The cut lights its faces instead, which is what `highlight` just did.
    if (sections.active) {
      scene.setOutlined();
      return;
    }
    const meshes = model.visibleMeshes;
    const meshFor = (id: string | undefined): Object3D[] => {
      const mesh = id && meshes.find((candidate) => candidate.userData['region_id'] === id);
      return mesh ? [mesh] : [];
    };
    const selected = meshFor(model.state.selectedRegion?.id);
    const overlap = overlay.outlined;
    // An open deficit's regions are painted, not outlined; the outline is the selection's alone.
    scene.setOutlined({
      selected: overlap.length ? overlap : selected,
      hovered: meshFor(hovered?.region.id),
    });
  }

  return {
    hover(region, position) {
      const regionChanged = region?.id !== hovered?.region.id;
      hovered = region ? { region, position } : null;
      if (regionChanged) {
        if (sections.active) highlight();
        else outline();
      } else if (position) {
        publishHover();
      }
    },
    clearHover() {
      hovered = null;
      publishHover();
    },
    outline,
  };
}
