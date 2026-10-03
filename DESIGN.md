# NeuroAtlas UI

The anatomy is the visual focus. Surround it with a calm scientific workspace:
quiet surfaces, readable controls, consistent spacing, and a single teal UI
accent. Preserve the product's existing English and French copy.

## Layout

- Desktop: a 280px explorer, flexible anatomical viewport, and 336px inspector.
- Tablet: the viewport sits above two independently scrolling panels.
- Phone: a full-width viewport with the existing draggable bottom sheet.
- Atlas and appearance are segmented settings. Panel navigation uses flat tabs
  with a bottom rule. Lists use spacing and surface changes rather than tiles.

## Typography and spacing

Source Sans 3 Variable is self-hosted through Fontsource. Body text is 15px,
controls and anatomical lists 14px, supporting labels 12px, and panel titles
16–18px. Use the existing monospace face only for measurements and source data.
Allow long anatomical names to wrap; truncate only the compact selection strip.

Use the shared 4px spacing scale in `viewer/styles/tokens.css`. Controls and rows
are 40px on desktop and 44px on phones. Control corners are 6px; viewport and
sheet corners are 10px. Avoid decorative icon backgrounds and count badges.

## Color and state

All UI colors come from `viewer/styles/tokens.css`. The light theme uses cool
off-white surfaces, blue-tinted ink, and teal `#087477`. Dark mode uses the same
hierarchy with deep blue surfaces and pale teal. Keep text at least 4.5:1 against
its surface and control outlines at least 3:1. Selected list rows use the accent
wash and stronger type; the keyboard search target has a separate outline.

Imaging colors, tissue shading, atlas/network palettes, orientation markers,
scale bars, and the dark scene background belong to the scientific renderer.
UI refinement must preserve them independently of the panel theme.

## Interaction

Use visible keyboard focus and the existing ARIA semantics. Maintain hover,
selected, disabled, empty, loading, and error states in both themes. Keep the
existing 140ms color feedback and 240ms camera movement; respect reduced motion.
SVG controls share a consistent stroke. Do not add decorative transitions,
claims, synthetic anatomical illustrations, or redundant controls.

Expanded anatomy headings stay visible only within their own group as the list
scrolls. Hemisphere labels remain explicit alongside each anatomical name.
Cutting planes share one row beneath the full-brain option; controls retain
their minimum target size and can grow when localized labels wrap.

## Impeccable

The project skill is `.agents/skills/impeccable/SKILL.md`. Use its `polish`,
`audit`, `typeset`, and `adapt` guidance for future UI changes. Browser inspection
and the existing tests remain required evidence; detector findings need review
in the context of a dense scientific tool.
