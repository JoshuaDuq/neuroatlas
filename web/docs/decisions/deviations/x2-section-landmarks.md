# No landmarks from inner sections

Chunk: X2
Status: fix (standard cited)

## Legacy behaviour

clinical.js:269-280 and index.html:339,417 label the profile, Associations, Checked maps and related sections with `aria-labelledby`, so each is a region landmark.

## New behaviour

The inner sections carry no accessible name; their headings label them. The profile sits in the workspace's tabpanel.

## Standard cited

WAI-ARIA APG Landmark Regions: use landmarks sparingly; decision 13 on #4.
