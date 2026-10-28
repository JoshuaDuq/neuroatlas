---
name: Planum
description: A clinical workspace around source-faithful brain anatomy on a dark stage.
colors:
  text-primary: "#232a30"
  text-secondary: "#555f68"
  text-tertiary: "#606a72"
  accent: "#28615d"
  accent-hover: "#1d4d49"
  accent-wash: "#edf3f1"
  primary-fill: "#28615d"
  primary-fill-hover: "#1d4d49"
  primary-ink: "#ffffff"
  danger: "#a61b1b"
  surface-base: "#ffffff"
  surface-navigation: "#f7f8f9"
  surface-sunken: "#f0f2f3"
  surface-canvas: "#f3f4f5"
  surface-hover: "#f1f4f4"
  surface-raised: "#ffffff"
  surface-tonal: "#eef1f2"
  surface-tonal-hover: "#e4e9eb"
  border-subtle: "#e0e5e7"
  border-control: "#77828c"
  thumb-ring: "#78838d"
  dark-text-primary: "#e9ebee"
  dark-text-secondary: "#b6bcc3"
  dark-text-tertiary: "#9ca3ab"
  dark-accent: "#7fd0cc"
  dark-accent-hover: "#a3e0dc"
  dark-accent-wash: "#1f3637"
  dark-primary-fill: "#2a7678"
  dark-primary-fill-hover: "#24686a"
  dark-danger: "#f1928f"
  dark-surface-base: "#1b1e21"
  dark-surface-navigation: "#191c1f"
  dark-surface-sunken: "#141517"
  dark-surface-canvas: "#111214"
  dark-surface-hover: "#25272b"
  dark-surface-raised: "#343a40"
  dark-surface-tonal: "#272d32"
  dark-surface-tonal-hover: "#303338"
  dark-border-subtle: "#303338"
  dark-border-control: "#7d848c"
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
  scrim: "rgb(6 7 9 / 0.5)"
  scrim-imaging: "rgb(6 7 9 / 0.72)"
