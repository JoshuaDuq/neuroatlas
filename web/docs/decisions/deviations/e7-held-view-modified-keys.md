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
- **Standard**: the WAI-ARIA Authoring Practices Guide, "Developing a Keyboard Interface": a widget avoids
  conflicts with browser and assistive-technology shortcuts, so a key pressed with Ctrl, Meta or Alt is not
  the canvas's key. The app's own key handler already returns on those modifiers (`app.js:1896`); the held
  view now agrees with it.
- **Test**: `web/src/lib/engine/held-view.test.ts`, "FACADE-21 the same keys with Ctrl, Meta or Alt are the
  browser's and keep the view".
