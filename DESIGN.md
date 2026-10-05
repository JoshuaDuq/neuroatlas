---
name: NeuroAtlas
description: A clinical workspace around source-faithful brain anatomy on a dark stage.
colors:
  text-primary: "#24343b"
  text-secondary: "#50616a"
  text-tertiary: "#61717a"
  accent: "#156b6d"
  accent-hover: "#0d5557"
  accent-wash: "#eaf4f2"
  primary-fill: "#156b6d"
  primary-fill-hover: "#0d5557"
  primary-ink: "#ffffff"
  danger: "#a61b1b"
  surface-base: "#ffffff"
  surface-navigation: "#f8fafb"
  surface-sunken: "#f0f4f5"
  surface-canvas: "#e3eaed"
  surface-hover: "#f0f5f5"
  surface-raised: "#ffffff"
  surface-tonal: "#e9eef0"
  surface-tonal-hover: "#dde5e8"
  border-subtle: "#e0e7ea"
  border-control: "#80919b"
  thumb-ring: "#75868f"
  dark-text-primary: "#edf3f7"
  dark-text-secondary: "#b9c7d2"
  dark-text-tertiary: "#9eafbd"
  dark-accent: "#82d3d0"
  dark-accent-hover: "#a5e3e0"
  dark-accent-wash: "#233e43"
  dark-primary-fill: "#2f8183"
  dark-primary-fill-hover: "#276f71"
  dark-danger: "#f1928f"
  dark-surface-base: "#1d2a33"
  dark-surface-navigation: "#1a262f"
  dark-surface-sunken: "#15222b"
  dark-surface-canvas: "#111c24"
  dark-surface-hover: "#26373f"
  dark-surface-raised: "#364a56"
  dark-surface-tonal: "#283842"
  dark-surface-tonal-hover: "#31434e"
  dark-border-subtle: "#34434d"
  dark-border-control: "#6b808d"
  dark-thumb-ring: "#74899a"
  scene-background: "#0e1116"
  mpr-canvas: "#000000"
  overlay-ink: "#f2f6fa"
  overlay-ink-muted: "#aab4c0"
  overlay-ink-faint: "#8d99a6"
  overlay-halo: "rgb(6 9 13 / 0.85)"
  overlay-halo-core: "#06090d"
  overlay-danger: "#f1928f"
  overlay-plate: "#181f28"
  overlay-plate-hover: "#25313e"
  overlay-track: "#232d38"
  overlay-track-hover: "#2c3845"
  overlay-raised: "#3a4857"
  overlay-border: "#3f4c5b"
  overlay-control-border: "#6b7d8c"
  overlay-accent: "#82d3d0"
  overlay-accent-hover: "#a5e3e0"
  overlay-accent-wash: "#213b40"
typography:
  brand:
    fontFamily: '"Source Sans 3 Variable", sans-serif'
    fontSize: 1rem
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: -0.02em
  headline:
    fontFamily: '"Source Sans 3 Variable", sans-serif'
    fontSize: 1.25rem
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: -0.015em
  title:
    fontFamily: '"Source Sans 3 Variable", sans-serif'
    fontSize: 1rem
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: -0.01em
  body:
    fontFamily: '"Source Sans 3 Variable", sans-serif'
    fontSize: 0.9375rem
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: '"Source Sans 3 Variable", sans-serif'
    fontSize: 0.875rem
    fontWeight: 500
    lineHeight: 1.2
  field-label:
    fontFamily: '"Source Sans 3 Variable", sans-serif'
    fontSize: 0.8125rem
    fontWeight: 400
    lineHeight: 1.45
  caption:
    fontFamily: '"Source Sans 3 Variable", sans-serif'
    fontSize: 0.75rem
    fontWeight: 400
    lineHeight: 1.5
  marking:
    fontFamily: '"Source Sans 3 Variable", sans-serif'
    fontSize: 0.8125rem
    fontWeight: 600
    lineHeight: 16px
    letterSpacing: 0.06em
  measurement:
    fontFamily: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace
    fontSize: 0.75rem
    fontWeight: 400
rounded:
  flat: 0px
  track: 1px
  swatch: 2px
  thumb: 3px
  control: 4px
  panel: 6px
spacing:
  space-1: 4px
  space-2: 8px
  space-3: 12px
  space-4: 16px
  space-5: 20px
  space-6: 24px
  space-8: 32px
  space-10: 40px
