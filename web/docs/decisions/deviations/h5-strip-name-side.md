# Desktop selection strip names the hemisphere

Chunk: H5
Status: decided on #4 (decision 19)

## Legacy behaviour

workspace.js:185 names the desktop strip `Inspect <label>`, although its visible text includes the side glyph. The phone strip (sheet.js:319) names it `Inspect <label>, <side word>`.

## New behaviour

Both strips use the side word: `Inspect <label>, <side word>` / `Examiner <label>, <côté>`. No new string.

## Standard cited

WCAG 2.2 SC 3.2.4 Consistent Identification (one control, one name in both shells) and 1.3.1 Info and Relationships (the side shown as a glyph is also in the name).
