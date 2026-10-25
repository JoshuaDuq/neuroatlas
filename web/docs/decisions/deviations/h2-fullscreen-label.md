# The full-screen labels follow the state

Chunk: H2
Status: approved by the user on #4 (decision 4)

## Legacy behaviour

Full screen is the name of the masthead button and the menu item whether or not the stage is fullscreen (header.js:202,209).

## New behaviour

While the document is fullscreen, driven by `fullscreenchange` through the `fullscreen` prop, both read "Exit full screen" / "Quitter le plein écran". The string comes from G6 through C1; until it lands H2 takes it as the `exitFullscreenLabel` prop. The icon is unchanged.

## Standard cited

WCAG 2.2 SC 4.1.2 Name, Role, Value; decision 4 on #4. See g6-fullscreen-exit.
