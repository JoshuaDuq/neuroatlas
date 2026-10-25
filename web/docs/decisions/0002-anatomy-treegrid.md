# 0002 Anatomy tree as an APG treegrid

Status: accepted (user, #4). Chunks U7, A1.

- Pattern: WAI-ARIA APG Treegrid. `role=treegrid` with an accessible name; rows `role=row` with `aria-level`, `aria-posinset`, `aria-setsize`, `aria-expanded` on parents, `aria-selected` on the chosen region; cells `role=gridcell`. The name/select control and the visibility (eye) button are separate cells, so each button sits in its own cell.
- Keyboard, with focus on a **row**:
  - Down / Up: next / previous visible row. Home / End: first / last row.
  - Right: on a collapsed parent, expand it; otherwise (an expanded parent, or a leaf) move focus to the row's first cell. A leaf row's Right therefore reaches its eye control, as legacy `navigator.js:18` does.
  - Left: on an expanded parent, collapse it; otherwise move focus to the parent row.
  - Enter / Space: select the region. `V` toggles the row's visibility (legacy, kept).
- Keyboard, with focus in a **cell**: Right / Left move to the next / previous cell in the row; Left from the first cell returns to the row; Up / Down move to the same cell in the adjacent row; Enter / Space press the cell's button; Escape returns to the row (legacy meaning, kept); `V` as above.
- Focus: roving tabindex, one tab stop (the focused row or cell). Rows under a closed ancestor are not in the order. Selection follows activation, not focus.
- Hand-rolled (Bits has no treegrid). Must be screen-reader tested (NVDA, VoiceOver) before A1 merges.
- Deviation: `deviations/u7-treegrid.md`.
