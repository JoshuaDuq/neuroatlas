---
name: NeuroAtlas
description: A clinical workspace around source-faithful brain anatomy on a dark stage.
colors:
  text-primary: "#20272c"
  text-secondary: "#515b63"
  text-tertiary: "#667078"
  accent: "#156b6d"
  accent-hover: "#0d5557"
  accent-wash: "#e8f3f2"
  primary-fill: "#156b6d"
  primary-fill-hover: "#0d5557"
  primary-ink: "#ffffff"
  danger: "#a61b1b"
  surface-base: "#ffffff"
  surface-navigation: "#f8f9fa"
  surface-sunken: "#f1f3f4"
  surface-canvas: "#eef0f2"
  surface-hover: "#f3f5f6"
  surface-raised: "#ffffff"
  surface-tonal: "#f1f3f4"
  surface-tonal-hover: "#e7ebee"
  border-subtle: "#e2e6e9"
  border-control: "#7f8a94"
  thumb-ring: "#78838d"
  dark-text-primary: "#e9ebee"
  dark-text-secondary: "#b6bcc3"
  dark-text-tertiary: "#9ba2aa"
  dark-accent: "#7fd0cc"
  dark-accent-hover: "#a3e0dc"
  dark-accent-wash: "#1f3637"
  dark-primary-fill: "#2a7678"
  dark-primary-fill-hover: "#24686a"
  dark-danger: "#f1928f"
  dark-surface-base: "#1b1d20"
  dark-surface-navigation: "#18191c"
  dark-surface-sunken: "#141517"
  dark-surface-canvas: "#111214"
  dark-surface-hover: "#25272b"
  dark-surface-raised: "#3a3d42"
  dark-surface-tonal: "#27292d"
  dark-surface-tonal-hover: "#303338"
  dark-border-subtle: "#303338"
  dark-border-control: "#6d737b"
  dark-thumb-ring: "#7a8189"
  scene-background: "#0e1116"
  mpr-canvas: "#000000"
  overlay-ink: "#f1f2f4"
  overlay-ink-muted: "#aeb3ba"
  overlay-ink-faint: "#90969e"
  overlay-halo: "rgb(6 7 9 / 0.85)"
  overlay-halo-core: "#060709"
  overlay-danger: "#f1928f"
  overlay-plate: "#16171a"
  overlay-plate-hover: "#24262a"
  overlay-track: "#222428"
  overlay-track-hover: "#2b2e33"
  overlay-raised: "#3a3d42"
  overlay-border: "#3d4046"
  overlay-control-border: "#6d737b"
  overlay-accent: "#7fd0cc"
  overlay-accent-hover: "#a3e0dc"
  overlay-accent-wash: "#1f3637"
typography:
  brand:
    fontFamily: '"Source Sans 3 Variable", sans-serif'
    fontSize: 1.125rem
    fontWeight: 650
    lineHeight: max(28px, 1.75rem)
    letterSpacing: -0.02em
  headline:
    fontFamily: '"Source Sans 3 Variable", sans-serif'
    fontSize: 1.5rem
    fontWeight: 650
    lineHeight: max(28px, 1.75rem)
    letterSpacing: -0.02em
  title:
    fontFamily: '"Source Sans 3 Variable", sans-serif'
    fontSize: 1rem
    fontWeight: 600
    lineHeight: max(28px, 1.75rem)
    letterSpacing: -0.01em
  body:
    fontFamily: '"Source Sans 3 Variable", sans-serif'
    fontSize: 0.9375rem
    fontWeight: 400
    lineHeight: max(22px, 1.375rem)
  label:
    fontFamily: '"Source Sans 3 Variable", sans-serif'
    fontSize: 0.9375rem
    fontWeight: 500
    lineHeight: max(20px, 1.25rem)
  field-label:
    fontFamily: '"Source Sans 3 Variable", sans-serif'
    fontSize: 0.9375rem
    fontWeight: 400
    lineHeight: max(20px, 1.25rem)
  caption:
    fontFamily: '"Source Sans 3 Variable", sans-serif'
    fontSize: 0.8125rem
    fontWeight: 400
    lineHeight: max(18px, 1.125rem)
  marking:
    fontFamily: '"Source Sans 3 Variable", sans-serif'
    fontSize: 0.875rem
    fontWeight: 600
    lineHeight: 18px
    letterSpacing: 0.06em
  measurement:
    fontFamily: '"Source Sans 3 Variable", sans-serif'
    fontSize: 0.9375rem
    fontWeight: 400
    lineHeight: max(20px, 1.25rem)
  source-data:
    fontFamily: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace
    fontSize: 0.8125rem
    fontWeight: 400
    lineHeight: max(18px, 1.125rem)