typography:
  brand:
    fontFamily: '"Source Sans 3 Variable", sans-serif'
    fontSize: 1.1875rem
    fontWeight: 600
    lineHeight: max(28px, 1.75rem)
    letterSpacing: -0.02em
  headline:
    fontFamily: '"Source Sans 3 Variable", sans-serif'
    fontSize: 1.5rem
    fontWeight: 600
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
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: max(22px, 1.375rem)
  label:
    fontFamily: '"Source Sans 3 Variable", sans-serif'
    fontSize: 0.875rem
    fontWeight: 500
    lineHeight: max(20px, 1.25rem)
  field-label:
    fontFamily: '"Source Sans 3 Variable", sans-serif'
    fontSize: 0.875rem
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
    fontSize: 0.875rem
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
  mark: 2px
  small: 3px
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
  icon-button:
    backgroundColor: transparent
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.control}"
    size: 32px
  workspace-panel:
    backgroundColor: "{colors.surface-base}"
    rounded: "{rounded.flat}"
    width: 360px
  workspace-panel-compact:
    width: 320px
  masthead-select:
    backgroundColor: transparent
    textColor: "{colors.text-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: 4px 24px 4px 8px
    height: 32px
  menu-row:
    backgroundColor: "{colors.surface-base}"
    textColor: "{colors.text-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.flat}"
    padding: 0 12px
    height: 40px
  search-field:
    backgroundColor: "{colors.surface-navigation}"
    textColor: "{colors.text-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: 0 36px 0 32px
    height: 32px
    width: 100%
  mode-tab:
    backgroundColor: transparent
    textColor: "{colors.text-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.flat}"
    padding: 8px 4px
    height: auto
  mode-tab-selected:
    backgroundColor: transparent
    textColor: "{colors.accent}"
    typography: "{typography.label}"
    rounded: "{rounded.flat}"
    padding: 8px 4px
    height: auto
  task-controls:
    backgroundColor: "{colors.surface-base}"
    rounded: "{rounded.flat}"
    padding: 12px 24px
  region-action:
    backgroundColor: "{colors.surface-tonal}"
    textColor: "{colors.text-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: 4px 12px
    height: 32px
  region-mri:
    backgroundColor: "{colors.surface-tonal}"
    textColor: "{colors.accent}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: 4px 12px
    height: 32px
  visibility-control:
    backgroundColor: transparent
    textColor: "{colors.text-primary}"
    rounded: "{rounded.control}"
    width: 32px
    height: 28px
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
    backgroundColor: "{colors.surface-tonal}"
    rounded: "{rounded.control}"
    padding: 2px
    height: 32px
  segmented-selected:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.small}"
    padding: 0 12px
    height: 28px
  browse-scope-selected:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-primary}"
    typography: "{typography.caption}"
    rounded: "{rounded.small}"
    padding: 0 8px
    height: 28px
  anatomical-row-selected:
    backgroundColor: "{colors.accent-wash}"
    textColor: "{colors.accent}"
    rounded: "{rounded.flat}"
    padding: 6px 24px
    height: 32px
  tract-part-selected:
    backgroundColor: "{colors.accent-wash}"
    textColor: "{colors.accent}"
    typography: "{typography.caption}"
    rounded: "{rounded.small}"
    height: 24px
    min-width: 28px
  dissection-dock:
    backgroundColor: "{colors.surface-navigation}"
    rounded: "{rounded.flat}"
    padding: 0 24px
    height: 45px
  stage-toolbar:
    backgroundColor: "{colors.overlay-plate}"
    textColor: "{colors.overlay-ink}"
    rounded: "{rounded.control}"
    padding: 4px
  stage-tool:
    backgroundColor: transparent
    textColor: "{colors.overlay-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.small}"
    padding: 0 12px
    height: 32px
  stage-popover:
    backgroundColor: "{colors.overlay-plate}"
    textColor: "{colors.overlay-ink}"
    rounded: "{rounded.panel}"
    padding: 12px 16px
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
    padding: 4px 4px 4px 24px
  dialog-header:
    backgroundColor: "{colors.surface-base}"
    textColor: "{colors.text-primary}"
    typography: "{typography.title}"
    rounded: "{rounded.flat}"
    padding: 4px 20px
    height: 48px
---
# Design System: Planum

## Overview

**Creative North Star: "The Clinical Reading Room"**

A calm clinical workspace in light or dark around a dark imaging stage. The
masthead holds the available data choices in one compact bar, one task panel searches
and drills into it, and the stage carries the tools that act on the picture. Keep the
Planum name, the cut-away brain mark, and English and French copy.

This is a visual direction, not a clinical claim. Preserve the “not clinical
anatomy” statement, scientific geometry, measurements, source labels,
provenance, and published data colours. Panel theme and renderer keep
independent palettes.

**Key Characteristics:**

- Anatomy leads; controls support it.
- Three homes: masthead = data and workspace settings, panel = exploration modes and drill-in, stage = section and display tools.
- One continuous workspace with clear task groups and quiet scientific tables; one fine rule separates navigation from the stage.
- Three button ranks, one segmented vocabulary, one disclosure, one chevron.
- Flat surfaces; clear selected, focused, and disabled states.

## Colors

The frontmatter records the light workspace, its dark variant, and the
theme-independent stage palette.

### Primary

Restrained teal marks selected anatomy, links, and the selected mode’s text
and fine underline. Mode tabs keep a transparent ground; selected anatomy uses
the teal wash. Segmented choices, browse scope included, stay neutral. The filled primary reads `--primary-fill`; in the dark
theme, on the stage, and in the MRI viewer that fill is a deeper teal so it
does not outshine the anatomy, with white ink.

### Neutral

