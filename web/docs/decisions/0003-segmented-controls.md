# 0003 Segmented controls, per group

Status: accepted (user, #4). Chunks U0, U3.

Legacy builds every `.segmented` as a `role=group` of `aria-pressed` buttons with a hand-made roving tabindex (`viewer/ui/roving.js`): a mix that is neither the radio nor the toggle-button pattern.

Rule: mutually exclusive and cheap to apply = APG **Radio Group**; an action, or an expensive choice = APG **Toolbar** of `aria-pressed` buttons.

| Group (legacy id)                                                                           | Pattern                           | Building block                                                  |
| ------------------------------------------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------- |
| Language `#lang-switch`, theme `#theme-switch`, single-key shortcuts `#single-keys-switch`  | Radio Group                       | Bits RadioGroup (verified)                                      |
| Tree scope `#tree-scope`, hemisphere `#hemisphere`, MPR planes `#mpr-planes`                | Radio Group                       | Bits RadioGroup                                                 |
| View presets `#views` (camera moves), cut mode `#cut-mode` (rebuilds sections), paint picks | Toolbar of `aria-pressed` buttons | Bits Toolbar.Root + Toolbar.Button with explicit `aria-pressed` |

- Not Bits ToggleGroup (single mode gives radio roles without APG arrow selection). Not `Toolbar.GroupItem type=single` (emits `role=radio` in a toolbar).
- Radio groups always hold a value, so Bits' arrow-selects behaviour (which needs a value) applies.
- Name: `aria-labelledby` the visible label, as legacy.
- Keys. Radio Group: Tab enters on the checked item; arrows move and select with wrap; Space selects. Toolbar: Tab enters on one item; arrows/Home/End move focus only; Enter/Space press.
- Targets at least 24x24 CSS px (WCAG 2.5.8).
- Deviation: `deviations/u3-segmented-controls.md`.
