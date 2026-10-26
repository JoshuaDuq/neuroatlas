# The comparison's heading is the plain text of its summary

Chunk: R2
Status: fix (decision 39, B1); listed in the R2 PR

## Legacy behaviour

`<summary><h3 id="comparison-heading">Overlap with …</h3></summary>` (`index.html:366`): a heading inside the disclosure button, so assistive technology that treats a button's content as presentational does not offer it in heading navigation, and the button's name hangs on a nested element.

## New behaviour

The summary holds the text only, as R1's other sections do (`r1-summary-headings.md`); the disclosure button names the section.

## Standard cited

WCAG 2.2 SC 1.3.1 and 4.1.2; WAI-ARIA APG Disclosure pattern; GOV.UK Details component (plain-text summary).
