# 0006 Phone sheet semantics

Status: decided under the delegation on #4 (standards-based). Chunk H6.

- The sheet is a **non-modal** region: it never traps focus, never sets `aria-modal`, and the stage behind stays operable. It is not a `role=dialog`.
- The grip handle is a **button** with `aria-controls="sheet"`, named for what a press does ("Expand panel" / "Collapse panel", as `sheet.js` nameHandle), cycling the detents peek, half, full. Dragging is the pointer shortcut; the button is the WCAG 2.5.7 single-pointer alternative and is keyboard operable.
- A peeked sheet's panels are `inert` (legacy hides them at peek); a control already focused keeps its panel exposed by raising the sheet to half (`sheet.js:setup`).
- Reduced motion: detent changes cross-fade (`data-instant`, `prefers-reduced-motion`), as `viewer/styles/a11y.css`.
