---
name: NeuroAtlas
description: A light clinical workspace around source-faithful brain anatomy.
colors:
  text-primary: "#24343b"
  text-secondary: "#50616a"
  text-tertiary: "#61717a"
  accent: "#156b6d"
  accent-hover: "#0d5557"
  accent-wash: "#eaf4f2"
  danger: "#a61b1b"
  surface-base: "#ffffff"
  surface-navigation: "#f8fafb"
  surface-sunken: "#f0f4f5"
  surface-canvas: "#e3eaed"
  surface-hover: "#f0f5f5"
  border-subtle: "#e0e7ea"
  border-control: "#80919b"
  dark-text-primary: "#edf3f7"
  dark-text-secondary: "#b9c7d2"
  dark-text-tertiary: "#9eafbd"
  dark-accent: "#82d3d0"
  dark-accent-hover: "#a5e3e0"
  dark-accent-wash: "#233e43"
  dark-danger: "#f1928f"
  dark-surface-base: "#1d2a33"
  dark-surface-navigation: "#1a262f"
  dark-surface-sunken: "#15222b"
  dark-surface-canvas: "#111c24"
  dark-surface-hover: "#26373f"
  dark-border-subtle: "#34434d"
  dark-border-control: "#6b808d"
  scene-background: "#0e1116"
  overlay-ink: "#f2f6fa"
  overlay-ink-muted: "#aab4c0"
  overlay-halo: "rgb(6 9 13 / 0.85)"
  overlay-danger: "#f1928f"
  overlay-plate: "#181f28"
  overlay-plate-hover: "#25313e"
  overlay-border: "#3f4c5b"
  overlay-accent: "#7dc9e6"
  overlay-accent-wash: "#263c4b"
typography:
  brand:
    fontFamily: '"Source Sans 3 Variable", sans-serif'
    fontSize: 1.25rem
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: -0.025em
  headline:
    fontFamily: '"Source Sans 3 Variable", sans-serif'
    fontSize: 1.375rem
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: -0.025em
  title:
    fontFamily: '"Source Sans 3 Variable", sans-serif'
    fontSize: 1.125rem
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: -0.02em
  dialog-title:
    fontFamily: '"Source Sans 3 Variable", sans-serif'
    fontSize: 1.125rem
    fontWeight: 600
    lineHeight: 1.45
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
    lineHeight: 1.45
  caption:
    fontFamily: '"Source Sans 3 Variable", sans-serif'
    fontSize: 0.75rem
    fontWeight: 400
    lineHeight: 1.5
  measurement:
    fontFamily: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace
    fontSize: 0.875rem
    lineHeight: 1.45
  input:
    fontFamily: '"Source Sans 3 Variable", sans-serif'
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.45
rounded:
  flat: 0px
  control: 6px
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
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface-base}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: 0 16px
    height: 40px
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.surface-base}"
    textColor: "{colors.text-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: 0 12px
    height: 40px
  button-quiet:
    backgroundColor: transparent
    textColor: "{colors.text-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: 0 12px
    height: 40px
  search-field:
    backgroundColor: "{colors.surface-navigation}"
    textColor: "{colors.text-primary}"
    typography: "{typography.input}"
    rounded: "{rounded.control}"
    padding: 0 44px 0 36px
    height: 40px
    width: 100%
  workspace-tab-selected:
    backgroundColor: transparent
    textColor: "{colors.accent}"
    rounded: "{rounded.flat}"
    padding: 8px 0
    height: 64px
  sheet-tab-selected:
    backgroundColor: transparent
    textColor: "{colors.accent}"
    rounded: "{rounded.flat}"
    padding: 0 4px
    height: 44px
  setting-selected:
    backgroundColor: "{colors.surface-base}"
    textColor: "{colors.accent}"
    rounded: 4px
    padding: 0 12px
    height: 32px
  anatomical-row-selected:
    backgroundColor: "{colors.accent-wash}"
    textColor: "{colors.accent}"
    rounded: "{rounded.control}"
    padding: 7px 8px
  panel:
    backgroundColor: "{colors.surface-base}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.flat}"
  cut-plane:
    backgroundColor: transparent
    textColor: "{colors.text-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: 8px 12px
  cut-plane-selected:
    backgroundColor: "{colors.accent-wash}"
    textColor: "{colors.accent}"
  viewport-chip:
    backgroundColor: "{colors.overlay-plate}"
    textColor: "{colors.overlay-ink}"
    rounded: "{rounded.control}"
    padding: 4px 8px
