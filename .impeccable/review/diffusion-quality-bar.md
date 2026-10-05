# Diffusion workspace quality bar

This narrow, code-led extension inherits NeuroAtlas's clinical world from
DESIGN.md, its tokens and established controls. No identity change or approved
image comp is involved.

- Real published images and reconstructed streamlines lead the canvas.
- Camera views, tract selection and export actions are findable and readable.
- The 320px wide desktop rail, 300px compact rail and bounded scrolling phone
  rail preserve canvas space.
- Interactive labels meet the shared 32px desktop and 44px touch target tokens.
- English and French remain readable, including source filenames and measurements.
- Original source geometry, standard direction colors and provenance remain intact.
- Tract changes avoid MRI texture reconstruction; default geometry uses lines.

The completed extension puts SNAIL's own validated cortical reconstruction and
tracts in the normal viewer. It inherits the existing camera presets, scale, orientation,
sidebar and phone sheet. Brain transparency and minimum length remain simple
controls. The requested optional MRI navigator uses linked SNAIL T1/FA sections,
exact voxel positioning and selected tract lines, loaded on demand and cached.
The normal MRI appearance remains in the anatomy viewer. Matching SNAIL anatomy retains
atlas regions, picking, MRI and sections with an independent tract layer.
Opening Tracts enables that layer; returning to Anatomy keeps it visible.
The actual cortical reconstruction replaces the display outline, and its shared
opacity reveals the tracts. Sections clip both in the same world coordinates.
Other anatomical subjects use the isolated reference only: atlas-specific tools
remain disabled and the outline is labeled as MRI-derived, without cortical
atlas labels. A rigid, header-derived transform aligns
the reference scanner coordinates with FreeSurfer's surface coordinates;
streamline geometry and length measurements remain unchanged.
