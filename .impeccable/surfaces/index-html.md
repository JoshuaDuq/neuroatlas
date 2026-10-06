---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: []
---

# Clinical anatomical workspace

Scope: existing index.html web viewer. Mode: Operate. Preserve the scientific
renderer, real anatomical content, existing controls, and bilingual copy.

The user selected a light clinical workspace and direct implementation in the
working app. This pinned direction governs the concept seed 077bf47c. The
catalog's alternate materials do not replace the selected clinical direction.

## Direction contract

THESIS: Three homes, each with one job: the masthead states what data is
loaded, one task panel explores and drills into it, and the dark stage carries
only the tools that act on the picture.

OWN-WORLD: Self-hosted Source Sans 3, ruled achromatic chrome (neutral cool
grey in light, graphite in dark) so teal and the anatomy carry the only colour,
restrained teal, small control corners, full-height 1px rules, equal ruled mode
cells, ringed word choices, and monochrome SVG control icons. The dark
scientific viewport retains its independent palette, and every exported image
carries its own annotations.

STORY: Choose the subject, atlas, colouring, and internal anatomy in the
masthead, each with a one-line note on what it is. In the panel, pick a mode
(Anatomy, Deficits, Circuits, Tracts), open an item, and read its detail under
one location bar: a path (“‹ Anatomy › Frontal”) whose group returns to the
row in the tree, or in a lesson the circuit, its stepper, and the numbered
landmark sequence. Frame, cut, and adjust the picture from the one-plate stage
dock. Opening a deficit or lesson states what it did to the stage and offers
the way back. Save image exports the picture with its letters, scale, caption,
key, and the “not clinical anatomy” statement. Scientific operations stay
reversible.

FIRST VIEWPORT: A 48px masthead over two columns, a 320px task panel (300px at
641–1000px) and the dark stage, above a 28px status bar (Not clinical anatomy |
description | N visible regions | Provenance, ruled). The masthead is identity,
then a ruled instrument banner of full-height cells, each a 12px caption beside
a quiet value (Subject and Internal anatomy as quiet selects; Atlas and Colour
incl. Networks as ringed word choices), then fullscreen, Save image, and a ⋯
settings datasheet (Language, Theme System | Light | Dark, Single-key
shortcuts) plus Keyboard shortcuts. Below 1280px the banner is a summary button
(“Subject · Atlas · Colour · Internal anatomy”, internal anatomy dropped first,
then atlas, then colour) opening the same fields with their notes. “Skip to
model” is the first Tab stop; the theme follows the OS until the reader picks.

The panel opens on four equal ruled 40px mode cells (selected: panel ground,
2px teal rule on top), then the Anatomy list: search, a Whole brain | By system
scope, the tree with counts in a right column and hover-revealed eye columns
on fine pointers, and the dissection dock at its foot. A detail replaces the
list under one 40px location bar and ends on a rule; a selection strip appears
only when the panel is not already showing the selection. The stage dock sits
bottom left as one plate: anatomical presets (Oblique, Left, Right, Anterior,
Posterior, Superior, Inferior) inline where they fit or behind a View ▾ chooser
named for the held view, then Section ▾ and Display ▾; a cut adds the section
row above the tools in the same plate (compact behind its disclosure when it
would wrap), the stage's only Linked MRI entry, and popovers open above it.
Anatomy is framed to about 80% of the visible stage, clear of the orientation
letters and scale bar.

Phones keep the sheet detents, camera insets, and renderer/chrome
synchronization. The masthead (52px min) shows the mark and data summary; the
grip merges the selection, or at peek the handle, with the “Not clinical anatomy” statement; the stage
plate shows View ▾ / Section ▾ / Display ▾, with presets in the View popover
and markings hidden while a popover is open or the sheet is full. Short
landscape uses the side sheet.

FORM: Clinical reference workspace; seed 077bf47c, light and dark panel
themes around a stage that is dark in both. The previous organization
(Explore / Region / Sections / View tabs, data and display settings in the
panel) was replaced after critique for stacked navigation rows, split
concepts, and mixed control dialects; the shipped organization is the one
above, recorded in DESIGN.md.

FINISH: Round 4 evidence lives in `.impeccable/review/round4/` (desktop light
and dark in every mode, cut with popovers, 1100px summary, 820px French, the
reader's 800×600 French dark viewport, phone detents, an annotated export) and
the critique `.impeccable/critique/2026-10-06T02-01-33Z__index-html.md`. The
persistent system is DESIGN.md. Functional 1–3px radii, the true-black MPR
canvas, the renderer's blue-black scene ground, the loading progress width, and
settled sheet motion are recorded as intended. Deficit, lesson, and tract render
emphasis is unchanged pending the user's accuracy decision.

No shipping rasters are created. Evidence screenshots are development files.

## Diffusion extension

The Tracts tab shares the existing renderer and camera. New sessions open the
validated SNAIL subject's actual cortical reconstruction; its real streamlines
form an optional retained layer over the atlas. A searchable
bundle list, source filenames, counts, length filter, opacity, and CSV export
inherit the established controls. Native indexed lines preserve original points
and avoid tube geometry. An optional MRI-navigation dialog restores the requested
linked SNAIL T1/FA slices, exact voxel crosshair and selected tract lines. It loads
on demand and caches its data. Masthead T1 colouring uses the matching SNAIL
anatomy's existing scan and uniforms. Atlas regions,
picking and section cuts remain available; returning to Anatomy keeps the tract
layer visible. Shared cortex opacity reveals tracts through the reconstructed
parcels. Other specimens use the isolated SNAIL reference and T1-derived outline.
SNAIL's default publication follows successful reconstruction and full
source-to-asset validation. Destrieux is its own parcellation; HCP-MMP is an
explicit registered-sphere projection. MRI crosshair movement positions the
normal cutting plane through the exact image-header coordinate transform.