rounded:
  flat: 0px
  track: 1px
  swatch: 2px
  thumb: 3px
  control: 4px
  panel: 8px
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
    height: 36px
  button-primary-hover:
    backgroundColor: "{colors.primary-fill-hover}"
  button-tonal:
    backgroundColor: "{colors.surface-tonal}"
    textColor: "{colors.text-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: 0 12px
    height: 36px
  button-tonal-hover:
    backgroundColor: "{colors.surface-tonal-hover}"
  button-quiet:
    backgroundColor: transparent
    textColor: "{colors.text-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: 0 12px
    height: 36px
  workspace-panel:
    backgroundColor: "{colors.surface-base}"
    width: clamp(340px, 25rem, 34vw)
  workspace-panel-compact:
    width: 340px
  masthead-select:
    backgroundColor: transparent
    textColor: "{colors.text-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: 0 26px 0 8px
    height: 28px
  search-field:
    backgroundColor: "{colors.surface-base}"
    textColor: "{colors.text-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: 0 36px 0 32px
    height: auto
    width: 100%
  mode-tab:
    backgroundColor: "{colors.surface-navigation}"
    textColor: "{colors.text-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.flat}"
    padding: 8px 4px
    height: auto
  mode-tab-selected:
    backgroundColor: "{colors.surface-base}"
    textColor: "{colors.accent}"
    typography: "{typography.label}"
    rounded: "{rounded.flat}"
    padding: 8px 4px
    height: auto
  task-controls:
    backgroundColor: "{colors.surface-navigation}"
    rounded: "{rounded.flat}"
    padding: 16px 24px
  visibility-control:
    backgroundColor: transparent
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.control}"
    size: 32px
  visibility-control-touch:
    size: 44px
  supporting-map-summary:
    textColor: "{colors.text-primary}"
    rounded: "{rounded.flat}"
    padding: 4px 0
    height: auto
  location-bar:
    backgroundColor: "{colors.surface-navigation}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.flat}"
    padding: 0 8px 0 24px
    height: 44px
  segmented-track:
    backgroundColor: "{colors.surface-navigation}"
    rounded: "{rounded.control}"
    padding: 2px
    height: 36px
  segmented-selected:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.thumb}"
    padding: 0 12px
    height: 32px
  browse-scope-selected:
    backgroundColor: "{colors.surface-tonal}"
    textColor: "{colors.text-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: 4px 8px
    height: 32px
  anatomical-row-selected:
    backgroundColor: "{colors.accent-wash}"
    textColor: "{colors.accent}"
    rounded: "{rounded.flat}"
    padding: 8px 24px
    height: 40px
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
    padding: 0 24px
    height: 41px
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
    width: 272px
  viewport-chip:
    backgroundColor: "{colors.overlay-plate}"
    textColor: "{colors.overlay-ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.control}"
    padding: 3px 8px
  notice:
    backgroundColor: "{colors.surface-tonal}"
    textColor: "{colors.text-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.flat}"
    padding: 4px 4px 4px 16px
---
# Design System: NeuroAtlas

## Overview

**Creative North Star: "The Clinical Reading Room"**

A calm clinical workspace in light or dark around a dark imaging stage. The
masthead states what data is loaded, one task panel explores and drills into
it, and the stage carries only the tools that act on the picture. Keep the
NeuroAtlas name, the cut-away brain mark, and English and French copy.