Three near-neutral inks set hierarchy. Base panels sit on a cool canvas; navigation,
sunken, hover, and tonal surfaces separate controls by small tonal shifts.
The search controls and index use the base surface; modes use the navigation
ground above the task panel. The
unfocused search field uses the navigation ground, with fine rules and a
tab selection underline providing structure. The masthead and
status bar use the base surface with fine separating rules; detail-location bars use the pale navigation ground.
Subtle borders divide content; control borders (3:1) identify fields; the
thumb ring (3:1 against the track) marks a selected segment. Danger is for
errors only. Selected text takes a 24% teal wash and keeps its ink; every
scroller shares one thin scrollbar in tertiary ink (40%, 60% under a hovering
pointer). The dark theme keeps every role in neutral graphite.

### Stage

Stage controls re-scope the panel token names to the overlay palette
(plates, track, raised thumb, control border, overlay teal), so one component
vocabulary renders in both places. The scene ground is near-black; the MPR
slice canvas is true black (#000), as a workstation shows grey-scale slices.
Dialog backdrops dim the page with the halo core at 50% (`--scrim`); the MRI
viewers dim it further, at 72% (`--scrim-imaging`).

**The Independent Palettes Rule.** UI teal communicates interaction. Tissue shading, atlas and network colours, streamline direction colours, outlines, orientation, and scale markings retain their scientific meaning in both themes.

## Typography

Source Sans 3 Variable, self-hosted through Fontsource, carries identity,
headings, controls, prose, and measured quantities. Tabular numerals align
measurements and coordinates without changing their face or size. The
monospace stack is reserved for copied source IDs, file names, and voxel
indices (13px). No decorative display face.

The research scale: brand (19px); selected region, deficit, and circuit landmark
headlines (24px); dialog, empty-state, and second-subject titles (16px);
body, controls, mode tabs, lists, datasheet values, field labels, and segmented choices
(14px); scientific stage controls and orientation (14px; 13px orientation and
scale on phones); masthead captions, stage popover field labels, notes, status
bar, browse scope, facts labels, list column heads, and list group headings
(13px), without letter-spacing. Panel names live in the tabs; visible panel
headings are not repeated (their h2s stay for assistive technology).
Clinical and circuit prose use 22px lines; list rows use 20px lines; title
and headline lines use at least 28px. These line heights grow with the reader's text size. Selected labels strengthen
to (600), matching brand and headline weight, without changing size; mode-tab labels hold their bold width so a
selection never moves the others.

Numbers follow the reader's notation: French uses a decimal comma; negatives
use a true minus (U+2212); coordinates are signed and close with a narrow
no-break space before “mm” (U+202F), French axes separated by semicolons;
measured quantities take a thin space before the unit and between digit
groups; an absent value is an em dash, never zero.

**The Complete Name Rule.** Allow anatomical names and localized control labels to wrap. Prefer word boundaries; allow emergency wrapping when an anatomical name itself exceeds the panel at enlarged text sizes. Action rows wrap by content. Keep hemisphere labels explicit; truncate only compact selection readouts, the masthead summary, and constrained navigation labels.

## Layout

Desktop is a full-height grid: a single masthead (`max(48px, 3rem)`) across,
task panel (360px) beside the stage, status bar (`max(32px, 2rem)`) across.
At 801–1000px the panel is 320px wide. The panel and stage meet without outer
gutters or enclosing frames; one fine vertical rule separates them. The header
and footer use fine horizontal rules. Panel insets (24px desktop, 20px compact desktop, 16px phone);
shared 4px rhythm. Stage chrome stands on one stage gutter (20px; on phones it
takes the panel inset), and the masthead's last glyph and the status bar's last
word end on the same line. The grid fits the visible viewport without a fixed minimum
height. Text-aware dimensions grow with the reader's text size.

**Masthead (data and workspace settings).** A 24px cut-away mark and 19px name
align with the task panel. Atlas, Colour and Internal anatomy are inline
“Caption Value ⌄” pairs, the first caption on the stage gutter over the stage's
hint and dock, with 24px of ink between fields; image and workspace actions
(32px icon buttons) sit at the end, the last glyph on the stage gutter. The single subject
is identified in the footer and provenance rather than repeated as a field.
A subject selector appears only when there is a choice; independent tract
references retain their name in the bar. Labelled native data controls expand
where the measured space permits. A tertiary-ink 13px caption sits 4px before each native select
(control height, 4px vertical padding), on the value's baseline,
with 14px values: weight 600 for Subject and 500 for Atlas, Colour (Tissue,
T1, Regions, Networks), and Internal anatomy. Native selects are transparent at rest;
hover, focus, or opening adds the tonal ground, as hover does for the icon
buttons at the end. Popover fields (compact and phone) are full-width fields
with the 1px control border on the base ground at control height (44px on
coarse pointers).
When the bar does not fit, or the shell is narrow or uses a coarse pointer,
it collapses to a summary button: semibold Atlas followed by quieter Colour
and Internal anatomy. It opens the same fields as a 320px popover; on desktop
the summary is as wide as its words and its popover drops from its left edge. As room
shrinks, internal anatomy and then colour yield; atlas remains and truncates
only when necessary. The accessible name names the action and retains every value. At the end:
fullscreen, Save image, and a ⋯ settings popover of labelled rows (Language,
Theme, Single-key shortcuts), then Keyboard shortcuts as a menu item; on
phones Full screen and Provenance join the menu. Settings hang under ⋯, their
edge continuing the ⋯ button's, are bounded by the available viewport height, and
scroll vertically when needed. Menu rows and commands share one pitch, a
control with 4px above and below (40px; 52px on coarse pointers), with 12px
insets on both sides. ⋯ is disabled, not hidden, until scripts run, so it keeps its place.
A “Skip to model” link is the first Tab stop, invisible until focused.

**Task panel (exploration and drill-in).** Exploration modes live directly above
the panel at every desktop width, on the panel inset and spread across the
column, and in the mirrored sheet tabs on phones.
Notices follow the tabs so task navigation stays in place. Desktop labels stay on one
line in a horizontally scrollable bar when enlarged text needs more room;
keyboard focus brings each label into view. Phone labels can wrap within their cell as reader text grows. Labels
use 14px medium type, reduced to 13px at 801–1000px and on the narrowest phones.
Functions and Deficits paint the brain while in front: named
regions in their colours, every other region in tissue colour, keyed on the stage.
The functions overview and a deficit's findings are categorical; one function
or searched term alone is drawn on a three-band blue z scale (z 3–5, 5–10,
≥ 10), darker for more consistent, keyed by band, so the stage keeps the order
of strength the profile lists. Painted areas stay opaque when the cortex is
see-through. A key row whose colour no drawn region carries is outlined, not
filled, and its note says so. A function profile leads with its data: headline, stage
line, evidence line and a one-line caveat, then the areas; how the numbers are
made follows them, above the source. A function frames the whole brain, a
deficit its regions, each after the key it brings is laid out, so the picture
clears the key. A region opened from a profile is framed with its neighbours,
and its detail is scrolled into view with focus on its name. On stages
narrower than 600px a paint key keeps its rows and drops its note. The selected tab uses semibold teal ink
and a 2px teal bottom rule on a transparent ground. A control-height search
field starts each searchable task under a visible 13px/600 secondary label (a
placeholder is no label; decision 37), with the browse scope below it. They share
a flat task-control area with 12px top and bottom padding and an 8px gap.
One fine rule separates these controls from the index. Each mode is a list; opening an item
drills into
its detail under one location bar (44px, navigation ground): “‹ mode” back,
or in a lesson the circuit name with a “n of N” stepper; a function or deficit
profile adds a “Restore previous view” text link at its end, with no category crumb. A selection strip
(44px) appears only when the panel is not already showing the selection.
Dissection docks at the explorer foot as one 44px line over its rule. Tracts docks its
single primary at the foot. Group rows end in L and R eye slots on the panel's
far edge (a section with midline parts also reserves Mid); a region row ends in
its one side's eye and letter on that edge, so its name keeps the rest of the width. Region details place tonal Focus,
Isolate, Hide, and accent-ink Linked MRI commands in one left-aligned row.
Atlas overlap and supporting maps use closed disclosures, preserving room for related findings.

**Stage (picture tools).** A dock at the bottom-left of the visible stage: a
dark plate holding the view, Section ▾, and Display ▾ tools, 4px apart with no
separators, each with an 8px label-to-chevron gap and 12px horizontal padding.
The dock has 4px internal padding and stands on the stage gutter. The view tool
names the held preset and returns to View after free rotation. Its chevron
follows the current name while the hidden localized names reserve the widest
label's width, so changing presets never shifts the other tools. Presets are inside its popover; its accessible name reports
the held preset. Cutting a plane adds the section bar above the
toolbar (position slider and mm field, Reverse side, Linked MRI, close); this
is the only Linked MRI entry on the stage. Popovers open from the dock's start
edge above the whole dock, section bar included, whichever tool opened them,
and read their gutter from the same stage token. Tool words, popover labels,
and the section bar's plane name start on one line: the dock's inset plus a
tool's padding (popovers pad 12px top and bottom, 16px at the sides).
Orientation letters sit at the visible edges, the scale bar bottom right,
centred on the tools' line (above the dock when they cannot share it), colour keys top right in
24px rows on fine pointers, each plate bounded at 280px on desktop with its
note unbounded inside. A key takes the right column or the top strip,
whichever leaves the larger square for the anatomy; on a phone a key starts
folded when it would take more than half the room above the dock. Framing fills about 80% of the visible stage on its tighter
axis, clear of the letters and scale bar; context framings never go below a
50 mm bounding radius. Letters are derived from camera position, target, and
up, so they always match the frame being drawn.

**Status bar.** One quiet line on the base ground, with a fine top rule: “Not clinical anatomy” in
500, a short hairline, the description (it truncates; the statement never
does), then “N visible regions” (tract bundles in Tracts) with tabular digits
and a quiet 24px Provenance text button, its words ending on the stage gutter, opening a dialog of labelled rows
built from the anatomy index and manifest.

**Phones and narrow windows** (≤800px, or landscape ≤480px tall). The canvas is full bleed under
the sheet with peek, half, and full detents; short landscape uses a side
sheet. The masthead (`max(52px, 3.25rem)`) shows the mark and the compact data
summary, as wide as its words with the chevron following them, growing with the reader's text size. The grip
centres the handle bar on its own 20px line at the top; the selection name, side,
and “Not clinical anatomy” statement sit below it on the 16px column, the
statement closing 8px above the tabs, the clear command beside
them; the status bar hides. The stage gutter becomes the panel inset (16px).
The stage plate hugs its three 44px worded tools (current view, Section ▾,
Display ▾) with no inset and 8px label-to-chevron gaps, and spans the stage
only while a plane is cut; presets live in the View popover, whose words start
a tool's 12px padding in.
The scale sits at the top left on the gutter, letters and scale at 13px on the
same gutter, the top orientation letter 4px below the scale's line in upright
and short landscape layouts. Orientation letters and scale bar
hide while a stage popover is open and at the full detent. Fine-pointer controls and rows (32px) become 44px on
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
Sheet tabs mirror the desktop tabs without a rule above, spread edge to edge
with the first label on the 16px column; peek pads for the home indicator. In short landscape, the selection occupies the first grip row and
the disclaimer the second. Tabs use their natural full-label width, with
nonshrinking, unwrapped labels and 12px inline padding; the measured tab row
sets the side sheet’s peek width, preventing fragmented labels.

Dialogs share sticky ruled headers as tall as the masthead (4px vertical
padding), the title then a quiet × icon button named Close whose glyph meets
the content edge, and insets (20px desktop, 16px phone);
Shortcuts and Provenance are bounded (560px), MRI viewers wide (1180px); all
go full-screen on phones.

## Elevation & Depth

The workspace is flat: tonal fills and fine rules, no card shadows. Selected segmented
thumbs use a 1px state ring without a contact shadow. Shadows are the
popover shadow (neutral
black, 0 6px 16px plus a 1px contact shadow) on the masthead popovers, skip
link, and dialogs. Stage popovers use one fine border. Tab
underlines are state rules, not elevation. Stage markings are type with an
opaque 3px rim and a stacked dark halo, not plates.

**The Flat Workspace Rule.** Use tonal surfaces and fine borders for the workspace. Reserve shadows for masthead popovers and dialogs.

## Shapes

Controls, plates, and chips (4px); popovers, dialogs, and the sheet's exposed
corners (6px); the desktop workspace panel and stage, rows, tabs, location
bar, and docks are square.
Functional small radii are part of the system: segmented thumbs, checkboxes,
keycaps, stage tools, and tract keys (3px, `--radius-small`); network
swatches, bars, MRI canvases, and the sheet's handle bar (2px, `--radius-mark`); slider tracks (1px); range thumbs and circuit step numbers (UI
face, tabular figures) are circles. Phone viewport and full-screen dialogs meet the screen edge.

