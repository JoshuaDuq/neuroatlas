# The comparison's heading is the plain text of its summary

Chunk: R2
Status: fix (decision 39, B1); listed in the R2 PR

## Legacy behaviour

`<summary><h3 id="comparison-heading">Overlap with …</h3></summary>` (`index.html:366`): a heading inside the disclosure button, so assistive technology that treats a button's content as presentational does not offer it in heading navigation, and the button's name hangs on a nested element.

## New behaviour

The summary holds the text only, as R1's other sections do (`r1-summary-headings.md`); the disclosure button names the section.

## Standard cited

ARIA 1.2: a `summary` in a `details` has the button role, and the children of a button are presentational, so a heading inside it is dropped or flattened by assistive technology (WCAG 2.2 SC 1.3.1 and 4.1.2); GOV.UK Design System, Details (plain-text summary).