components:
  button-primary:
    backgroundColor: "{colors.primary-fill}"
    textColor: "{colors.primary-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: 0 12px
    height: 32px
  button-primary-hover:
    backgroundColor: "{colors.primary-fill-hover}"
  button-tonal:
    backgroundColor: "{colors.surface-tonal}"
    textColor: "{colors.text-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: 0 12px
    height: 32px
  button-tonal-hover:
    backgroundColor: "{colors.surface-tonal-hover}"
  button-quiet:
    backgroundColor: transparent
    textColor: "{colors.text-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: 0 12px
    height: 32px
  masthead-select:
    backgroundColor: "{colors.surface-tonal}"
    textColor: "{colors.text-primary}"
    typography: "{typography.field-label}"
    rounded: "{rounded.control}"
    padding: 0 32px 0 12px
    height: 32px
  search-field:
    backgroundColor: "{colors.surface-base}"
    textColor: "{colors.text-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: 0 36px 0 32px
    height: 32px
    width: 100%
  mode-tab-selected:
    backgroundColor: transparent
    textColor: "{colors.accent}"
    typography: "{typography.label}"
    rounded: "{rounded.flat}"
    padding: 0 8px
    height: 40px
  location-bar:
    backgroundColor: "{colors.surface-navigation}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.flat}"
    padding: 0 8px 0 16px
    height: 40px
  segmented-track:
    backgroundColor: "{colors.surface-tonal}"
    rounded: "{rounded.control}"
    padding: 2px
    height: 32px
  segmented-selected:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.accent}"
    typography: "{typography.field-label}"
    rounded: "{rounded.thumb}"
    padding: 0 12px
    height: 28px
  anatomical-row-selected:
    backgroundColor: "{colors.accent-wash}"
    textColor: "{colors.accent}"
    rounded: "{rounded.control}"
    padding: 4px 8px
    height: 32px
  tract-part-selected:
    backgroundColor: "{colors.accent-wash}"
    textColor: "{colors.accent}"
    typography: "{typography.caption}"
    rounded: "{rounded.thumb}"
    height: 24px
    width: 28px
  dissection-dock:
    backgroundColor: "{colors.surface-navigation}"
    rounded: "{rounded.flat}"
    padding: 2px 16px
    height: 36px
  stage-toolbar:
    backgroundColor: "{colors.overlay-plate}"
    textColor: "{colors.overlay-ink}"
    rounded: "{rounded.control}"
    padding: 2px
  stage-popover:
    backgroundColor: "{colors.overlay-plate}"
    textColor: "{colors.overlay-ink}"
    rounded: "{rounded.panel}"
    padding: 12px 16px 16px
    width: 288px
  viewport-chip:
    backgroundColor: "{colors.overlay-plate}"
    textColor: "{colors.overlay-ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.control}"
    padding: 3px 8px
---
# Design System: NeuroAtlas

## Overview

**Creative North Star: "The Clinical Reading Room"**

A calm clinical workspace in light or dark around a dark imaging stage. The
masthead states what data is loaded, one task panel explores and drills into
it, and the stage carries only the tools that act on the picture. Keep the
NeuroAtlas name, the existing brain mark, and English and French copy.

This is a visual direction, not a clinical claim. Preserve the “not clinical
anatomy” statement, scientific geometry, measurements, source labels,
provenance, and published data colours. Panel theme and renderer keep
independent palettes.

**Key Characteristics:**

- Anatomy leads; controls support it.
- Three homes: masthead = data, panel = modes and drill-in, stage = section and display tools.
- One ruled task panel at instrument density; small corners only on controls.
- Three button ranks, one segmented vocabulary, one disclosure, one chevron.
- Flat surfaces; clear selected, focused, and disabled states.

## Colors

The frontmatter records the light workspace, its dark variant, and the
theme-independent stage palette.

### Primary

Restrained teal marks selected anatomy, the selected mode tab, links, and
selection washes. The one filled button reads `--primary-fill`; in the dark
theme, on the stage, and in the MRI viewer that fill is a deeper teal so it
does not outshine the anatomy, with white ink.

### Neutral

