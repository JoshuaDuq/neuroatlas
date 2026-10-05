# Clinical Controls Refinement Plan

**Goal:** Continue the approved light clinical design with clearer field groups,
states, details, and dialog controls.

**Architecture:** Preserve identifiers, translations, events, scientific data,
and the responsive sheet. Group existing controls in semantic HTML and refine
their existing component and layout styles. Keep the selection readout's height
reserved so selecting anatomy cannot move a control under the pointer.

**Tech Stack:** HTML, CSS, existing JavaScript UI modules, Vite.

- [x] Group display and cutting fields; align cortex opacity with its label.
- [x] Compact the reserved inspector readout and improve disabled field states.
- [x] Add a shared sticky dialog header with a visible close control; improve
  shortcut rows, MRI export controls, and coordinate readout.
- [x] Refine source disclosure and empty search readability.
- [x] Verify desktop, tablet, phone, both languages and themes, keyboard focus,
  cut controls, and dialog scrolling in one visual batch; fix findings together.
- [x] Run the existing tests, production build, source whitespace check, and
  final Impeccable review; refresh affected design documentation.

The existing W3C ARIA APG disclosure and modal-dialog patterns were reviewed.
Native details/dialog behavior and the application's focus handling remain.

Completed: 438 tests passed, production build passed, and source whitespace
check passed. The fresh finish review returned `disposition: ship` after all
14 current captures were confirmed valid. DESIGN.md and its schema-v2 sidecar
were refreshed and validated: 36 source colors, ten scoped examples, and
resolved token references.