---
# Design System: NeuroAtlas

## Overview

**Creative North Star: "The Light Clinical Workspace"**

The light clinical workspace keeps the real reconstructed anatomy at the center of a calm, professional scientific tool. A single white task panel, cool slate ground, dark readable ink, and restrained teal selection make exploration and inspection one clear workflow. Keep the NeuroAtlas name, existing brain mark, and English and French copy.

This is a visual direction, not a clinical claim. Preserve the existing “not clinical anatomy” statement, scientific geometry, measurements, source labels, provenance, and published data colors. The panel theme and anatomical renderer retain independent palettes.

**Key Characteristics:**

- Anatomy leads; controls support it.
- One ruled task panel with small corners reserved for controls.
- Flat navigation and clear selected, focused, and disabled states.

## Colors

The frontmatter records exact shared values for the light workspace, its dark
variant, and theme-independent viewport chrome.

### Primary

Restrained teal marks selected anatomy, active tabs, links, and the MRI action.
Its darker hover value supplies action feedback; its pale wash carries selected
rows without turning navigation into a wall of filled controls.

### Neutral

Primary, secondary, and tertiary slate inks establish readable hierarchy. White
base panels sit on cool canvas ground; navigation, sunken, and hover surfaces
separate controls with small tonal shifts. Subtle borders divide content;
stronger control borders identify editable and clickable fields. Danger is
reserved for errors. The dark theme preserves these roles with deep blue slate
surfaces and pale teal.

Viewport plates, ink, and focus use their own overlay palette against the dark
scene, regardless of panel theme.

**The Independent Palettes Rule.** UI teal communicates interaction. Tissue shading, atlas and network colors, outlines, orientation, and scale markings retain their scientific meaning in both themes.

## Typography

Source Sans 3 Variable is self-hosted through Fontsource. The same sans face
handles identity, titles, controls, and prose; the existing monospace stack is
reserved for measurements and source data, with tabular numerals where needed.
There is no decorative display face.

The hierarchy is compact: brand (20px; 18px on phones), selected anatomy and
current circuit landmark headlines (22px), panel, circuit, dialog, and empty-state
titles (18px), body (15px),
controls and lists (14px), and supporting text (12px). These restrained sizes belong
to a dense reference tool, rather than a marketing display scale.
Clinical prose uses a more open line height (1.55); anatomical row names use
(1.4). Selected labels strengthen to (600) without changing size.

**The Complete Name Rule.** Allow anatomical names and localized control labels to wrap. Keep hemisphere labels explicit; truncate only compact selection readouts and constrained navigation labels.

## Layout

The user approved replacing the previous multiple-panel organization because
controls were scattered. The clinical palette remains; the workspace now has
one task panel beside a stable anatomical view.

Desktop uses a full-height two-column grid: task panel (320px) and the remaining
width for the anatomical viewport. A single identity row (64px) spans both
columns; the footer is (32px). The workspace has no outer padding and uses a
column separator (1px). Panel body padding is (16px 20px 20px). Use the shared
4px spacing rhythm. Header content uses horizontal padding (20px).

At widths (641–1000px), the task panel narrows to (300px) while the anatomy stays
beside it. The header always keeps language, theme, shortcuts, and region count
inside its settings popover. Specimen, atlas, internal anatomy, appearance,
hemisphere, and visibility controls share the View destination.

