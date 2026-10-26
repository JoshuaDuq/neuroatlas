# Tab panels: real tabpanels, aria-controls on the selected tab

Chunk: H5

## Legacy behaviour

workspace.js:158-159 sets `role="tabpanel"` on the `<aside id="navigator">` and `<aside id="inspector">` at run time, which replaces their complementary landmarks ("Find a region", "Region details and view controls"). workspace.js:108 puts `aria-controls` on all five tabs, all pointing at whichever panel is shown.

## New behaviour

The list and the detail are `div role="tabpanel"` (never `aside`, #4 decision 13), each `aria-labelledby` the selected tab. Only the selected tab carries `aria-controls`, pointing at the panel that is shown. The inactive panel is `hidden`.

## Standard cited

WAI-ARIA APG Tabs pattern (each tab controls its panel; the panel is labelled by its tab); WAI-ARIA 1.2 `aria-controls`; WCAG 2.2 SC 1.3.1 and 4.1.2. React Aria sets `aria-controls` on the selected tab only.