Three slate inks set hierarchy. Base panels sit on a cool canvas; navigation,
sunken, hover, and tonal surfaces separate controls by small tonal shifts.
Subtle borders divide content; control borders (3:1) identify fields; the
thumb ring (3:1 against the track) marks a selected segment. Danger is for
errors only. The dark theme keeps every role in deep blue slate.

### Stage

Stage controls re-scope the panel token names to the overlay palette
(plates, track, raised thumb, control border, overlay teal), so one component
vocabulary renders in both places. The scene ground is near-black; the MPR
slice canvas is true black (#000), as a workstation shows grey-scale slices.

**The Independent Palettes Rule.** UI teal communicates interaction. Tissue shading, atlas and network colours, streamline direction colours, outlines, orientation, and scale markings retain their scientific meaning in both themes.

## Typography

Source Sans 3 Variable, self-hosted through Fontsource, carries identity,
headings, controls, and prose. The monospace stack is reserved for
measurements, coordinates, and source data, with tabular numerals, and runs a
step smaller (12px) beside the sans. No decorative display face.

The instrument scale: headlines for the selected region, deficit, and circuit
landmark (20px); brand, dialog, empty-state, and second-subject titles
(16px); body (15px); controls, lists, and datasheets (14px); masthead
captions, field labels, and segmented choices (13px); notes, status bar, and
list group headings (12px). Panel names live in the tabs; visible panel
headings are not repeated (their h2s stay for assistive technology).
Clinical and circuit prose use line height (1.55); list rows use 20px lines so
one-, two- and three-line rows keep the 4px grid. Selected labels strengthen
to (600) without changing size; mode-tab labels hold their bold width so a
selection never moves the others.

Numbers follow the reader's notation: French uses a decimal comma; negatives
use a true minus (U+2212); coordinates are signed and close with a narrow
no-break space before “mm” (U+202F), French axes separated by semicolons;
measured quantities take a thin space before the unit and between digit
groups; an absent value is an em dash, never zero.

**The Complete Name Rule.** Allow anatomical names and localized control labels to wrap. Never split a word: action rows wrap instead. Keep hemisphere labels explicit; truncate only compact selection readouts, the masthead summary's subject, and constrained navigation labels.

## Layout

Desktop is a full-height grid: masthead (48px) across, task panel (320px;
300px at 641–1000px) beside the stage, status bar (28px) across. No outer
padding; 1px separators; panel insets (16px); shared 4px rhythm.

**Masthead (data).** Identity, then a ruled data bar of one control family: a
13px secondary caption and a 32px tonal control for Subject, Atlas, Colour
(Tissue, T1, Regions, Networks), and Internal anatomy. Below 1280px wide (and
in short landscape) the bar collapses to a summary button, “Subject · Atlas ·
Colour”, that opens the same fields as a 320px popover; as room shrinks the
subject truncates, then the atlas drops, then the colour. At the end:
fullscreen, Save image, and a ⋯ settings popover of labelled rows (Language,
Theme, Single-key shortcuts), then Keyboard shortcuts as a menu item; on
phones Full screen and Provenance join the menu. A “Skip to model” link is
the first Tab stop, invisible until focused.

**Task panel (modes and drill-in).** One row of text tabs (40px): Anatomy,
Deficits, Circuits, Tracts. Each mode is a list; opening an item drills into
its detail under one location bar (40px, navigation ground): “‹ mode” back,
or in a lesson the circuit name with a “n of N” stepper. A selection strip
(40px) appears only when the panel is not already showing the selection.
Dissection docks at the explorer foot as one 36px line. Tracts docks its
single primary at the foot.

**Stage (picture tools).** A dock at the bottom-left of the visible stage: a
dark plate holding the view presets as a segmented group, a rule, then
Section ▾ and Display ▾. Cutting a plane adds the section bar above the
toolbar (position slider and mm field, Reverse side, Linked MRI, close); this
is the only Linked MRI entry on the stage. Popovers open above the whole dock,
section bar included. Orientation letters sit at the visible edges, the scale
bar bottom right (above the dock when they cannot share the line), colour
keys top right. Framing fills about 80% of the visible stage on its tighter
axis, clear of the letters and scale bar; context framings never go below a
50 mm bounding radius. Letters are derived from camera position, target, and
up, so they always match the frame being drawn.

**Status bar.** Description · “not clinical anatomy” (the description
truncates; the statement never does), then “N visible regions” (tract bundles
in Tracts) and a Provenance button opening a dialog of labelled rows built
from the anatomy index and manifest.

**Phones** (≤640px, or landscape ≤480px tall). The canvas is full bleed under
the sheet with peek, half, and full detents; short landscape uses a side
sheet. The masthead (52px min) shows the mark and the data summary. The grip
merges the selection name, side, and clear with the “Not clinical anatomy”
statement on one row; the status bar hides. The stage plate holds View ▾,
Section ▾, Display ▾ as equal worded tools; presets live in the View popover.
Orientation letters and scale bar hide while a stage popover is open and at
the full detent. Fine-pointer controls and rows (32px) become (44px) on
phones and coarse pointers. Keep safe-area insets and the one visible-viewport
rectangle shared by renderer and chrome.

Dialogs share sticky ruled headers and insets (20px desktop, 16px phone);
Shortcuts and Provenance are bounded (560px), MRI viewers wide (1180px); all
go full-screen on phones.

## Elevation & Depth

The workspace is flat: tonal fills and fine rules, no card shadows. Shadows
are the thumb shadow under selected segments, the popover shadow (neutral
black, 0 6px 16px plus a 1px contact shadow) on the masthead popovers, skip
link, and dialogs, and the stronger overlay shadow on stage popovers. Tab
underlines are state rules, not elevation. Stage markings are type with an
opaque 3px rim and a stacked dark halo, not plates.

**The Flat Workspace Rule.** Use tonal surfaces and fine borders for the workspace. Reserve shadows for segmented thumbs, popovers, and dialogs.

## Shapes

Controls, rows, plates, and chips (4px); popovers, dialogs, and the sheet's
exposed corners (6px); the panel, tabs, location bar, and docks are square.
Functional small radii are part of the system: segmented thumbs, checkboxes,
keycaps, and tract toggles (3px); network swatches, bars, and MPR canvases
(2px); slider tracks (1px); range thumbs and circuit step numbers are
circles. Phone viewport and full-screen dialogs meet the screen edge.

Icons are monochrome inline SVG (16px, 1.5px round strokes). Every chevron
(disclosure, select caret, stage tool, data summary, back) is drawn from two
1.5px strokes, never a glyph. Decorative SVGs stay outside translated label
spans and hidden from assistive technology.

## Components

- **Buttons:** three ranks. One filled primary per view: Linked MRI in the
  region detail, “MRI with tracts” in Tracts. Tonal for every other command
  (Focus, Isolate, Hide, Close); an active Isolate takes the teal wash. Quiet
  text for recessive actions (Undo, Restore all, Reset view). Text-link
  actions (Restore previous view, return to landmark, mapped regions) are
  teal and underline on hover. Disabled: sunken ground, tertiary ink. Under
  increased contrast tonal buttons gain the control border.
- **Fields:** search, numbers, and panel selects use the base surface with the
  control border; hover darkens it. Masthead selects are tonal and borderless
  like the segmented track. Every select carries the stroked chevron. Ranges
  are hollow rings on a 2px track. Fields grow to 16px text on coarse pointers.
- **Segmented choices:** one vocabulary for every exclusive choice (atlas,
  colour, language, theme, single-key shortcuts, tree scope, presets, cutting
  plane, hemisphere, MRI plane): tonal track, raised thumb with a 1px ring,
  teal 600 label. The ring, not teal alone, marks the choice. Every group is
  one Tab stop with arrow, Home, and End movement (viewer/ui/roving.js).
- **Mode tabs:** text only, 40px; selected is teal 600 with a 2px underline
  spanning the word plus 8px; hover changes ink only. Tabs are never disabled.
  Mirrored in the phone sheet.
- **Anatomy tree:** a Whole brain | By system scope over the tree (By system
  opens the System picker beneath it and says the cortex is hidden). Group
  rows are sticky while open; a group name shared by two vocabularies is
  qualified (“Limbic lobe”, “Limbic system”). Selected rows take the teal
  wash; the keyboard target has a separate control-coloured outline. On fine
  pointers the eye columns reserve no width: eyes appear over the row end on
  hover or focus and stay once something is hidden. Hidden is a struck eye in
  tertiary ink, never teal. Touch keeps every eye in view.
- **Region detail:** headline with a quiet clear (×), the action row, a ruled
  datasheet (label left, value right, measures in mono), then “Coordinates and
  source” as a stacked datasheet in a disclosure open by default, then
  constituents, functional networks, neuropsychology, and guided-circuit
  links as ruled sections.
- **Deficit profile:** a ruled status strip first, saying what the stage now
  shows, with a quiet “Restore previous view” when there is one; then
  headline, definition, caveat, and collapsible association rows whose
  mapped regions stay in reach while closed.
- **Circuit lesson:** headline, role, description, the landmark's actions and
  datasheet, then the lesson's notes as full-width disclosures at the foot. A
  selection that is not the landmark becomes a ruled 16px second subject.
- **Tracts:** one row per tract, name then lettered L | R (or numbered
  segment) toggles drawn as selection: teal wash, doubled teal edge, 600
  letter. Metrics in one 12px line. Scope notes in an “About this data”
  disclosure.
- **Disclosure:** every disclosure shares one rhythm: 36px summary, 14px/500
  primary ink, a stroked chevron that turns on open, teal on hover.
- **Dissection dock:** the hint alone while nothing can be undone; otherwise
  “N parts hidden · Undo · Restore all”. Absent while loading and, on phones,
  while idle.
- **Stage controls:** overlay plates and ink in both themes. Section ▾ holds
  the cutting plane (two-column grid, Full spanning; one row of five short
  names on phones) and Cut labels. Display ▾ holds hemisphere, cortex and
  opacity, internal anatomy, spinal cord, and Reset view. The hover chip names
  the side and hides while the camera moves; the navigation hint fades after
  the first turn or zoom.
- **Linked MRI viewer:** dark in both themes, like a reading workstation,
  because a light surround lowers perceived contrast in grey-scale slices. It
  re-scopes the panel tokens, so its components need no special cases.
- **Rendering:** a moving camera draws through a second pre-allocated
  pipeline at no more than 1 device pixel per CSS pixel within a ~2 MP
  budget, scaled to the canvas; 150ms after the camera rests the frame is
  redrawn at full resolution, so every still image is unchanged. Translucent
  cortex keeps three.js's default two-pass blending: forcing a single pass
  saved ~3ms of CPU per frame but measurably changed the picture.
- **Keyboard model:** the anatomy tree is one Tab stop. Arrows move between
  rows, Home/End jump, → opens a group or enters its first child (or a row's
  eye control), ← closes or returns to the parent, V toggles the focused
  row's visibility, Escape leaves an eye control. Range inputs own their
  arrows. Arrow keys on the focused 3D view rotate it and +/− zoom. Single-key
  shortcuts can be turned off in settings (persisted per reader) and never
  fire from panel or menu buttons. Focus lands somewhere visible after a
  clear, Escape, or a dialog closing.

Focus is a visible accent ring (2px, offset 2px), drawn inside for clipped
rows, tabs, and the canvas; the stage uses the overlay teal. Preserve
forced-colour and increased-contrast treatments. UI colour feedback (140ms)
with the shared easing; camera and settled sheet movement (240ms); dialog
entry (180ms); dragging tracks directly. Respect reduced motion. The loading
progress width and settled sheet height/width transitions are operational
motion; keep them.

Detector notes: static scans of index.html miss the Vite-imported
stylesheets. The 1–3px radii above and the MPR canvas black are functional
and recorded; overlay tokens belong to the stage, not to panel backgrounds.

## Do's and Don'ts

### Do:

- Do use the shared palette, spacing, typography, and radius tokens in viewer/styles/tokens.css.
- Do keep data in the masthead, modes and drill-in in the panel, and picture tools on the stage.
- Do preserve visible focus, ARIA semantics, keyboard operation, and English and French at every breakpoint.
- Do maintain readable hover, selected, disabled, empty, loading, and error states in both themes; text at least 4.5:1, field outlines and state edges at least 3:1.
- Do verify UI changes in the browser and with the existing tests.

### Don't:

- Don’t recolour scientific data to match the UI accent or replace real anatomy with synthetic illustrations.
- Don’t hide the “not clinical anatomy” statement in settings or add unsupported claims.
- Don’t stack navigation rows: one location bar per detail view.
- Don’t add a second filled button to a view, a new selected-state idiom, or a second disclosure style.
- Don’t add decorative icon backgrounds, count badges, redundant controls, or ornamental motion.
