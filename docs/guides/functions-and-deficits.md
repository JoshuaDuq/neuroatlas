# Functions and deficits

The **Functions** and **Deficits** tabs colour related regions and show a key. Select a profile for its evidence and region list; **Restore previous view** returns to the view before opening a profile. Choosing a colour in the masthead replaces the profile colours.

## Functions

The 70 curated functions are based on Neurosynth terms. **All functions** displays eleven assessment functions together; opening one shows its study count, regions with mean z ≥ 3 and any lesion associations used to check the map. Individual maps use a blue scale for z 3–5, 5–10 and ≥ 10. Deep structures can be exposed with **See through the cortex**. They are scored on FreeSurfer's whole structures and drawn on the teaching set, or on FreeSurfer aseg when that is the internal anatomy shown; NextBrain's finer nuclei are not scored, so opening a function switches NextBrain to the teaching set.

A map describes where studies using a term consistently report activation in healthy groups. It does not measure function in this subject or predict the effect of a lesion. See [the method and limitations](../concepts/atlases.md#neuropsychological-functions).

Search also offers selected Neurosynth terms and clinical groups. These maps use the same method but have not been checked against their names or lesion studies. A clinical-group map shows reported activation in studies of that group, not where damage causes the condition. The offered terms are in [`config/neurosynth-terms.yaml`](https://github.com/JoshuaDuq/neuroatlas/blob/main/config/neurosynth-terms.yaml).

## Deficits

The 70 profiles describe acquired adult deficits and selected associations with brain regions. Search by name, synonym or function. A profile identifies the evidence, population and limitations for each finding, and links to its regions and relevant function maps. Regions are coloured by finding; the key indicates findings that cannot be coloured in the current view.

When the consulted sources identify only a broad anatomical location, a finding may have no specific atlas parcel selected. Its mapping note explains the limit; the publications remain available. Other findings in the same profile may have supported landmarks. A map showing both hemispheres can represent separate unilateral cases; the mapping note distinguishes this from bilateral injury.

The literature is selected, not a systematic review. A single case cannot establish that the same lesion pattern is required in everyone. Network studies may identify connected regions that were not directly injured. Group-level associations mapped onto a reference anatomy do not predict an individual patient's deficit. Content and citations are in [`data/neuropsychology.yaml`](https://github.com/JoshuaDuq/neuroatlas/blob/main/data/neuropsychology.yaml).
