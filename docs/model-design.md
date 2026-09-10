# Brain model specification

Build a reusable, selectable reference brain, with a minimal local inspection
viewer. The user owns the eventual website interface.

## Scientific contract

- FreeSurfer fsaverage, full native resolution: 163,842 vertices per hemisphere.
- Preserve pial coordinates and triangle geometry; no smoothing, decimation,
  artistic deformation, or synthetic anatomy.
- Separate Destrieux anatomical and HCP-MMP1.0 multimodal cortical layers.
  HCP uses the published Mills projection to fsaverage, not native HCP geometry.
- Region labels remain discrete. Mixed-label triangles are partitioned into
  barycentric vertex cells using edge midpoints and the face centroid. These
  cells are a documented visualization convention, not measured subvertex
  anatomical boundaries. The partition preserves the complete source surface.
- Keep unknown/medial-wall faces explicitly identified as non-regions.
- Extract internal structures, cerebellum and brainstem from the matching
  fsaverage aseg volume at its actual voxel resolution, using marching cubes
  at 0.5 and its voxel-to-surface-RAS transform. No invented subnuclei.
- glTF coordinates in meters: (x, y, z) = (R, S, -A) / 1000. This is a proper
  rotation and scale; origin unchanged. Never describe these as MNI152.
- Preserve source normals across regional seams. Each region is a named mesh
  with atlas, hemisphere, source label ID, and stable region ID in extras.
- Supply machine-readable provenance, checksums, region manifest, numerical
  validation report, original scientific files, and redistribution notices.

## Deliverables

`public/models/cortex-destrieux.glb`, `cortex-hcp-mmp.glb`, `structures.glb`,
`manifest.json`, `validation.json`, plus unmodified source data in `data/`.
Provide a Blender scene assembled from these exports if Blender is available.
The inspection viewer loads atlas layers lazily, supports hover/click selection,
isolation, hemisphere selection, rotation, zoom and cortex visibility.

## Acceptance

Tests must establish complete triangle coverage and surface-area conservation,
correct source vertex ownership, proper coordinate handedness, normalized
normals, volume-to-surface alignment, unique IDs, and GLB round-trip metadata.
Integration validation compares every exported cortical triangle against its
source parent, bounds numerical export error, and accounts for all source
labels. Visually inspect the assembled model and test picking in a browser.

These checks establish conversion fidelity, not clinical accuracy or exact
individual anatomy. fsaverage is a reference template. HCP projection and
voxel segmentation have uncertainty that is not removed by dense meshing.