Icons are monochrome inline SVG (16px, 1.5px round strokes). Every chevron
(disclosure, select caret, stage tool, data summary, back) is drawn from two
1.5px strokes, never a glyph. Decorative SVGs stay outside translated label
spans and hidden from assistive technology.

## Components

- **Buttons:** three ranks. The only filled primary is “MRI with tracts” in
  Tracts. Tonal for other commands, such as the region's Focus, Isolate, Hide,
  and Linked MRI (accent ink) and Retry; an active Isolate takes the teal wash
  and a 1px accent edge. Quiet text for recessive actions (Expand all, Undo,
  Restore all, Reset view); dialogs close with a quiet × icon button. Text-link
  actions (Restore previous view, the notice's action, return to landmark,
  mapped regions) are teal and underline on hover. Disabled: sunken ground, tertiary ink. Under
  increased contrast tonal buttons gain the control border. Commands answer a
  press with scale(0.97); rows, tabs, segments, tree items, and text links
  stay still. Hover styles apply only on hover-capable pointers.
- **Fields:** numbers and panel selects use the base surface with the
  control border; hover darkens it. Search uses the navigation ground at rest
  and the base surface on focus. Masthead selects use transparent ground
  and borders at rest, with a tonal hover and focus surface; the collapsed
  popover's fields are full-width, with the control border on the base ground
  at control height. Every select carries the
  stroked chevron, its ink ending as far inside the control as the value
  starts from the other edge (12px; 8px in the masthead). Number fields draw
  no spinners and set tabular figures; arrow keys still step. Ranges
  are hollow rings on a 2px track. Fields grow to 16px text on coarse pointers.
