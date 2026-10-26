# A row that cannot draw an outline stays focusable and says why

Chunk: R2
Status: fix (decision 39, B3); listed in the R2 PR

## Legacy behaviour

While a cut is drawn or the tract reference is shown, each row is natively `disabled` (`atlas-comparison.js:101`). A disabled button leaves the Tab order, so a keyboard user never learns why; a focused row that becomes disabled loses focus to the page; the explanation is a separate paragraph that nothing associates with the rows.

## New behaviour

The row keeps `type=button` and takes `aria-disabled="true"`: it stays a Tab stop, its click does nothing, and `aria-describedby` points at the view note ("Turn off sections to outline overlaps…"). Focus on a row survives the change.

## Standard cited

WAI-ARIA APG, Keyboard Interface, "Focusability of disabled controls"; WCAG 2.2 SC 2.4.3 Focus Order and 3.3.2 Labels or Instructions.