At (640px) and below, or landscape heights (480px) and below, the canvas becomes
full bleed and the existing sheet carries the panels. Preserve peek, half, and
full detents; short landscape places the sheet at the side. The same four
destinations occupy the sheet; in short landscape, peek and half use two rows
of tabs, and full uses one row. The header keeps its minimum height (64px),
hides its source readout and subtitle, and keeps the settings popover.
Appearance choices stay in View as a two-column grid. Keep safe-area insets and
the visible viewport rectangle shared by renderer and chrome.

Standard controls and rows use (40px); phone and coarse-pointer tokens use
(44px). Desktop workspace tabs stack SVG icons over labels (64px); phone tabs
use text at the standard height (44px). Appearance choices use (40px desktop,
44px phone); viewport presets and MRI export actions retain their compact
(30px) variant. Rows and localized actions can grow vertically. Scroll
long lists within the panels and long preset names horizontally on phones.

Settings and cut fields keep labels close to their controls (8px) and separate
successive groups (20px). Display and cut panels begin with compact top padding
(12px). A selected region outside the Region destination appears in a full-width
selection strip (44px) below the desktop tabs. The strip opens Region and hides
when Region is active or no selection label exists.

Dialogs share full-width sticky headers and body insets (20px desktop, 16px
phone). On phones, the header includes the top safe area and remains opaque as
content scrolls. Shortcuts use a bounded sheet (600px maximum); MRI uses the
existing wider sheet. Both become full-screen under the phone query.

## Elevation & Depth

The main workspace is flat. White panels, tonal layers, and fine rules supply
depth rather than card shadows. Selected segmented settings use
(0 1px 3px rgb(19 48 60 / 0.12)); the settings popover uses
(0 8px 24px rgb(10 25 40 / 0.14)). Tab underlines are inset state rules, not
surface elevation. Viewport text uses a dark halo for readability over anatomy.

**The Flat Workspace Rule.** Use tonal surfaces and fine borders for the main workspace. Reserve the existing small shadows for selected segmented settings and the settings popover.

## Shapes

Controls and selected rows have restrained corners (6px). The task panel,
viewport, tabs, and group headings are square; dialogs, the settings popover,
and exposed sheet corners use (8px). Nested segmented buttons use (4px).
Slider tracks and sheet grips use tiny corners (2px); checkboxes use (3px).
These small geometries are functional details rather than a competing panel
radius scale. Keycaps retain the control corner token. The phone viewport and
full-screen dialogs meet the screen edge without rounded insets.

Control icons are monochrome inline SVG (17px, 1.5px rounded strokes); cutting
icons grow to (22px). Decorative SVGs remain separate from translated label
spans and hidden from assistive technology.

## Components

- **Buttons:** one filled teal MRI action, outlined secondary actions, and quiet
  text actions. Primary hover deepens teal; secondary and quiet hover use the
  sunken surface. Disabled controls remain legible and do not react to hover.
  Dialog Close actions retain a visible control border and the standard height
  (40px desktop, 44px phone or coarse pointer).
- **Search and fields:** search uses cool navigation ground; editable selects and
  numbers use the base surface with a strong control border and rounded corners.
  Hover strengthens the search or select border; search focus returns to white
  and uses the common ring. Search and numeric fields grow to (16px) text on
  coarse pointers. Disabled numbers and selects use sunken ground and subtle
  borders. Disabled ranges keep full opacity, with a subtle track and a neutral
  control-colored thumb. Cortex opacity sits beneath its checkbox label, inset
  (24px desktop, 28px coarse pointer), and its label goes quiet when disabled.
