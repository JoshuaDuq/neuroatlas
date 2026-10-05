# Clinical controls verification

The second refinement pass preserves the approved clinical direction and all
172 unique HTML identifiers. No JavaScript, anatomical geometry, scientific
palette, measurements, translations, or provenance changed.

- Existing test suite: 438 passed, 0 failed.
- Production build: passed; existing BVH chunk-size warning remains.
- Source whitespace check: passed.
- Checked English and French, light and dark, keyboard navigation, selected and
  empty search results, source disclosure, full and oblique cuts, display
  controls, and dialogs.
- The inspector selection strip remains 28px tall when empty and populated.
- Phone shortcut and MRI dialog headers remain at the screen top after
  scrolling, without exposing content above the header.
- Shared colors are unchanged; the recorded contrast check remains applicable.

Current evidence: `controls-desktop-*.png` at 1440 × 900,
`controls-phone-*.png` at 390 × 844, and `controls-tablet.png` at 820 × 1129.
The tablet viewport was tested at 820 × 1180; the browser screenshot reports
the visible capture height of 1129px. First-pass captures remain historical.

The initial dark disabled screenshot was replaced after review identified a
theme transition in the frame. The settled capture's selected display tab
computes to `rgb(35, 62, 67)`, matching the dark accent wash `#233e43`; panel
surface resolves to `#1d2a33`.

Temporary viewport overrides were reset. The light preview remains open.

Final review: `disposition: ship`, with no material fixes. DESIGN.md and its
schema-v2 sidecar were refreshed; syntax, 36 source colors, ten scoped
component examples, and all provided token references validate.
