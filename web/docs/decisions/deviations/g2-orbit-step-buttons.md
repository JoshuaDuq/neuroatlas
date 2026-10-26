# Orbit step buttons in the View popover

Chunk: G2
Status: approved by the user on #4 (2026-10-25); strings and placement decided under conductor decision 22

## Legacy behaviour

The camera orbits by pointer drag or by arrows on the canvas (render/keyboard-orbit.js); there is no single-pointer control.

## New behaviour

Four icon buttons (turn left, right, up, down) in a labelled group "Turn the model" (French "Faire pivoter le modèle"), between the presets and Reset view in the View popover. One activation calls `camera.orbitBy` with one `ORBIT_STEP` (5 degrees) in the sense of the matching arrow key (ArrowLeft is azimuth +step, ArrowRight -step, ArrowUp polar +step, ArrowDown -step), through the engine's keyboard-orbit path: the same poles and the same stay-outside-the-anatomy clamp, and the held view preset is released. The popover stays open and focus stays on the button, so a reader can press again; the navigation hint is retired. The buttons do not toggle and nothing is announced (decision 10b). Names: "Turn left / right / up / down", French "Tourner à gauche / à droite / vers le haut / vers le bas". They are 32 px, and 44 px on a coarse pointer. The strings are `viewport.orbitGroup` and `viewport.orbitLeft`/`orbitRight`/`orbitUp`/`orbitDown` in i18n.

## Standard cited

WCAG 2.2 SC 2.5.7 Dragging Movements.
