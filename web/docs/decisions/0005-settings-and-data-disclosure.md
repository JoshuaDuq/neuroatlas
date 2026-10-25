# 0005 Settings and data summary are disclosures, not menus

Status: decided under the delegation on #4 (standards-based; #4 decisions 14 and 15). Chunks H2, H3, U5.

- The settings panel (`#masthead-menu`) holds radio groups, a toggle and buttons. `role=menu` promises menuitems and a different key model, so it is wrong here. Pattern: APG Disclosure with a non-modal popover: trigger button with `aria-expanded` + `aria-controls`; content is a labelled region of ordinary controls in the tab order.
- Building block: Bits Popover behind the Planum Popover wrapper, configured as the spike proves (`kit-spike/Spike.svelte`, "Popover: Tab out ..." test):
  - `trapFocus={false}` (non-modal; #4 decision 14);
  - **no Portal**: the content stays right after the trigger in the DOM, so Tab continues in document order (WCAG 2.4.3). With a Portal, Tab from the last control left the document;
  - close on focus-out: a `focusout` handler on the content closes it when `relatedTarget` is neither inside the content nor the trigger (legacy `header.js:135-138`);
  - `onCloseAutoFocus` is prevented when the close came from focus-out, so focus stays where the user moved it. Escape closes and returns focus to the trigger (the consumed Escape of `header.js:141`, so the app's Escape does not also clear the selection).
- One popover open at a time. Outside press also closes.
- Choosing a setting (#4 decision 15, APG Radio Group): a **keyboard** radio choice keeps the panel open, so arrows can walk the options; a **pointer** choice or a command (Full screen, Provenance, Shortcuts) closes it. Legacy closes after any choice (`header.js:126`); that would close the panel on the first arrow press.
- Data summary (`#masthead-data-toggle`): same disclosure when the bar is collapsed; the fields stay native `<select>` with visible labels.
