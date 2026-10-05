# Restore MRI navigation

The user explicitly requested the previous MRI view while SNAIL reconstruction
continues. Add an MRI navigation action to Tracts, also reached with M. Open a
focused scan workspace with linked axial, coronal and sagittal sections, a 3D
reference, crosshair and zero-based source voxel inputs. Use the published SNAIL
T1 and FA maps, their unchanged physical transforms and the enabled tract bundles.
Preserve the main viewer's atlas/tract composition and existing anatomy MRI view.

Load NiiVue and the maps only on opening. Render all tract points as deterministic
lines; reuse cached data on reopening and commit expensive contrast updates on
release. Surface loading errors in the workspace with retry. Source names,
dimensions, voxel spacing, scanner RAS coordinates and T1/FA values remain visible.
On phones, default to one selectable MRI plane. Use the incumbent clinical dialog
tokens, keyboard close, visible focus and translated controls.

The crosshair can position the normal cutting plane only when the active anatomy
is SNAIL. Convert scanner RAS to FreeSurfer surface RAS using the validated header
transform; never apply SNAIL scan positions to another subject. Original maps have
cropped inferior coverage, and cortical parcels remain surface labels.

NiiVue's installed 0.69 public API and source are the integration authority for
linked slices, location callbacks, image loading and line tract rendering.
