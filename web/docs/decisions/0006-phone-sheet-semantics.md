# 0006 Phone sheet semantics

Status: decided under the delegation on #4 (standards-based); the full record is on #45. Chunk H6.

- The sheet is a **non-modal** region: it never traps focus, never sets `aria-modal`, and the stage behind stays operable. It is not a `role=dialog`. It is the Material 3 "standard" bottom sheet and the Apple HIG sheet with an undimmed largest detent; the APG has no bottom-sheet pattern, and the Window Splitter models a continuous ratio, not three rests.
- The grip handle is a **button** with `aria-controls="workspace-panel"`, named for what a press does ("Expand panel" / "Collapse panel", as `sheet.js` nameHandle), cycling the detents peek, half, full, peek. It has no `aria-expanded`. Dragging is the pointer shortcut; the button is the WCAG 2.5.7 single-pointer alternative and is keyboard operable (Enter, Space). Arrow keys do nothing on it, and Escape is the global cascade's, not the sheet's.
- A peeked sheet's panels are `visibility: hidden` with `pointer-events: none` (legacy), which already removes them from the tab order and the accessibility tree, so `inert` is not needed. A control already focused in a panel keeps its panel exposed by raising the sheet to half on entering the shell (`sheet.js:setup`), and focus moves to the handle when the sheet settles on peek (deviations/h6-peek-focus.md).
- Detent changes the reader makes directly are announced (decision 20, deviations/h6-detent-announcements.md); resizes, the automatic lift and raises that come with another action are silent.
- Reduced motion: the sheet jumps to its rest and keeps only an opacity transition (`viewer/styles/a11y.css:8-14`); `data-instant` (keyboard activation, shell entry with panel focus) removes the glide of the sheet and of the stage chrome that follows it.
