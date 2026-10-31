# Orbit step buttons on the orientation gizmo

Chunk: G2
Status: approved by the user on #4 (2026-10-25); strings decided under conductor decision 22; moved from the View popover to the gizmo's ring on 2026-10-31

## Legacy behaviour

The camera orbits by pointer drag or by arrows on the canvas (render/keyboard-orbit.js); there is no single-pointer control.

## New behaviour

Four chevrons (turn left, right, up, down) in a labelled group "Turn the model" (French "Faire pivoter le modèle") on the orientation gizmo's ring, one on each side of the axes, always shown. One activation calls `camera.orbitBy` with one `ORBIT_STEP` (5 degrees) in the sense of the matching arrow key (ArrowLeft is azimuth +step, ArrowRight -step, ArrowUp polar +step, ArrowDown -step), through the engine's keyboard-orbit path: the same poles and the same stay-outside-the-anatomy clamp, and the held view is released. Focus stays on the chevron, so a reader can press again; the navigation hint is retired. The chevrons do not toggle and nothing is announced (decision 10b). They are quiet: muted overlay ink with the markings' halo, the full ink on hover and focus. Names and tooltips: "Turn left / right / up / down", French "Tourner à gauche / à droite / vers le haut / vers le bas". Each is a 24 px target, and 44 px on a coarse pointer, the target growing outward from the axes so the glyph stays put. The strings are `viewport.orbitGroup` and `viewport.orbitLeft`/`orbitRight`/`orbitUp`/`orbitDown` in i18n.

## Standard cited

WCAG 2.2 SC 2.5.7 Dragging Movements.
