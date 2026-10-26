# The system select always shows the display's system

Chunk: A3
Status: fix, standard cited (approved in decision 36 on #4).

## Legacy behaviour

The select keeps the option the reader chose until the next render (`viewer/ui/panels/internal-anatomy.js:54` is the only place that resets it). The handler (`viewer/app.js:1195-1218`) returns before any render when the spinal cord volume fails to load, and an error posts a notice without a render, so the select can show a system the display does not hold.

## New behaviour

After the choice command settles, the select is set to the display's own value (`SystemPicker.svelte`). A choice that failed, or that a later command overtook, is put back; a choice that took effect is unchanged. The value is otherwise rendered from the display only.

## Standard cited

WCAG 2.2 SC 4.1.2 Name, Role, Value (a control's value must reflect its state) and SC 3.3.1 Error Identification (the notice that names the failure is not contradicted by the control).
