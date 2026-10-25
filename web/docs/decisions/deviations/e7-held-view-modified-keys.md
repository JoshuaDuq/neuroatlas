# E7 deviation: a camera key pressed with Ctrl, Meta or Alt leaves the held view alone

Chunk E7 (#31). A fix under the parity policy (WCAG 2.2 AA, WAI-ARIA APG, platform practice).

- **Legacy** (`viewer/ui/chrome/viewport-chrome.js:610-614`): while the canvas has focus, any keydown
  whose key is one of `CAMERA_KEYS` (the four arrows, `+`, `=`, `-`) drops the held view preset, with
  or without a modifier. Ctrl/Cmd/Alt with `+`, `=` or `-` is the browser's page zoom, and Alt with an
  arrow is the browser's history navigation; the camera does not move (`app.js:1896` already returns on
  `metaKey`, `ctrlKey` and `altKey`), yet the preset button stopped showing the camera's state.
- **New** (`engine/held-view.ts`, `createHeldView`): the same keydown on the canvas releases the view
  only when none of Ctrl, Meta and Alt is down. Shift stays allowed: it is how `+` is typed on most
  layouts. The app's own key handler and the held view now agree on what a camera key is.
- **Standard**: key events with these modifiers are the user agent's or the page's shortcuts, not the
  widget's own keys (WCAG 2.2 SC 2.1.4 Character Key Shortcuts, and the WAI-ARIA APG's keyboard
  interaction guidance that a widget leaves browser and assistive-technology shortcuts alone).
- **Test**: `web/parity/E7.test.ts`, "keeps the view for a camera key pressed with Ctrl, Meta or Alt",
  which also shows the legacy closure dropping the view on the same key.
