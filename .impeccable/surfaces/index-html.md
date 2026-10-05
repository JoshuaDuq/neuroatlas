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

THESIS: One calm clinical task panel gives exploration, contextual inspection,
sections, and display controls a single home beside a generous anatomy view.

OWN-WORLD: Self-hosted Source Sans 3, one white ruled task panel, slate ink,
restrained teal, small control corners, flat underline tabs, and monochrome SVG
control icons. The dark scientific viewport retains its independent palette.

STORY: Explore anatomy, deficits, or circuits; select and inspect a region;
create sections; use View to choose the specimen, atlas, appearance, internal
detail, hemisphere, and visibility. Keep scientific operations reversible.

FIRST VIEWPORT: One 64px header above two columns: a 320px task panel and the
remaining width for the dark anatomical viewport. The footer is 32px. At
641–1000px, the task panel is 300px and stays beside the anatomy. There is no
outer workspace padding; a 1px separator and square panel edges join the work
areas. The header carries identity, a current-source readout, fullscreen, image
capture, and a settings menu that is collapsed by default at every width.

The task panel has one primary four-tab row: Explore, Region, Sections, View.
Desktop tabs stack 20px SVGs over labels in 64px controls with transparent
selected backgrounds and teal underline rules. Brand type is 20px, selected
anatomical names 22px, panel titles 18px, body 15px, controls 14px, and captions
12px. Outside Region, a selected label appears in a 44px full-width strip that
opens Region. In Explore, a new anatomical selection opens Region in the same
panel; Sections and View retain the active task on selection. Desktop Region
is disabled until context exists and returns to Explore when context clears.

Explore contains Anatomy, Deficits, and Circuits; the dissection dock stays at
its foot. Contextual anatomical, deficit, and circuit details replace exploration
within Region. Cutting planes use two equal columns of 52px minimum controls;
full-brain spans both columns. View consolidates specimen, cortical atlas,
internal anatomy, four appearance choices in a two-column grid, hemisphere,
visibility, and reset. The real region retains its scientific viewer outline.

Phones retain the existing sheet detents, camera insets, and renderer/chrome
synchronization. The header has a 64px minimum height and 18px brand; source and
subtitle hide. The same four task destinations use text tabs in the sheet.
Phone Region remains available with its existing empty hint and selection
behavior. Short landscape uses the side sheet: peek and half arrange tabs in
two rows; full arranges one row. Display controls stay in View at every width.

FORM: Clinical reference workspace; seed 077bf47c. The user's pinned light
clinical direction takes precedence over catalog materials and ranking. The
user rejected the earlier organization as too many panels and scattered
controls, approving this structural replacement within the same visual world.
The organization contract is `docs/superpowers/plans/2026-10-04-workspace-organization.md`.

FINISH: Review evidence lives in `.impeccable/review/workbench/`; the persistent
system is merged in DESIGN.md and `.impeccable/design.json`. The corrected light
control border is recorded from the current token source. Review findings are
interpreted against imported styles and rendered captures, with functional
sheet/progress motion and small geometry preserved.

No shipping rasters are created. Evidence screenshots are development files.
