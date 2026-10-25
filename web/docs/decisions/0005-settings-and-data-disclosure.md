# 0005 Settings and data summary are disclosures, not menus

Status: decided under the delegation on #4 (standards-based). Chunks H2, H3, U5.

- The settings panel (`#masthead-menu`) holds radio groups, a toggle and buttons. `role=menu` promises menuitems and a different key model, so it is wrong here. Pattern: APG Disclosure with a non-modal popover: trigger button with `aria-expanded` + `aria-controls`; content is a labelled region of ordinary controls in the tab order.
- Closing: Escape (focus returns to the trigger; consumed so the app's Escape does not also clear the selection, as `header.js:141`), outside press, and Tab out (`header.js:135`). Legacy closes the menu after a setting is applied (`header.js:126`); kept.
- Data summary (`#masthead-data-toggle`): same disclosure when the bar is collapsed; the fields stay native `<select>` with visible labels.
- Block: Bits Popover (non-modal, no focus trap) behind the Planum Popover wrapper.
