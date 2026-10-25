# 0002 Anatomy tree as an APG treegrid

Status: accepted (user, #4). Chunks U7, A1.

- Pattern: WAI-ARIA APG Treegrid. `role=treegrid` with an accessible name; rows `role=row` with `aria-level`, `aria-posinset`, `aria-setsize`, `aria-expanded` on parents, `aria-selected` on the chosen region; cells `role=gridcell`. The name/select control and the visibility (eye) button are separate cells, so each button sits in its own cell.
- Keyboard: Up/Down move between rows; Right opens a closed parent, else moves to the first child; Left closes an open parent, else moves to the parent; Home/End first/last row; Right/Left inside a row move between its cells once cell navigation is active; Enter/Space activate; Escape returns from a cell to its row (legacy meaning kept); `V` toggles visibility (kept).
- Focus: roving tabindex, one tab stop; rows under a closed ancestor are not in the order. Selection follows activation, not focus.
- Hand-rolled (Bits has no treegrid). Must be screen-reader tested (NVDA, VoiceOver) before A1 merges.
- Deviation: `deviations/u7-treegrid.md`.
