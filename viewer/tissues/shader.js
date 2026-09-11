export const vertexShader = `
  out vec3 sourceWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    sourceWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

export const fragmentShader = `
  precision highp usampler3D;
  uniform highp usampler3D labelVolume;
  uniform sampler2D labelPalette;
  uniform mat4 worldToVoxel;
  uniform ivec3 volumeShape;
  in vec3 sourceWorld;
  out vec4 tissueColor;
  void main() {
    vec3 voxel = (worldToVoxel * vec4(sourceWorld, 1.0)).xyz;
    ivec3 cell = ivec3(floor(voxel + vec3(0.5)));
    if (any(lessThan(cell, ivec3(0))) || any(greaterThanEqual(cell, volumeShape))) discard;
    uint code = texelFetch(labelVolume, cell, 0).r;
    vec4 color = texelFetch(labelPalette, ivec2(int(code), 0), 0);
    if (color.a < 0.5) discard;
    tissueColor = color;
  }
`;
