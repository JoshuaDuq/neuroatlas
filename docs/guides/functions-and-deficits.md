# Functions and deficits

Both tabs paint the brain while they are in front: the regions in question in their colours, every other region in tissue colour, with a key on the stage. Choosing a colour in the masthead replaces the paint.

## Functions

70 functions in six groups, each one Neurosynth term. **All functions** shows the eleven functions an assessment reports (executive functions, working memory, long-term memory, language, attention, visuospatial abilities, social cognition, visual perception, motor functions, auditory perception, emotion), each area in its strongest one. Open a function to see:

- its Neurosynth term, how many studies use it, and how many HCP-MMP areas and subcortical structures reach z ≥ 3;
- those areas and structures, strongest first, each opening its region;
- **Deficits that check this map**: the share of each lesion-mapped parcel the map colours.

When a function's strongest region is a deep forebrain structure the cortex hides (the amygdala for Fear, the accumbens for Reward), the notice says so and offers **See through the cortex**, which lowers the cortex's opacity; **Restore previous view** puts it back.

A map shows where studies using the term reliably report activation in healthy groups. It is not what this brain does, nor what damage would impair. The method is in [Atlases](../concepts/atlases.md#neuropsychological-functions).

### Searching Neurosynth terms

On CDMD, a search also lists matching Neurosynth version 7 terms below the curated functions: 232 that name a function, task, stimulus, state or behaviour under **Neurosynth terms**, and 45 clinical groups (schizophrenia, aphasia, smokers…) under **Neurosynth clinical groups**. The exact term comes first, then terms with a word starting with what you typed, larger literatures first. A misspelt query that matches nothing offers the closest name or term.

Opening a term paints every area and structure whose mean z reaches 3, in one colour, keyed **Neurosynth term**. Each map is derived the same way as the curated functions, but none was checked against what it names or against lesion studies, and the profile says so first. A clinical group's map shows where studies of that group report activation, not where damage causes the condition; where Deficits has a profile for the same words, the term links to it.

The rest of the 3,228-word vocabulary is report language ("accordingly"), anatomy ("angular gyrus") or method ("voxel"), whose maps name no function. [`config/neurosynth-terms.yaml`](https://github.com/JoshuaDuq/neuroatlas/blob/main/config/neurosynth-terms.yaml) lists the terms offered; edit it and rebuild to change them.

### Between the two tabs

Functions and Deficits stay apart because their evidence differs: activation consistency in healthy groups against lesion and clinical associations. They share the same six groups, in the same order, so a domain sits in the same place in both. Each profile says which evidence it rests on under its name. A search whose words the other tab also finds ends with a link to those matches, and a deficit lists the activation maps its associations check, the reverse of a function's **Deficits that check this map**.

## Deficits

40 profiles of adult acquired deficits, in the same six groups as the functions, searchable by name, synonym or cognitive function. Opening one:

- paints the regions its findings cite, one colour per finding, and states what it changed in the view, with **Restore previous view**;
- when its findings map both cortex and deep forebrain structures (neglect's caudate and pulvinar, emotion recognition's amygdala), names the deep ones and offers **See through the cortex**; when every mapped region is deep, the cortex is hidden instead;
- gives the definition, the interpretation limits and each association, with its method (lesion–symptom mapping, meta-analysis, case report or series), study population and publications;
- keeps each association's mapped regions in reach, each opening its region.

The literature is selected, not a systematic review. Associations come from group studies mapped onto a reference anatomy, and do not predict an individual patient's deficit. Content and references live in [`data/neuropsychology.yaml`](https://github.com/JoshuaDuq/neuroatlas/blob/main/data/neuropsychology.yaml); every PMID and DOI is checked against PubMed by the test suite.
