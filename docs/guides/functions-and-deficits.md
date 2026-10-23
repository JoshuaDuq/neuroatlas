# Functions and deficits

Both tabs paint the brain while they are in front: the regions in question in their colours, every other region in tissue colour, with a key on the stage. Choosing a colour in the masthead replaces the paint.

## Functions

70 functions in six groups, each one Neurosynth term. **All functions** shows the eleven functions an assessment reports (executive functions, working memory, long-term memory, language, attention, visuospatial abilities, social cognition, visual perception, motor functions, auditory perception, emotion), each area in its strongest one. Open a function to see:

- its Neurosynth term, how many studies use it, and how many HCP-MMP areas and subcortical structures reach z ≥ 3;
- those areas and structures, strongest first, each opening its region;
- **Deficits that check this map**: the share of each lesion-mapped parcel the map colours.

A map shows where studies using the term reliably report activation in healthy groups. It is not what this brain does, nor what damage would impair. The method is in [Atlases](../concepts/atlases.md#neuropsychological-functions).

## Deficits

40 profiles of adult acquired deficits, in eight groups, searchable by name, synonym or cognitive function. Opening one:

- paints the regions its findings cite, one colour per finding, and states what it changed in the view, with **Restore previous view**;
- gives the definition, the interpretation limits and each association, with its method (lesion–symptom mapping, meta-analysis, case report or series), study population and publications;
- keeps each association's mapped regions in reach, each opening its region.

The literature is selected, not a systematic review. Associations come from group studies mapped onto a reference anatomy, and do not predict an individual patient's deficit. Content and references live in [`data/neuropsychology.yaml`](https://github.com/JoshuaDuq/neuroatlas/blob/main/data/neuropsychology.yaml); every PMID and DOI is checked against PubMed by the test suite.
