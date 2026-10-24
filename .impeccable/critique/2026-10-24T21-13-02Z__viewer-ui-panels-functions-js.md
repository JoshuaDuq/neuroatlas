---
target: Functions tab search and Deficits tab
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/Users/joduq24/Desktop/neuroatlas/viewer/ui/panels/functions.js"
target_fingerprint: "sha256:44327ed25237377e72dad722c7f855e8301167458cc97df7271ea209ff09b3d1"
target_path: /Users/joduq24/Desktop/neuroatlas/viewer/ui/panels/functions.js
timestamp: 2026-10-24T21-13-02Z
slug: viewer-ui-panels-functions-js
---
# Critique: Functions tab search and the Deficits tab

Method: dual-agent (A: design review · B: detector and browser evidence); the parent reproduced the P1 deficit-key mismatch.

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Deficit key can contradict the stage; result counts not announced |
| 2 | Match system / real world | 2 | HCP codes as names, "reach z 3", junk terms as functions |
| 3 | User control and freedom | 3 | Restore, Escape, clear all work |
| 4 | Consistency and standards | 2 | 6 vs 8 groups; three names for one concept |
| 5 | Error prevention | 2 | 104 terms reach nothing yet paint; tab switch leaves wrong atlas |
| 6 | Recognition over recall | 2 | Must know Neurosynth vocabulary |
| 7 | Flexibility and efficiency | 3 | Keyboard and deep links; no sort or compare |
| 8 | Aesthetic and minimalist | 3 | On-system; stacked caveats |
| 9 | Error recovery | 2 | No-match generic, never points across tabs |
| 10 | Help and documentation | 2 | z unexplained; scope note at list foot |
| Total | | 24/40 | Acceptable |

Detector: CLI 0 findings; in-page scans clean at desktop; one advisory straggler on .scope-note at 375px (no text-wrap: pretty); one zero-viewport false positive.

## Priority issues
1. [P1] Uncurated vocabulary presents non-functions as functions (numeric/method/population terms; 104 reach nothing yet open and key a swatch; key title fixed). Fix: build-time filter, "Neurosynth term" key title, caveat first, population terms point to deficits. clarify
2. [P1] Tab switches leave the stage contradicting the panel (Deficits key over an atlas without its regions; link to Fear without atlas opens over an unpainted Destrieux brain). Fix: re-apply each tab's open item's atlas on show; hide key when paint colours nothing. harden
3. [P2] HCP-MMP codes as area names in function profiles. Fix: add functional-division names. clarify
4. [P2] No bridges between tabs; conflicting taxonomies. Fix: shared domain spine, reciprocal bridges, evidence line. shape
5. [P2] Search accessibility: no result announcements, missing lang="en" on terms, aria-label on generic divs, aria-pressed on navigation rows, orphaned restore tooltip. audit

## Persona red flags
Alex: no sort; 20-term cap; rank buckets beat study count; cross-language matching. Sam: silent result updates; French pronunciation of English terms; caveats before data. Clinician-educator: HCP codes; Fear barely visible laterally; group names differ across tabs; "reach z 3".

## Grouping recommendation
Keep two tabs and two searches; share one domain spine, add reciprocal bridges and an evidence line in each profile header.
