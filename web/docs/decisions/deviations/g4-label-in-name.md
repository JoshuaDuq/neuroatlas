# Section row controls are named by the words they show

Chunk: G4
Status: fix (standard cited)

## Legacy behaviour

- Reverse side: visible text "Reverse side", accessible name "Reverse retained side" (`aria-label`, ui/chrome/sections.js:463-465). The visible words are not the start of the name.
- Azimuth: visible text "Azimuth" (FR "Azimut"), name "Rotation around superior axis" (FR "Rotation autour de l'axe supérieur", sections.js:460-462). The visible word is not in the name at all.
- Tilt: visible "Tilt", name "Tilt from axial" (it passes, but is carried in `aria-label` and `title` like the others).
- The cutting-plane buttons carried an `aria-label` and a `title` with the same words as their text (sections.js:425-426): a tooltip that only repeats the name.

## New behaviour

Each is named by its visible label: "Reverse side" / "Inverser le côté", "Tilt" / "Inclinaison", "Azimuth" / "Azimut". The longer sense ("Reverse retained side", "Tilt from axial", "Rotation around superior axis") stays as the control's tooltip (`data-tooltip`, U5), which is its accessible description while shown. The plane buttons have no `title`; on a phone, where only the short name ("Sag") is drawn, the full name is the accessible name through U3's abbreviation slot.

## Standard cited

WCAG 2.2 SC 2.5.3 Label in Name (the accessible name contains, and best starts with, the visible text); SC 1.4.13 Content on Hover or Focus for the tooltip (U5).
