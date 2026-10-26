# A sample with no name reads as unlabelled

Chunk: G5
Status: fix (bug)

## Legacy behaviour

The readout prints `${position} — ${name} (label ${labelId})` whatever the sample: a sample with no name gives an empty name, and one with no label id prints "(label undefined)" (sections.js:557-561, 390-391).

## New behaviour

A sample with no name reads "<position> — Unlabelled" (FR "Non étiqueté"), the words the label volume's own unknown already uses; with a name the sentence is unchanged.

## Standard cited

Correctness (no `undefined` in the reader's text); WCAG 2.2 SC 3.3.1-style plain wording and SC 4.1.3 for a sentence that is announced.
