# A control stays focusable while a run is in flight

Chunk: X3
Status: fix (decision 40 on #4, bug 2); listed in the X3 PR

## Legacy behaviour

circuits.js:137-141 set `disabled` on every button of the browser, profile, stepper and notes while a landmark opened. A disabled button cannot hold focus or receive keys, and browsers differ in where focus goes (Firefox and Safari drop it to the body), so a keyboard reader pressing Next lost their place until `settle` restored it.

## New behaviour

No control is natively disabled. Each carries `aria-disabled="true"` while a run is in flight and is drawn as disabled, and the busy runner (`createBusyRunner`) refuses a second run. Focus never leaves the control that was pressed. Decision 40 names the focused control; the model does not know which control is focused, and no control can then lose focus, so every control in the four containers takes it. `aria-busy` stays on the profile and the notes only (it meant nothing on the other containers).

## Standard cited

WCAG 2.2 SC 2.4.3 Focus Order and 2.1.1 Keyboard; WAI-ARIA APG, Keyboard Interface, "Focusability of disabled controls"; the same pattern as `x1-focusable-while-opening.md`.