- **Segmented choices:** one vocabulary for every exclusive choice (atlas,
  colour, language, theme, single-key shortcuts, presets, cutting
  plane, hemisphere, MRI plane): quiet track, raised thumb with a 1px ring,
  primary 600 label without a contact shadow. The ring, not teal alone, marks the choice. Every group is
  one Tab stop with arrow, Home, and End movement (web/docs/decisions/0003-segmented-controls.md).
  The track is control height with a 2px inset, so a segment is 4px shorter.
  The explorer's browse scope is the same control in 13px with word-width
  segments, so Expand all fits beside it.
- **Mode tabs:** 14px medium-weight words with no cell dividers and a 44px
  minimum height. At desktop widths they sit above the task panel on the panel
  inset, spread across the column (space-between, 8px minimum gap), with
  intrinsic label widths and 4px horizontal padding. Desktop words stay
  unwrapped; the phone sheet keeps its mirrored, flexible tab row. Automatic
  height and 8px vertical padding accommodate reader text. Selected is teal
  600 on a transparent ground with a 2px teal bottom rule. Hover changes the
  ink only, with no hover surface; bold width is held so nothing shifts. Tabs are never
  disabled. Repeated navigation responds immediately, without a colour fade.
- **Anatomy tree:** a Whole brain | By system scope over the tree (By system
  opens the System picker beneath it and says the cortex is hidden). Whitespace
  and section captions separate the index
  sections, with thin neutral category rules after the first; a caption stands
  16px under its rule and 4px over its rows. Rows are row height (32px on fine
  pointers, 44px on coarse) and leave anatomical names readable. Open
  group captions use weight 600 and stay on the base surface without a filled band or bottom
  rule. They remain sticky, with indentation distinguishing their regions; a group name shared by two vocabularies is
  qualified (“Limbic lobe”, “Limbic system”). Selected rows take the teal
  wash; the keyboard target, like search's armed result, takes the accent
  ring (2px, inset). Group rows end in Mid, L, and R eye slots at control height,
  declared per section: only a section with midline parts reserves Mid (48px).
  A region row has one side, so its eye and letter take one far-edge column
  and long names keep the freed width. Eye then letter sit flush to the slot's end: side
  letters, group counts, the search field, and Expand all end on one right
  edge. The tree carries no column heads. With a mouse, a group shows its tabular
  count right-aligned in the eye area and trades it for its eyes on hover,
  keyboard focus, or a hidden or partial side, with nothing moving; a region
  keeps its side letter and shows its 14px eye on hover, focus, selection, or
  when hidden. Hidden and
  partial states keep their eyes explicit: hidden uses a struck eye, subdued
  ground, and struck hemisphere letter; partial uses the tonal ground. Touch
  keeps every eye visible and gives the count its own column. “Expand all” /
  “Collapse all” (“Tout déplier” / “Tout replier”) is a quiet 13px text
  command at control height; a section's display state (“Spinal cord hidden”) is a tertiary
  readout on its own line under the section name.
