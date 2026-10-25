# English published data in a French interface

Chunk: H4
Status: fix (standard cited)

## Legacy behaviour

viewer/ui/panels/provenance.js:110-134 writes the manifest's own text (subject name, reconstruction, atlas, network and layer labels, licence names) with no `lang`, so with the interface in French a screen reader pronounces English with French phonetics.

## New behaviour

A value the sheet does not translate carries `lang="en"`: the sheet builds its rows in English as well and marks each text or note that is identical in both languages. Translated labels and notes, and the interface text, stay unmarked. URLs and file names are not marked. In English nothing is marked.

## Standard cited

WCAG 2.2 SC 3.1.2 Language of Parts (AA).
