# The function search field has a visible label

Chunk: X1
Status: fix (standard cited)

## Legacy behaviour

index.html:262-277 and functions.js:412-415 give the field a visually hidden label and a placeholder with the same words. The placeholder is the only visible hint and disappears on input.

## New behaviour

A visible label sits above the field ("Search functions"); the placeholder is dropped, since it would repeat the label. Approved as part of decision 37 on #4.

## Standard cited

WCAG 2.2 SC 3.3.2 Labels or Instructions (A); SC 1.3.5; placeholder text is not a substitute for a label (HTML Standard, forms; GOV.UK and Carbon search guidance).
