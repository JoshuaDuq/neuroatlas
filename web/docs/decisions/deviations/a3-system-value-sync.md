# The system select always shows the display's system

Chunk: A3
Status: fix, standard cited (approved in decision 36 on #4).

## Legacy behaviour

A failed command renders (`failIfCurrent` calls `fail()`, which notifies and renders: `viewer/state/scene-commands.js:33-43`) and the render resets the select (`viewer/ui/panels/internal-anatomy.js:54`). Only a choice that a later command overtook returns without a render (`scene-commands.js:124-130`), so the select can show a system the display does not hold until the next render.

## New behaviour

A Svelte bound select is rewritten only when its bound value changes, so a refused choice would stay on screen for good. After the choice command settles, even if it rejects, `SystemPicker.svelte` sets its bound value back to the display's own, and Svelte rewrites the select. The reset goes through the binding, so a later rebuild of the options (a language switch) keeps the display's system.

## Standard cited

WCAG 2.2 SC 4.1.2 Name, Role, Value (a control's value must reflect its state) and SC 3.3.1 Error Identification (the notice that names the failure is not contradicted by the control).
