# Retry is labelled for what it does

Chunk: T1
Status: fix (decision 42, B10); listed in the T1 PR

## Legacy behaviour

The retry button read "Reload reference dataset" whatever failed, though it re-runs only the load that failed (one bundle, or the dataset).

## New behaviour

"Try again" / "Réessayer". After an updated deploy, where only a page reload helps, it stays "Reload" / "Recharger".

## Standard cited

WCAG 2.2 SC 2.4.6 Headings and Labels (labels describe purpose); SC 3.3.1 Error Identification (say what to do next).