This is a visual direction, not a clinical claim. Preserve the “not clinical
anatomy” statement, scientific geometry, measurements, source labels,
provenance, and published data colours. Panel theme and renderer keep
independent palettes.

**Key Characteristics:**

- Anatomy leads; controls support it.
- Three homes: masthead = data, panel = modes, task controls and drill-in, stage = section and display tools.
- One task panel with clear task groups and quiet scientific tables; small corners only on controls.
- Three button ranks, one segmented vocabulary, one disclosure, one chevron.
- Flat surfaces; clear selected, focused, and disabled states.

## Colors

The frontmatter records the light workspace, its dark variant, and the
theme-independent stage palette.

### Primary

Restrained teal marks selected anatomy, links, and the selected mode’s text
and full-cell underline. Browse scope remains neutral. The one filled button reads `--primary-fill`; in the dark
theme, on the stage, and in the MRI viewer that fill is a deeper teal so it
does not outshine the anatomy, with white ink.

### Neutral

Three near-neutral inks set hierarchy. Base panels sit on a cool canvas; navigation,
sunken, hover, and tonal surfaces separate controls by small tonal shifts.
The search area and mode-tab row use the pale navigation surface, with a white
selected tab and white index separated by fine rules. Browse scope has a transparent group and a neutral
tonal fill on the selected button, without a ring or shadow. The status and
detail-location bars use the pale navigation ground.
Subtle borders divide content; control borders (3:1) identify fields; the
thumb ring (3:1 against the track) marks a selected segment. Danger is for
errors only. The dark theme keeps every role in neutral graphite.

### Stage