- **Mode lists:** Functions, Deficits, Circuits, and a lesson's sequence use
  the tree's row (row height, teal-wash selection). Function rows are one line:
  a 12px swatch slot, the name, and the study count under a “Studies”
  (“Études”) column head, the full detail kept in hidden text; deficit rows
  stay two lines, name over domain; circuit rows put the route (“Chiasm → optic
  tract → …”) under the name, 8px above and below, with a bare tabular landmark
  count on the name's line. Group captions mirror the tree's ruled, sticky sections. On fine
  pointers a row's figure sits on the data edge at rest and the drill chevron
  replaces it on hover or keyboard focus; a selected row keeps its figure.
  Rows without a figure show the chevron on hover, focus, or selection; touch
  always shows it. A function profile's areas give bare z values under a “z”
  column head.
- **Region detail:** the shared panel intro inset and 24px/600 headline with a quiet
  clear (×), followed 4px below by hemisphere and anatomical group as subordinate
  14px context. Their semantic labels remain accessible without repeating the
  values. Notes lead into one left-aligned command row with 16px separation
  and 8px gaps: tonal Focus, Isolate, Hide, and Linked MRI in accent ink,
  at control height, padded 4px 12px (8px in the 320px compact panel, which
  keeps all four on one line), their ground
  starting on the title column. The row wraps only when labels outgrow it; an active Isolate
  takes the teal wash and a 1px accent edge. Buttons grow with wrapping labels
  and retain visible focus outlines.
  Research facts follow after 16px: area or volume, centroid, and source
  label, with 13px labels and 14px tabular values aligned right in a ledger ruled only at
  its outer top and bottom edges. Flexible columns (1fr / 1.5fr), a 12px gap,
  and row-height rows keep long labels and values readable. Values
  use weight 500, the main area or volume uses 14px/600, and source text recedes
  to 13px. Long
  source values stack; long ID lists open as a native disclosure accessible
  with keyboard and touch. The atlas comparison
  follows, with Region / Area / Share caption headings, a flexible name
  column, 4.5rem area and 4rem share columns with unwrapped heads, aligned 13px/500 tabular figures,
  row-height rows, and rules only at the header and unassigned remainder. Detail sections are
  separated by 24px; functional-network rows are row height and use space rather than rules.
  Boundary certainty, Constituent regions, Functional division, Neuropsychological domains, and
  Functional networks are collapsed native disclosures in one ruled index,
  with fine bottom rules and weight-500 summaries 36px tall (a row and 8px of
  air; 44px on touch). Each retains its
  open state between selections; opening adds 16px bottom padding and leaves
  the source notes and caveats beside their map.
  On phones the grip carries a compact readout at peek and while browsing.
  An open detail keeps its clear command in a 44px grip, centred on the
  disclaimer line, hides the grip's name in both orientations, and shows the complete,
  wrapping name once in the body at 24px before its context.
  Neuropsychology and guided-circuit links follow. Related findings and
  circuits, like a function profile's areas, use primary-ink rows, with
  hover underlines indicating the linked names.