- **Navigation:** one primary row contains Explore, Region, Sections, and View.
  Desktop tabs pair monochrome SVGs with labels; sheet tabs use labels alone.
  Flat tabs use teal type, a transparent selected background, and an inset
  bottom rule (2px) when selected. Hover uses the quiet hover surface. Explore
  contains the Anatomy, Deficits, and Circuits choices. On desktop, a new
  anatomical selection in Explore opens Region; selections made in Sections
  or View preserve that task. Region is disabled until context exists and
  returns to Explore when its last context is cleared. The phone Region tab
  remains available with its existing empty hint and selection behavior.
  Use the established tab roles, panel associations, roving focus, arrow keys,
  Home, and End as in the [WAI-ARIA Tabs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/).
  Atlas and appearance use sunken segmented containers with a white selected
  setting; appearance offers four choices in a two-column grid. Preserve their
  distinct ARIA state semantics.
- **Anatomical rows:** a teal wash and stronger label echo the region outlined
  in the viewer. The keyboard search target has a separate control-colored
  outline. Expanded group headings stay sticky only within their own group;
  hemisphere labels remain explicit beside each name.
- **Containers and details:** one white task panel switches its scrolling content
  between exploration, contextual region details, sections, and view settings.
  A populated circuit profile uses its actual circuit name as the panel heading
  (18px, h2), the current landmark as its headline (22px, h3), and landmark
  progress immediately below. The empty circuit introduction keeps its own title.
  Inspection measurements use ruled definition lists; source disclosure labels
  use control text (14px, weight 500), with teal hover and open states. Evidence
  remains subordinate to the selected anatomy. Empty list copy uses open line
  spacing (1.55) and padding (20px); recovery actions sit on their own line with
  a gap (8px). Centered inspection hints stay compact (28ch) beneath their title.
  Dissection stays docked at the explorer foot. Cutting planes use two equal
  columns with a minimum height (52px); full-brain spans both columns. Selected
  planes use teal ink, wash, and border. The MRI command stays below the
  independently scrolling cut fields.
- **Dialogs:** the shared sticky header keeps its title and outlined Close action
  visible above a fine rule. Shortcut rows pair mono keycaps with readable action
  labels and subtle bottom rules; their two columns become stacked rows on phones.
  MRI readouts use navigation ground, padding (12px), and mono control text with
  open line spacing (1.55). Each MRI plane keeps its quiet export action aligned
  to the right of its heading at the compact height (30px).
- **Viewport chips:** dark overlay plates and pale overlay ink stay readable
  against the scene and retain the overlay palette in both panel themes.

Keyboard focus is a visible accent ring (2px) with an offset (2px), adjusted
inward for clipped rows and canvas. Viewport focus uses the overlay accent.
Preserve forced-color and increased-contrast treatments. UI color feedback uses
(140ms) and the shared easing curve; camera and settled sheet movement use
(240ms). Dragging tracks directly. Existing dialog entry uses (180ms). Respect
reduced motion. The existing progress-width transition follows loading, while
settled phone-sheet height and width transitions synchronize the renderer and
viewport chrome; retain this operational motion.

The workbench detector's static HTML black-text and all-16px readings miss the
Vite-imported stylesheets. Its small-radius and type-size advisories describe
the functional geometry and deliberate hierarchy above. Dark overlay tokens
belong to the scientific scene, not to white panel backgrounds. Inspect the
rendered evidence and source before treating these reports as visual defects.

## Do's and Don'ts

### Do:

- Do use the shared palette, spacing, typography, and radius tokens in viewer/styles/tokens.css.
- Do preserve visible focus, existing ARIA semantics, keyboard operation, and English and French at every breakpoint.
- Do keep task navigation in one panel and display controls together in View.
- Do maintain readable hover, selected, disabled, empty, loading, and error states in both themes; keep text contrast at least 4.5:1 and control outlines at least 3:1.
- Do verify UI changes in the browser and with the existing tests; review detector findings in the context of a dense scientific tool.

### Don't:

- Don’t recolor scientific data to match the UI accent or replace real anatomy with synthetic illustrations.
- Don’t hide the “not clinical anatomy” statement in settings or add unsupported claims.
- Don’t add decorative icon backgrounds, count badges, redundant controls, or ornamental motion.
