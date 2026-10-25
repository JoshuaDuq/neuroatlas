import {
  Data3DTexture,
  DataTexture,
  NearestFilter,
  RedFormat,
  RedIntegerFormat,
  UnsignedByteType,
  Vector2,
  Vector3,
} from 'three';
import type { IUniform, Matrix4 } from 'three';
import { worldToVoxelMatrix } from '../slices/coordinates.ts';
import { codeIndex, liftFor } from './highlight.ts';
import { LABEL_AT } from './label-sampling.ts';

export const WHITE_MATTER_UNIFORMS = `
      uniform highp usampler3D whiteMatterVolume;
      uniform mat4 whiteMatterToVoxel;
      uniform ivec3 whiteMatterShape;
      uniform bool whiteMatterActive;
      uniform float whiteMatterIsolated;
      uniform vec2 whiteMatterCodes;
      uniform vec2 whiteMatterLifts;
      uniform sampler2D whiteMatterVisibility;
      ${LABEL_AT}`;

/**
 * Lights the pointed-at or chosen parcel and, while one is isolated, discards the
 * rest. Reads the label `regionAt` reads, by the rule every label cut draws with.
 */
export const WHITE_MATTER_LIFT = `
        if (whiteMatterActive) {
          float code = float(labelAt(whiteMatterVolume, whiteMatterShape,
            (whiteMatterToVoxel * vec4(sourceWorld, 1.0)).xyz));
          if (whiteMatterIsolated >= 0.0 && code != whiteMatterIsolated) discard;
          if (texelFetch(whiteMatterVisibility, ivec2(int(code), 0), 0).r < 0.5) discard;
          if (code > 0.0 && code == whiteMatterCodes.y) capLift = whiteMatterLifts.y;
          else if (code > 0.0 && code == whiteMatterCodes.x) capLift = whiteMatterLifts.x;
        }`;

/** The published `white-matter` record: its label table and the atlases it is published for. */
export interface WhiteMatterRecord {
  labels: readonly { region_id?: string | null }[];
  applies_to: readonly string[];
}

/** The label volume the white-matter parcels are sampled from (`Volume`, slices/volume). */
export interface WhiteMatterVolume {
  data: ArrayLike<number>;
  shape: readonly [number, number, number];
  inverse: ArrayLike<number>;
  /** The label at a point in world space. */
  label(point: Vector3): number;
}

export interface WhiteMatterUniforms {
  whiteMatterVolume: IUniform<Data3DTexture>;
  whiteMatterToVoxel: IUniform<Matrix4>;
  whiteMatterShape: IUniform<Vector3>;
  whiteMatterActive: IUniform<boolean>;
  whiteMatterIsolated: IUniform<number>;
  whiteMatterCodes: IUniform<Vector2>;
  whiteMatterLifts: IUniform<Vector2>;
  whiteMatterVisibility: IUniform<DataTexture>;
}

export interface WhiteMatter {
  uniforms: WhiteMatterUniforms;
  readonly active: boolean;
  holds(regionId: string): boolean;
  regionAt(point: Vector3): string | null;
  update(state: {
    atlas: string;
    isolatedRegion: string | null;
    hiddenRegions?: ReadonlySet<string>;
  }): void;
  setHighlight(highlight?: { hovered?: string | null; selected?: string | null }): void;
  dispose(): void;
}

/**
 * FreeSurfer's gyral white-matter parcels. They have no solids: the white
 * envelope's cap samples their codes, so a parcel is named, lit and isolated on
 * the cut of any atlas the volume was published for.
 */
export function createWhiteMatter(
  record: WhiteMatterRecord,
  volume: WhiteMatterVolume,
): WhiteMatter {
  if (!(volume.data instanceof Uint8Array)) throw new Error('Expected uint8 white-matter labels.');
  const texture = new Data3DTexture(volume.data, ...volume.shape);
  texture.format = RedIntegerFormat;
  texture.type = UnsignedByteType;
  texture.internalFormat = 'R8UI';
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;

  const codes = codeIndex(record.labels);
  const visibility = new DataTexture(
    new Uint8Array(record.labels.length).fill(255),
    record.labels.length,
    1,
    RedFormat,
    UnsignedByteType,
  );
  visibility.needsUpdate = true;
  let visibilityKey = '';
  const codeOf = (regionId: string | null | undefined) =>
    regionId == null ? -1 : (codes.get(regionId) ?? -1);
  const uniforms: WhiteMatterUniforms = {
    whiteMatterVolume: { value: texture },
    whiteMatterToVoxel: { value: worldToVoxelMatrix(volume) },
    whiteMatterShape: { value: new Vector3(...volume.shape) },
    whiteMatterActive: { value: false },
    whiteMatterIsolated: { value: -1 },
    whiteMatterCodes: { value: new Vector2(-1, -1) },
    whiteMatterLifts: { value: new Vector2(0, 0) },
    whiteMatterVisibility: { value: visibility },
  };

  return {
    uniforms,
    get active() {
      return uniforms.whiteMatterActive.value;
    },
    holds: (regionId) => codes.has(regionId),
    regionAt: (point) => record.labels[volume.label(point)]?.region_id ?? null,
    update({ atlas, isolatedRegion, hiddenRegions = new Set() }) {
      uniforms.whiteMatterActive.value = record.applies_to.includes(atlas);
      uniforms.whiteMatterIsolated.value = codeOf(isolatedRegion);
      const key = [...hiddenRegions].sort().join(',');
      if (key !== visibilityKey) {
        visibilityKey = key;
        const data = visibility.image.data as Uint8Array;
        for (const [index, label] of record.labels.entries()) {
          data[index] = hiddenRegions.has(label.region_id!) ? 0 : 255;
        }
        visibility.needsUpdate = true;
      }
    },
    setHighlight(highlight = {}) {
      uniforms.whiteMatterCodes.value.set(codeOf(highlight.hovered), codeOf(highlight.selected));
      uniforms.whiteMatterLifts.value.set(
        liftFor(highlight.hovered, highlight),
        liftFor(highlight.selected, highlight),
      );
    },
    dispose() {
      texture.dispose();
      visibility.dispose();
    },
  };
}