- **Deficit profile:** a ruled status strip first, saying what the stage now
  shows; the location bar's “Restore previous view” text link, when there is
  one, puts back the view from before the excursion and closes the profile it opened; then
  headline, definition, caveat, and collapsible association rows whose
  mapped regions stay in reach while closed.
- **Circuit lesson:** a lesson
  reads headline, the landmark's side | group (while it is the selection),
  role, description, the landmark's actions and
  datasheet, then the lesson's notes as a cohesive index of ruled disclosures at the foot. A
  selection that is not the landmark becomes a ruled 16px second subject.
- **Tracts:** rows sit under Association, Projection and Commissural tracts
  captions (13px/600 with the bundle count, ruled after the first; a class with
  no match hides), in catalog order within a class. One row per tract at row
  height, separated by fine rules; name then lettered L | R (or numbered
  segment, or “Whole” for the lone whole-callosum bundle) 24px-tall tonal keys
  at least 28px wide (3px radius); a segment's key and readout name its part
  (TractSeg CC_1–7, rostrum … splenium),
  edgeless at rest and changing state without a colour fade; drawn is a
  selection: teal wash, 1px teal edge, 600 letter. Names use weight 500;
  metrics sit under the name in 13px tabular type with stronger counts.
  Settings and provenance follow with a fine rule, their summaries at row
  height and weight 500. Scope notes in an “About this data”
  disclosure.
