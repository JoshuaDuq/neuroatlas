# 0001 UI kit: Bits UI behind Planum wrappers

Status: accepted (user, #4; delegation comment of 2026-10-25). Chunk U0.

## Decision

- `bits-ui` 2.20.2 is pinned exactly in `web/package.json` (the only edit after F0; the lock file follows).
- Every kit component is wrapped once, as a Planum primitive in `src/lib/ui/`. Features never import `bits-ui`; no kit type appears in a wrapper's public props.
- Wrappers style only through the kit's `data-*` attributes (`data-state`, `data-orientation`, `data-disabled`, `data-value`) and scoped CSS in `@layer components`. No kit class names, no inline style props.
- Native elements wherever HTML has the widget: `<dialog>`, `<details>`, `<input type=range>` + `<input type=number>`, `<select>`, `<progress>`, `<fieldset>` + checkboxes.
- Hand-rolled: treegrid (U7), bottom sheet (H6), announcer, stepper markup.
- Bits-backed: RadioGroup, Toolbar, Tabs, Popover, Tooltip (one Provider), Combobox, Switch, Collapsible.

## Exit path

The wrapper is the seam. If Bits lapses (no release for 12 months, an unfixed WCAG defect, a Svelte major it does not support): fork (MIT) and pin the fork, or swap the wrapper internals to Zag.js machines. Feature code does not change. Yearly health review: release cadence, open accessibility issues, Svelte compatibility, bundle size.

## Spike results

Verified from Bits UI 2.20.2 source and by `src/lib/ui/kit-spike.svelte.test.ts` in Chromium (fixture: `kit-spike/Spike.svelte`).

| Component                | APG pattern                   | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------ | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RadioGroup               | Radio Group                   | `role=radiogroup`/`radio`, `aria-checked`, roving tabindex with the checked item as the tab stop, all four arrows move **and select**, Space selects, Home/End, loop. Matches the APG while a value is set (Bits selects on keyboard focus only when the group has a value). Wrap it.                                                                                                                                                                                                                                                  |
| Toolbar + Toolbar.Button | Toolbar                       | `role=toolbar`, roving tabindex, arrows/Home/End move focus, Enter/Space are the native button's. Buttons take our own `aria-pressed`. Matches. **`Toolbar.GroupItem type=single` emits `role=radio` + `aria-checked` inside a toolbar and `type=multiple` allows several pressed: do not use either for an exclusive `aria-pressed` choice. Use `Toolbar.Button` with an explicit `aria-pressed`.**                                                                                                                                   |
| Tabs                     | Tabs                          | `activationMode="manual"`: arrows move focus only, Enter/Space/click activate; `role=tab`, `aria-selected`, `aria-controls`, tabpanel `aria-labelledby`. Matches.                                                                                                                                                                                                                                                                                                                                                                      |
| Tooltip.Provider         | Tooltip                       | The timing test measures the 500 ms show delay and the 300 ms skip window. **Bits renders no `role=tooltip` on the content: the wrapper must add it.** `aria-describedby` on the trigger is set. `delayDuration=500`, `skipDelayDuration=300` reproduce the legacy timing (`viewer/ui/tooltip.js` SHOW_DELAY, SKIP_WINDOW); hoverable content and grace area built in; Escape closes; focus shows.                                                                                                                                     |
| Popover                  | Disclosure / non-modal dialog | Trigger `aria-expanded`/`aria-controls`; Escape closes and returns focus to the trigger. **Defaults are not enough:** `trapFocus` defaults to true, and with a Portal Tab from the last control leaves the document and the popover stays open. The wrapper must use `trapFocus={false}`, no Portal, a focus-out close and a prevented `onCloseAutoFocus` on that close (0005). Spiked and passing.                                                                                                                                    |
| Combobox                 | Combobox (list autocomplete)  | `role=combobox` on the input with `aria-activedescendant`, `aria-autocomplete=list`, `aria-expanded`; listbox `role=listbox`, options `role=option`. **Bits 2.20.2 sets no `aria-controls` on the input and no name on the listbox; axe reports `aria-required-attr` and `aria-input-field-name` once open. The U6 wrapper must set `aria-controls` to the content id and give the listbox an accessible name.** The fixture does both and axe is clean with it open. Notes and status text must live outside `Combobox.Content` (U6). |

Screen reader smoke (NVDA, VoiceOver) cannot run in this environment. The spike asserts roles, states, keyboard paths and axe; the manual smoke is a required step of U3, U5, U6 and U7 before they merge, with notes in those PRs.

## Bundle budget

- Measured on 2026-10-25 (Vite 8 library build, minified, gzip -9) for the six-part spike fixture (RadioGroup, Toolbar, Tabs, Popover, Tooltip, Combobox, with the Svelte runtime): 65.6 kB gzip.
- The issue's estimate for the full ten-component set is about 78 kB gzip. **Budget: 85 kB gzip** for the Bits UI chunk plus Svelte runtime of the final set; investigate before raising it.
- Method: `vite build` of an entry that mounts the wrappers, then `gzip -9 | wc -c` of the output.
- An automated check needs a script or CI file this chunk does not own; requested on #4 for F5.
