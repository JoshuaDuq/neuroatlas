# A failed plane choice stops preparing

Chunk: G4
Status: fix (bug)

## Legacy behaviour

Choosing a plane sets `pendingPlane` and awaits the cut (ui/chrome/sections.js:176-179). If the cut rejects (a download fails), the listener's catch reports the error but `pendingPlane` is never cleared: the row stays pending with nothing to move until another plane is chosen.

## New behaviour

The pending plane is cleared however the cut ends. A failed cut leaves the row on the plane that is really cut (or removes it when none is), and the status line says the failure ("Could not prepare the section.") until the cut changes again.

## Standard cited

Bug fix (a state that never ends). WCAG 2.2 SC 3.3.1 Error Identification and SC 4.1.3 Status Messages: the failure is identified in text, not left behind a row that still claims to be preparing.
