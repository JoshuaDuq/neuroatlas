# 0004 Tabs with manual activation

Status: accepted (user, #4). Chunks U0, H5, H6, I1.

- APG Tabs with **manual activation**: arrows/Home/End move focus; Enter/Space/click select. The legacy reason stands: choosing Tracts can swap the whole scene (`viewer/ui/chrome/workspace.js` createModeTabs).
- The workspace's tablist is hand-written (`Workspace.svelte`); loop is on. A Bits-based tablist was tried and removed: it put a stub tabpanel per mode in the page and reported no activation of the mode already chosen (`deviations/h5-tabpanel-semantics.md`). Legacy swallows ArrowUp/ArrowDown so the page's tree does not walk; the global keymap (S5a) must not take vertical arrows while focus is in a tab.
- One `tablist` ("Explore the atlas"). Each tabpanel is `aria-labelledby` that tablist's tab (legacy switches ids between two mirrored lists, `workspace.js:167`).
- The selected tab has tabindex 0, the others -1 (Bits default).
- Deviation: `deviations/h5-single-tablist.md`.
