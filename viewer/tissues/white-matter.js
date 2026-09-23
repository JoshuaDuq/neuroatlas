import {
  Data3DTexture, NearestFilter, RedIntegerFormat, UnsignedByteType, Vector2, Vector3,
} from 'three';
import { worldToVoxelMatrix } from '../slices/coordinates.js';
import { codeIndex, liftFor } from './highlight.js';
import { LABEL_AT } from './label-sampling.js';

export const WHITE_MATTER_UNIFORMS = `
      uniform highp usampler3D whiteMatterVolume;
      uniform mat4 whiteMatterToVoxel;
      uniform ivec3 whiteMatterShape;
      uniform bool whiteMatterActive;
      uniform float whiteMatterIsolated;
      uniform vec2 whiteMatterCodes;
      uniform vec2 whiteMatterLifts;
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
          if (code > 0.0 && code == whiteMatterCodes.y) capLift = whiteMatterLifts.y;
          else if (code > 0.0 && code == whiteMatterCodes.x) capLift = whiteMatterLifts.x;
        }`;

/**
 * FreeSurfer's gyral white-matter parcels. They have no solids: the white
 * envelope's cap samples their codes, so a parcel is named, lit and isolated on
 * the cut of any atlas the volume was published for.
 */
export function createWhiteMatter(record, volume) {
  const texture = new Data3DTexture(volume.data, ...volume.shape);
  texture.format = RedIntegerFormat;
  texture.type = UnsignedByteType;
  texture.internalFormat = 'R8UI';
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;

  const codes = codeIndex(record.labels);
  const codeOf = regionId => codes.get(regionId) ?? -1;
  const uniforms = {
    whiteMatterVolume: { value: texture },
    whiteMatterToVoxel: { value: worldToVoxelMatrix(volume) },
    whiteMatterShape: { value: new Vector3(...volume.shape) },
    whiteMatterActive: { value: false },
    whiteMatterIsolated: { value: -1 },
    whiteMatterCodes: { value: new Vector2(-1, -1) },
    whiteMatterLifts: { value: new Vector2(0, 0) },
  };

  return {
    uniforms,
    get active() {
      return uniforms.whiteMatterActive.value;
    },
    holds: regionId => codes.has(regionId),
    regionAt: point => record.labels[volume.label(point)]?.region_id ?? null,
    update({ atlas, isolatedRegion }) {
      uniforms.whiteMatterActive.value = record.applies_to.includes(atlas);
      uniforms.whiteMatterIsolated.value = codeOf(isolatedRegion);
    },
    setHighlight(highlight = {}) {
      uniforms.whiteMatterCodes.value.set(codeOf(highlight.hovered), codeOf(highlight.selected));
      uniforms.whiteMatterLifts.value.set(
        liftFor(highlight.hovered, highlight), liftFor(highlight.selected, highlight));
    },
    dispose() {
      texture.dispose();
    },
  };
}
