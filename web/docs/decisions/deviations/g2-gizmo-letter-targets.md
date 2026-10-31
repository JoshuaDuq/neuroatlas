# Orientation gizmo letters are 24 px targets on every pointer

Chunk: G2
Status: fix (standard cited); decided 2026-10-31 with the gizmo

## Legacy behaviour

The seven view presets were worded buttons in the View popover: 32 px, and 44 px on a coarse pointer or under the phone query.

## New behaviour

The presets are the orientation gizmo's centre and six lettered circles, drawn 18 px in 24 × 24 px targets on every pointer, inside a span of 60 px (56 px on a phone). A 44 px target would not fit six of them: each letter moves with the camera, and toward an axis-aligned view a direction and its opposite meet at the centre, so two targets can overlap and the one toward the viewer is on top. The chevrons and Reset view sit outside the axes and do take 44 px on a coarse pointer, their targets growing outward so the drawn gizmo does not move. Every view stays one keyboard action away in the gizmo's toolbar and through the view keys, and a hidden letter is reached in two presses by way of a side letter or a chevron.

## Standard cited

WCAG 2.2 SC 2.5.8 Target Size (Minimum, AA): 24 × 24 px is met. SC 2.5.5 Target Size (Enhanced, AAA) and the project's 44 px coarse-pointer rule are not met for the letters and the centre.