- **Notice:** one row at the task panel's top, square, on the tonal ground with
  primary ink at 14px, its text on the panel inset; in the phone sheet it sits in the grip, so it shows at
  every detent and beside any detail. It says in the reader's words what
  changed or failed (a dropped colouring, a download, link fields not
  applied), stays until the next action, and ends with a quiet × that
  dismisses it. It offers at most one action, a teal text link that underlines
  on hover, on its own line under the words: Reload when only a reload can help, or See through the cortex when
  an opened function's strongest region, or some of an opened deficit's
  mapped regions, are deep forebrain structures the cortex hides (never the
  cerebellum or brainstem, which a see-through cortex would not reveal). No colour of its own, not danger red; the page's announcer speaks it, so
  the row is not a live region.
- **Disclosure:** every disclosure shares one rhythm: a control-height summary
  (44px on coarse pointers), 14px/500 primary ink, a stroked chevron that
  turns on open, teal on hover.
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
  re-scopes the panel tokens to the stage overlay palette (plate, track,
  overlay border), so its components need no special cases.
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
  shortcuts can be turned off in settings (persisted per reader), hiding
  the search shortcut hint, and never
  fire from panel or menu buttons. The native tract MRI viewer owns its
  letter keys while open, so atlas shortcuts cannot change the background.
  Focus lands somewhere visible after a
  clear, Escape, or a dialog closing.

Focus is a visible accent ring (2px, offset 2px), drawn inside for clipped
rows, tabs, and the canvas; the stage uses the overlay teal. Preserve
forced-colour and increased-contrast treatments. UI colour feedback (140ms)
and press (160ms) with the shared ease-out; masthead popovers grow from their
trigger, stage popovers from the dock's bottom-left corner,
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

- Do use the shared palette, spacing, typography, and radius tokens in web/src/styles/tokens.css.
- Do keep data choices in the masthead, exploration modes and drill-in in the panel, and picture tools on the stage; phones mirror the modes in the sheet.
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
text cannot enlarge the document. The Functions and Deficits location bar is
“‹ Mode” and a “Restore previous view” text link, without a category crumb.