Stage controls re-scope the panel token names to the overlay palette
(plates, track, raised thumb, control border, overlay teal), so one component
vocabulary renders in both places. The scene ground is near-black; the MPR
slice canvas is true black (#000), as a workstation shows grey-scale slices.

**The Independent Palettes Rule.** UI teal communicates interaction. Tissue shading, atlas and network colours, streamline direction colours, outlines, orientation, and scale markings retain their scientific meaning in both themes.

## Typography

Source Sans 3 Variable, self-hosted through Fontsource, carries identity,
headings, controls, prose, and measured quantities. Tabular numerals align
measurements and coordinates without changing their face or size. The
monospace stack is reserved for copied source IDs, file names, and voxel
indices (13px). No decorative display face.

The research scale: brand (18px); selected region, deficit, and circuit landmark
headlines (24px); dialog, empty-state, and second-subject titles (16px);
body, controls, lists, datasheets, field labels, and segmented choices
(15px); scientific stage controls and orientation (14px); masthead captions,
notes, status bar, and list group headings (13px). Panel names live in the tabs; visible panel
headings are not repeated (their h2s stay for assistive technology).
Clinical and circuit prose use 22px lines; list rows use 20px lines; title
and headline lines use at least 28px. These line heights grow with the reader's text size. Selected labels strengthen
to (600), the region headline to (650), without changing size; mode-tab labels hold their bold width so a
selection never moves the others.

Numbers follow the reader's notation: French uses a decimal comma; negatives
use a true minus (U+2212); coordinates are signed and close with a narrow
no-break space before “mm” (U+202F), French axes separated by semicolons;
measured quantities take a thin space before the unit and between digit
groups; an absent value is an em dash, never zero.

**The Complete Name Rule.** Allow anatomical names and localized control labels to wrap. Prefer word boundaries; allow emergency wrapping when an anatomical name itself exceeds the panel at enlarged text sizes. Action rows wrap by content. Keep hemisphere labels explicit; truncate only compact selection readouts, the masthead summary's subject, and constrained navigation labels.

## Layout

Desktop is a full-height grid: masthead (`max(64px, 4rem)`) across, task panel
(`clamp(340px, 25rem, 34vw)`, usually 400px at the default text size on a wide desktop) beside the stage, status bar (`max(28px, 1.75rem)`)
across. At 641–1000px the panel is 340px wide. No outer
padding; 1px separators; panel insets (24px desktop, 16px tablet and phone);
shared 4px rhythm. The grid fits the visible viewport without a fixed minimum
height. Text-aware dimensions grow with the reader's text size.

**Masthead (data).** A 24px cut-away mark and 18px name occupy the panel
column, with a vertical divider aligned to the panel edge. Mode tabs remain
in the task panel at every desktop width, keeping navigation stable and
leaving room for labelled native data controls. The data bar starts
on the stage column; field spacing groups Subject and Atlas, with a single
subtle vertical rule before Colour separating identity from presentation. A 13px caption sits above each 28px native select,
with a 15px/500 value for Subject, Atlas, Colour (Tissue, T1, Regions,
Networks), and Internal anatomy. Native selects are transparent at rest;
hover, focus, or opening adds the tonal ground. Popover selects use the pale
navigation ground.
When the bar does not fit (measured, not a fixed breakpoint;
always in short landscape) it collapses to a two-line summary button: the
600-weight subject above quieter 13px Atlas · Colour · Internal anatomy settings.
It opens the same fields as a 320px popover. As room shrinks, internal anatomy,
then colour, then atlas drop from the second line; the subject truncates on
its own line. The accessible name retains every value. At the end:
fullscreen, Save image, and a ⋯ settings popover of labelled rows (Language,
Theme, Single-key shortcuts), then Keyboard shortcuts as a menu item; on
phones Full screen and Provenance join the menu. Settings are bounded by
the available viewport height and scroll vertically when needed. A “Skip to model” link is
the first Tab stop, invisible until focused.

**Task panel (task controls and drill-in).** One row of word tabs (at least
44px, `max(44px, 2.75rem)` on desktop) sits in the panel at every desktop width:
Anatomy, Functions, Deficits, Circuits, Tracts. Below 340px of row width the
labels step down to caption size. Tabs have automatic height and allow labels
to wrap within their cell when the reader enlarges text. Functions and Deficits paint the brain while in front: named
regions in their colours, every other region in tissue colour, keyed on the stage. The selected tab uses teal text on the base surface
and a full-cell 2px teal bottom rule on the pale navigation row. A 40px search field
starts each searchable task, with compact scope controls below it. Browse scope
uses neutral text and a grey selected button in a transparent group. They share
a pale task-control area with 16px top and bottom padding and an 8px gap, separated from
the white index by a thin neutral rule. Each mode is a list; opening an item
drills into
its detail under one location bar (44px, navigation ground): “‹ mode” back,
or in a lesson the circuit name with a “n of N” stepper. A selection strip
(44px) appears only when the panel is not already showing the selection.
Dissection docks at the explorer foot as one 41px line. Tracts docks its
single primary at the foot.

**Stage (picture tools).** A dock at the bottom-left of the visible stage: a
dark plate holding the view, Section ▾, and Display ▾ tools, with 4px gaps
inside each tool and 8px horizontal padding. The view tool
names the held preset and returns to View after free rotation. Its hidden
localized names reserve the widest label, so changing presets never shifts
the other tools. Presets are inside its popover; its accessible name reports
the held preset. Cutting a plane adds the section bar above the
toolbar (position slider and mm field, Reverse side, Linked MRI, close); this
is the only Linked MRI entry on the stage. Popovers open above the whole dock,
section bar included. Orientation letters sit at the visible edges, the scale
bar bottom right (above the dock when they cannot share the line), colour
keys top right. Framing fills about 80% of the visible stage on its tighter
axis, clear of the letters and scale bar; context framings never go below a
50 mm bounding radius. Letters are derived from camera position, target, and
up, so they always match the frame being drawn.

**Status bar.** One quiet ruled line, no cells: “Not clinical anatomy” in
500, a short hairline, the description (it truncates; the statement never
does), then “N visible regions” (tract bundles in Tracts) with tabular digits
and a quiet 24px Provenance text button opening a dialog of labelled rows
built from the anatomy index and manifest.

**Phones** (≤640px, or landscape ≤480px tall). The canvas is full bleed under
the sheet with peek, half, and full detents; short landscape uses a side
sheet. The masthead (`max(52px, 3.25rem)`) shows the mark and the two-line data
summary, growing with the reader's text size. The grip
merges the selection name, side, and clear with the “Not clinical anatomy”
statement on one row; the status bar hides. The stage plate holds the current view,
Section ▾, Display ▾ as equal worded tools, with 4px label-to-chevron gaps
and 4px horizontal padding; presets live in the View popover.
Orientation letters and scale bar hide while a stage popover is open and at
the full detent. Fine-pointer controls (36px) and rows (40px) become (44px) on
phones and coarse pointers. Keep safe-area insets and the one visible-viewport
rectangle shared by renderer and chrome. The upright working detent shares the available height evenly with the anatomy;
phone search controls use 8px gaps and vertical padding. The sheet settles on the iOS
drawer curve; a release faster than 0.4 px/ms over the last 100ms moves one
detent, a slower one settles by position; past either limit it gives with
rubber-band resistance capped at 72px; extra touches are ignored mid-drag.
Pointer cancellation returns the sheet to its prior detent. Keyboard activation
of its handle, selection, or tabs marks the sheet `data-instant`, so the panel
and its attached dock, orientation, and scale markings change immediately;
subsequent pointer detent changes restore the normal transition.
Sheet tabs mirror the desktop tabs without a rule above; peek pads for the home
indicator.

Dialogs share sticky ruled headers and insets (20px desktop, 16px phone);
Shortcuts and Provenance are bounded (560px), MRI viewers wide (1180px); all
go full-screen on phones.

## Elevation & Depth

The workspace is flat: tonal fills and fine rules, no card shadows. Browse
scope uses a neutral selected fill without a ring or shadow. Shadows are the
popover shadow (neutral
black, 0 6px 16px plus a 1px contact shadow) on the masthead popovers, skip
link, and dialogs, and the stronger overlay shadow on stage popovers. Tab
underlines are state rules, not elevation. Stage markings are type with an
opaque 3px rim and a stacked dark halo, not plates.

**The Flat Workspace Rule.** Use tonal surfaces and fine borders for the workspace. Reserve shadows for popovers and dialogs.

## Shapes

Controls, plates, and chips (4px); popovers, dialogs, and the sheet's
exposed corners (8px); rows, the panel, tabs, location bar, and docks are square.
Functional small radii are part of the system: segmented thumbs, checkboxes,
keycaps, and tract toggles (3px); network swatches, bars, and MPR canvases
(2px); slider tracks (1px); range thumbs and circuit step numbers (UI
face, tabular figures) are circles. Phone viewport and full-screen dialogs meet the screen edge.

Icons are monochrome inline SVG (16px, 1.5px round strokes). Every chevron
(disclosure, select caret, stage tool, data summary, back) is drawn from two
1.5px strokes, never a glyph. Decorative SVGs stay outside translated label
spans and hidden from assistive technology.

## Components

- **Buttons:** three ranks. One filled primary per view: Linked MRI in the
  region detail, “MRI with tracts” in Tracts. Tonal for every other command
  (Focus, Isolate, Close); an active Isolate takes the teal wash. Quiet
  text for recessive actions (Hide, Undo, Restore all, Reset view). Text-link
  actions (Restore previous view, return to landmark, mapped regions) are
  teal and underline on hover. Disabled: sunken ground, tertiary ink. Under
  increased contrast tonal buttons gain the control border. Commands answer a
  press with scale(0.97); rows, tabs, segments, tree items, and text links
  stay still. Hover styles apply only on hover-capable pointers.
- **Fields:** search, numbers, and panel selects use the base surface with the
  control border; hover darkens it. Masthead selects use transparent ground
  and borders at rest, with a tonal hover and focus surface; the collapsed
  popover uses the pale navigation ground. Every select carries the
  stroked chevron. Ranges
  are hollow rings on a 2px track. Fields grow to 16px text on coarse pointers.
- **Segmented choices:** one vocabulary for every exclusive choice (atlas,
  colour, language, theme, single-key shortcuts, presets, cutting
  plane, hemisphere, MRI plane): quiet track, raised thumb with a 1px ring,
  primary 600 label and no thumb shadow. The ring, not teal alone, marks the choice. Every group is
  one Tab stop with arrow, Home, and End movement (viewer/ui/roving.js).
  The explorer scope uses a transparent group with a 4px gap, 15px labels,
  and a neutral tonal fill on the selected button, without a ring or shadow.
  Its buttons have a 32px desktop minimum height; phones draw 36px controls
  inside a 44px hit area. Keyboard and focus behavior stays the same.
- **Mode tabs:** words with no cell dividers, at least 44px in the task panel
  at every desktop width and mirrored in the phone sheet. Automatic height,
  8px vertical padding, and wrapping labels accommodate enlarged reader text.
  Selected is teal 600 on the base surface with a full-cell 2px teal bottom rule.
  The row uses the pale navigation surface. Hover adds the
  hover surface; bold width is held so nothing shifts. Tabs are never
  disabled. Repeated navigation responds immediately, without a colour fade.
- **Anatomy tree:** a Whole brain | By system scope over the tree (By system
  opens the System picker beneath it and says the cortex is hidden). Whitespace
  and section labels separate the index
  sections, with thin neutral category rules after the first; 40px rows leave
  anatomical names readable. Open
  group captions use weight 500 and stay on the base surface without a filled band or bottom
  rule. They remain sticky, with indentation distinguishing their regions; a group name shared by two vocabularies is
  qualified (“Limbic lobe”, “Limbic system”). Selected rows take the teal
  wash; the keyboard target has a separate control-coloured outline. On fine
  pointers the 16px eye SVGs stay visible at rest in tertiary ink beside the
  hemisphere letters, strengthening on row hover or focus. Their columns retain
  their space without clipping or reflowing names. Targets are 32×32px on fine
  pointers and 44×44px on coarse pointers. Hidden is a struck eye in tertiary
  ink, never teal.
- **Region detail:** a 24px intro inset and 24px/650 headline with a quiet
  clear (×), followed by hemisphere and anatomical group as subordinate
  context. Their semantic labels remain accessible without repeating the
  values. Notes and research facts follow: area or volume, centroid, and source
  label, with aligned 15px labels and tabular values. A thin neutral rule then
  separates the compact action row: tonal Focus and Isolate, quiet Hide, and
  the filled Linked MRI action. All four share a row where they fit and wrap
  by content at enlarged text sizes. Long
  source values stack; long ID lists open as a native disclosure accessible
  with keyboard and touch. The atlas comparison
  follows, with Region / Area / Share caption headings, a flexible name
  column, 4.5rem area and 3.25rem share columns, aligned tabular figures, and
  rules only at the header and unassigned remainder. Detail sections are
  separated by 24px; functional-network rows use space rather than rules.
  Functional division, Neuropsychological domains, and Functional networks are
  collapsed native disclosures with fine bottom rules, 4px vertical section
  padding, and at least 36px summary targets (44px on touch). Each retains its
  open state between selections; opening adds 16px bottom padding and leaves
  the source notes and caveats beside their map.
  On phones the grip carries a compact readout at peek and while browsing.
  An open detail keeps its clear command in a 44px grip and shows the complete,
  wrapping name once in the body at 18px before its context.
  Constituents, neuropsychology, and guided-circuit links follow.
- **Deficit profile:** a ruled status strip first, saying what the stage now
  shows, with a quiet “Restore previous view” when there is one; then
  headline, definition, caveat, and collapsible association rows whose
  mapped regions stay in reach while closed.
- **Circuit lesson:** headline, role, description, the landmark's actions and
  datasheet, then the lesson's notes as full-width disclosures at the foot. A
  selection that is not the landmark becomes a ruled 16px second subject.
- **Tracts:** one row per tract at a 32px pitch, separated by space not
  rules; name then lettered L | R (or numbered segment) 28×24 tonal keys drawn
  as selection: teal wash, doubled teal edge, 600 letter. Metrics in one 12px
  line. Deficit and circuit group headings share the Anatomy section label.
  With a mouse, list-row chevrons show on hover, focus, or selection only. Scope notes in an “About this data”
  disclosure.
- **Notice:** one row under the mode tabs, square, on the tonal ground with
  primary ink at 15px; in the phone sheet it sits in the grip, so it shows at
  every detent and beside any detail. It says in the reader's words what
  changed or failed (a dropped colouring, a download, link fields not
  applied), stays until the next action, and ends with a quiet × that
  dismisses it. When only a reload can help, a tonal Reload sits before the
  ×. No colour of its own, not danger red; the page's announcer speaks it, so
  the row is not a live region.
- **Disclosure:** every disclosure shares one rhythm: 36px summary, 15px/500
  primary ink, a stroked chevron that turns on open, teal on hover.
- **Dissection dock:** the hint alone while nothing can be undone; otherwise
  “N parts hidden · Undo · Restore all”. Absent while loading and, on phones,
  while idle.
- **Stage controls:** overlay plates and ink in both themes. Section ▾ holds
  the cutting plane (two-column grid, Full spanning; one row of five short
  names on phones) and Cut labels. Display ▾ holds hemisphere, cortex and
  opacity, internal anatomy, spinal cord, and Reset view. The hover chip names
  the side and hides while the camera moves; the navigation hint fades after
  the first turn or zoom. The loading and error states use the overlay palette
  with a 200×2px progress bar and a tonal Retry.
  Functional-division and paint-key controls retain a 44px minimum target on
  phones and coarse pointers, including touch tablets.
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
  fire from panel or menu buttons. The native tract MRI viewer owns its
  letter keys while open, so atlas shortcuts cannot change the background.
  Focus lands somewhere visible after a
  clear, Escape, or a dialog closing.

Focus is a visible accent ring (2px, offset 2px), drawn inside for clipped
rows, tabs, and the canvas; the stage uses the overlay teal. Preserve
forced-colour and increased-contrast treatments. UI colour feedback (140ms)
and press (160ms) with the shared ease-out; popovers grow from their trigger,
opacity 0 and scale(0.97), in 160–180ms and leave in 120ms (masthead popovers
close at once); dialogs enter centred from scale(0.98) with a fading backdrop
(200ms in, 120ms out); camera and settled sheet movement (240ms); dragging
tracks directly; keyboard-initiated actions never animate. Reduced motion keeps
fades and colour, and drops every scale and movement. The loading
progress width and settled sheet height/width transitions are operational
motion; keep them.

Tooltips appear after a 500ms hover delay, or instantly during a 300ms
follow-on window and on keyboard focus. Their 125ms entry grows from the
trigger edge; instant entries skip animation. A 150ms departure delay lets
the pointer cross to the tooltip without losing its text. Escape dismisses it.

Detector notes: static scans of index.html miss the Vite-imported
stylesheets. Dialog rules live in dialogs.css; the status bar in masthead.css. The 1–3px radii above and the MPR canvas black are functional
and recorded; overlay tokens belong to the stage, not to panel backgrounds.

## Do's and Don'ts

### Do:

- Do use the shared palette, spacing, typography, and radius tokens in viewer/styles/tokens.css.
- Do keep data in the masthead, modes, task controls, and drill-in in the panel, and picture tools on the stage.
- Do preserve visible focus, ARIA semantics, keyboard operation, and English and French at every breakpoint.
- Do maintain readable hover, selected, disabled, empty, loading, and error states in both themes; text at least 4.5:1, field outlines and state edges at least 3:1.
- Do verify UI changes in the browser and with the existing tests.

### Don't:

- Don’t recolour scientific data to match the UI accent or replace real anatomy with synthetic illustrations.
- Don’t hide the “not clinical anatomy” statement in settings or add unsupported claims.
- Don’t stack navigation rows: one location bar per detail view.
- Don’t add a second filled button to a view, a new selected-state idiom, or a second disclosure style.
- Don’t add decorative icon backgrounds, count badges, redundant controls, or ornamental motion.

Small-screen settings stack each preference above its choices at 360px and below.
Scrollable panels establish their own containing block so hidden accessibility
text cannot enlarge the document. The deficit location bar uses a labelled,
tooltipped restore icon to keep the category breadcrumb readable.
