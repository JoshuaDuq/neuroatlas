# Popover: focus moves into the popup on open

Chunk: U5 (H2, H3, G2, G4 consume it)
Status: decided under the delegation on #4 (decision 14, standards-based)

## Legacy behaviour

The stage popovers move focus to the pressed control (stage-tools.js:66-69). The settings menu (header.js `setOpen`) and the data summary leave focus on the trigger, so a keyboard user must Tab into them. Stage popovers fade out over 120 ms.

## New behaviour

Every popover moves focus on open to the pressed control (`aria-pressed` or `aria-checked` true), else the first control, as the stage popovers do. A keyboard open and close carry no animation. The stage popovers' exit fade is dropped: Bits unmounts the content when its open state ends. The entry fade is kept.

## Standard cited

WAI-ARIA APG Dialog (Non-Modal): focus moves into the popup when it opens; Disclosure pattern for the trigger (`aria-expanded`, `aria-controls`); WCAG 2.2 SC 2.4.3 Focus Order and 2.4.11 Focus Not Obscured.
