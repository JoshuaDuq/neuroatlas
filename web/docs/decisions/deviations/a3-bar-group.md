# The dissection bar is a labelled group, not a landmark

Chunk: A3
Status: fix, standard cited (approved in decision 36 on #4).

## Legacy behaviour

`<section id="dissection-controls" aria-labelledby="dissection-heading">` is exposed as a `region` landmark inside the navigator's own `complementary` landmark (`index.html:314`).

## New behaviour

`<div role="group" aria-labelledby>` over the same visually-hidden `<h3>Dissection</h3>`, one level below the panel heading. The bar is found by its name and heading, and is not a landmark. Text, buttons and visible layout are unchanged.

## Standard cited

WAI-ARIA APG Landmark Regions: use landmarks sparingly; a rail that is already a `complementary` landmark does not need one for a status line and two buttons.
