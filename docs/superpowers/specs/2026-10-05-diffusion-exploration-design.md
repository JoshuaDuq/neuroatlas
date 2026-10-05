# Diffusion and tract exploration

Extend NeuroAtlas's established clinical workspace with an Explore → Tracts
entry and a dedicated, full-screen diffusion workspace. The user clarified that
users must not need their own data. Bundle a real published diffusion dataset
and named tract reconstructions, with reference images from the same subject.

## Workflow

Opening automatically loads the bundled reference, diffusion map and a small
initial set of bundles. NiiVue supplies linked orthogonal slices and a 3D view,
native spatial transforms, crosshair navigation and direction coloring. Named
tract bundles load on demand and remain in browser memory across close/reopen.
Export a PNG of the view or CSV of bundle geometry. There are no upload controls.

The panel provides volume opacity, colormap and explicit contrast
limits; bundle visibility; global/local direction coloring; tract radius; and
minimum streamline length. Show file names, dimensions, voxel spacing, RAS
crosshair coordinates, voxel values, total and displayed streamline counts,
and geometric length summaries in millimeters. Streamlines are not axon counts.
Lightweight lines are the default; optional tubes trade graphics memory for
thickness. Tract updates never rebuild the MRI textures, hidden geometry updates
on reveal, and sliders commit expensive geometry changes on release.

## Scientific boundaries

The published images and bundles share their subject's physical coordinate
space. Validate this against the original files. The workspace uses file
transforms and does not align them automatically or
overlay them on the repository's FreeSurfer specimens. Validate the published
maps and bundles, rejecting raw 4D acquisitions, vector maps, missing spatial transforms,
non-millimeter units, invalid dimensions, nonfinite coordinates and malformed
streamline offsets. Surface loading errors without substituting content.
There are no fabricated diffusion metrics, schematic tractograms, raw-data
reconstruction or inferred connectivity claims.

## Structure and validation

Lazy-load the established @niivue/niivue package when the workspace opens.
Use the CC0 SNAIL example dataset linked by DIPY's official fetcher, retain
source geometry and record original checksums, license and reference transforms.
Keep input validation, streamline geometry, renderer integration, bilingual
copy and DOM controls in focused modules. Preserve existing anatomical controls
and current uncommitted work. Use the incumbent tokens and responsive behavior;
the diffusion workspace needs its own protected canvas and input focus.

Test format rejection, spatial metadata, geometric lengths and filtering.
Run the existing JavaScript suite and production build. Inspect the actual
workspace with the published reference and tractograms, plus mobile layout,
empty state, errors and keyboard close/reopen.

## Established examples reviewed

- [NiiVue volume and mesh loading](https://niivue.com/docs/loading/)
- [NiiVue streamline rendering](https://niivue.com/docs/mesh/)
- [DIPY streamline formats and spatial conventions](https://docs.dipy.org/stable/examples_built/file_formats/streamline_formats.html)

NiiVue's installed source and public TypeScript declarations are the API
authority for the integration. DIPY's example motivates explicit spatial
metadata and avoiding claims that matching file bounds establish registration.
