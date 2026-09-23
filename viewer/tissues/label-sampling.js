/**
 * `Volume.label` on the GPU: the label with the most trilinear weight over the
 * eight voxels around a point, visiting corners in the same order so that ties
 * break alike. Guarded, because one material can sample two label volumes.
 *
 * Written without loops over local arrays: ANGLE's Metal backend spills those
 * to memory, which made a cut face six times slower to draw.
 */
export const LABEL_AT = `
#ifndef LABEL_AT_DEFINED
#define LABEL_AT_DEFINED
uint labelCorner(highp usampler3D volume, ivec3 shape, ivec3 cell) {
  bool inside = all(greaterThanEqual(cell, ivec3(0))) && all(lessThan(cell, shape));
  return inside ? texelFetch(volume, cell, 0).r : 0u;
}

void labelVote(uint value, uvec4 low, uvec4 high, vec4 lowWeights, vec4 highWeights,
    inout uint best, inout float bestWeight) {
  float weight = dot(vec4(equal(low, uvec4(value))), lowWeights)
    + dot(vec4(equal(high, uvec4(value))), highWeights);
  if (weight > bestWeight) {
    best = value;
    bestWeight = weight;
  }
}

uint labelAt(highp usampler3D volume, ivec3 shape, vec3 voxel) {
  ivec3 base = ivec3(floor(voxel));
  vec3 fraction = voxel - vec3(base);
  uvec4 low = uvec4(
    labelCorner(volume, shape, base),
    labelCorner(volume, shape, base + ivec3(1, 0, 0)),
    labelCorner(volume, shape, base + ivec3(0, 1, 0)),
    labelCorner(volume, shape, base + ivec3(1, 1, 0)));
  uvec4 high = uvec4(
    labelCorner(volume, shape, base + ivec3(0, 0, 1)),
    labelCorner(volume, shape, base + ivec3(1, 0, 1)),
    labelCorner(volume, shape, base + ivec3(0, 1, 1)),
    labelCorner(volume, shape, base + ivec3(1, 1, 1)));
  if (all(equal(low, uvec4(low.x))) && all(equal(high, uvec4(low.x)))) return low.x;
  vec2 x = vec2(1.0 - fraction.x, fraction.x);
  vec2 y = vec2(1.0 - fraction.y, fraction.y);
  vec4 plane = vec4(x.x * y.x, x.y * y.x, x.x * y.y, x.y * y.y);
  vec4 lowWeights = plane * (1.0 - fraction.z);
  vec4 highWeights = plane * fraction.z;
  uint best = low.x;
  float bestWeight = -1.0;
  labelVote(low.x, low, high, lowWeights, highWeights, best, bestWeight);
  labelVote(low.y, low, high, lowWeights, highWeights, best, bestWeight);
  labelVote(low.z, low, high, lowWeights, highWeights, best, bestWeight);
  labelVote(low.w, low, high, lowWeights, highWeights, best, bestWeight);
  labelVote(high.x, low, high, lowWeights, highWeights, best, bestWeight);
  labelVote(high.y, low, high, lowWeights, highWeights, best, bestWeight);
  labelVote(high.z, low, high, lowWeights, highWeights, best, bestWeight);
  labelVote(high.w, low, high, lowWeights, highWeights, best, bestWeight);
  return best;
}
#endif
`;
