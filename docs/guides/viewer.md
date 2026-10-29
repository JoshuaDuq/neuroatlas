# Using the viewer

The masthead selects the subject and display layers. The panel holds searchable content; the stage contains the model and its view, section and display controls. On phones the panel is a draggable sheet.

## First steps

1. Open the [viewer](https://planumatlas.com/) and search for a region in the **Anatomy** tab. Select a result or select it on the model to see its details.
2. Choose **Section** below the model and select a plane. Move the slider to explore the cut.
3. Open **Linked MRI** from the section bar to compare the model with the subject's scan.
4. Copy the page URL to share the view, or use **Save image** to export the stage. The URL carries a placed lesion, its colouring and the tract drawn through it.

## Masthead

| Field | Choices |
| :--- | :--- |
| Subject | MGH CDMD (and `fsaverage` when built locally) |
| Atlas | Destrieux (74 regions per hemisphere), HCP-MMP (180 areas per hemisphere) or Julich-Brain (139 cytoarchitectonic areas per hemisphere; about a quarter of the cortex not yet mapped) |
| Colour | Tissue, T1 MRI, Regions, Yeo 7 networks, CAB-NP networks |
| Internal anatomy | Teaching set, FreeSurfer aseg, NextBrain |

CAB-NP colours HCP-MMP areas only, so choosing it switches the atlas; the option says so before you choose it. While the Functions or Deficits tab paints the brain, Colour reads **Functions** or **Deficit**; choosing a colour there replaces the paint.

When the fields do not fit, they collapse into one summary button that opens the same fields. **⋯** holds Language, Theme, Single-key shortcuts and the keyboard shortcut list. **Save image** writes the stage as a PNG, with its orientation letters, scale bar, colour key, a caption and the not-clinical statement.

## Panel

Five tabs: **Anatomy**, **Functions**, **Deficits**, **Circuits** and **Tracts**. Each starts as a searchable list. Opening an item shows its detail under one location bar; **‹** returns to the list where you left it, and so does <kbd>Esc</kbd>.

Functions and Deficits are covered in [their own guide](functions-and-deficits.md), Circuits in [Guided circuits](circuits.md), and Tracts in [Diffusion and tracts](tracts.md).

### Anatomy

Search by name, or browse the **Whole brain** or **By system**. Select a region in the list or on the model to open its detail:

- Hemisphere, lobe or system, surface area or volume, centroid in RAS millimetres, and the source label.
- **Focus**, **Isolate**, **Hide** and **Linked MRI**.
- **Overlap with** another cortical atlas (see below).
- **Functional regions (group atlas)**, for a cerebellar lobule: its share in each functional region of the registered Nettekoven et al. (2024) atlas, with each region's domain. A functional region chosen on a cut shows what the paper found it does. See [Atlases](../concepts/atlases.md#functional-cerebellar-regions).
- **Boundary certainty**, for a NextBrain region: each rated neighbour, largest shared boundary first, with the share of that boundary where NextBrain nearly chose the other label. A name selects the neighbour without moving the camera. See [Atlases](../concepts/atlases.md#boundary-certainty).
- **Functional division**, **Neuropsychological functions** and **Functional networks**, as disclosures that stay open between selections.
- The deficits and guided-circuit landmarks that involve the region, each opening in its own tab.

### Dissection

The eye beside a row hides that region or group; **L** and **R** act on each side. Hiding cortex exposes the subject's own white-matter surface. Hidden parts stay searchable, and selecting one reveals it. The line at the foot of Anatomy reads “N parts hidden · Undo · Restore all”. Switching subject clears the dissection.

### Atlas overlap

A Destrieux, HCP-MMP, Julich-Brain or Schaefer region lists the regions of another cortical atlas it shares pial surface with: the shared area in mm² and its share of the selected region's **whole** surface, with the unassigned remainder shown. **Compare with** chooses that atlas; each pair downloads the first time it is shown. The two directions give different percentages, and Julich-Brain's gap maps and Schaefer's medial wall count as unassigned. Activate a row to outline that intersection; a section turns outlines off. **Download CSV** exports every pair at full precision with checksums and citations, named after both atlases. An overlap is spatial: it does not carry one atlas's measurements, such as Julich-Brain's receptor fingerprints, to the other's regions. The method is in [Atlases](../concepts/atlases.md#comparing-cortical-atlases).

## Stage

The dock at the bottom left holds four tools.

- **View** holds the presets: oblique, left, right, anterior, posterior, superior, inferior.
- **Section** chooses the cutting plane (full brain, sagittal, coronal, axial, oblique) and the cut labels. **Cerebellar functions** colours the cerebellar cortex by the registered group functional atlas. With NextBrain cut labels, a selected NextBrain region is outlined on the cut: solid where its boundary is firm, dashed where soft, grey where unrated.
- **Display** holds hemisphere, cortex and its opacity, internal anatomy, spinal cord and **Reset view**.
- **Lesion** places a sphere (3–30 mm radius): while it is open, a click on the brain or a cut face sets the centre. Cut first to place it at depth.

### Lesion report

A placed lesion is Anatomy's detail. It opens on **What it reaches**, under the six groups the Functions and Deficits tabs share, strongest group first.

```{figure} ../../.github/assets/readme/lesion.webp
:alt: A 10 mm lesion sphere on the left subcentral gyrus, with the report listing the sensorimotor functions and deficits it overlaps

A 10 mm sphere on the left subcentral gyrus. The report ranks the functions and deficits it overlaps; it measures overlap only.
```

- **Functions** whose territories the lesion overlaps. A territory is a function's HCP-MMP areas and structures at z ≥ 3, on the sides the lesion reaches. Each function shows the share of its territory inside the lesion; bars are scaled to the largest share.
- **Deficits** with a finding whose cited region the lesion reaches, with the largest share reached.

Each row opens its function or deficit. **On the brain** switches between the lesion alone, the territories of the leading functions, and the regions cited by the findings, one colour per item in rank order; the atlas follows the choice.

Below, **Findings in detail** lists each finding with its reached regions and mapping note, and marks a bilateral finding the lesion reaches on one side only. **Anatomy measured** gives the tissue volumes and each cortical region's share, on Destrieux or HCP-MMP; deep structures and gyral white matter follow. **Tracts** downloads the bundles on the sides the sphere reaches, plus the seven callosal segments, and counts the streamlines with a point inside. Activate a counted bundle to draw only those streamlines, over a see-through cortex; the lesion's footprint becomes see-through with it. They follow the sphere as it moves or grows, and activating the bundle again, removing the lesion or leaving Anatomy gives the tracts and the cortex back. They are reconstructed streamlines with a point inside the sphere: not axons, and not a measure of disconnection.

The report measures overlap only: it predicts no deficit. Structures drawn only as meshes, such as the fornix, are not measured.

A cut adds the section bar above the dock: a slider and a millimetre field for the position, tilt and azimuth for an oblique plane, **Reverse side**, **Linked MRI**, and × to return to the full brain. Positions are surface RAS millimetres: +R right, +A anterior, +S superior. Each solid is capped where the plane meets it, and the cap samples the label volume of the chosen cut labels.

```{figure} ../../.github/assets/readme/sections.webp
:alt: A coronal section through the left hippocampal formation, with each solid capped by its labels and the section bar below

A coronal cut at −20 mm with the left hippocampal formation selected. Each solid is capped, and the caps sample the label volume.
```

An anatomy without a segmented cord publishes no spinal cord; Display says so.

### Linked MRI

**Linked MRI** (region detail, section bar, or <kbd>M</kbd>) opens the subject's T1 in three orthogonal sections around a shared crosshair, with window and level, a segmentation overlay, voxel label readout and PNG export. The slices always show the full original scan; dissection does not change them.

```{figure} ../../.github/assets/readme/linked-mri.webp
:alt: Linked MRI: sagittal, coronal and axial T1 sections around a shared crosshair, with the voxel's label and the window and level controls

Linked MRI at the coronal cut above: the subject's T1 in three planes, with the label under the crosshair.
```

## Status bar

“Not clinical anatomy”, a description of the subject, the visible region count and **Provenance**. Provenance lists the subject, reconstruction, atlases, published files and sources.

## Sharing a view

The address bar records the current view, including selection, display settings, camera and section. Copy the URL to share it. If a setting cannot be applied to the selected subject, a notice explains what was omitted.

## Keyboard

Press <kbd>?</kbd> in the viewer for the live list. Single-key shortcuts can be turned off under **⋯**.

| Keys | Action |
| :--- | :--- |
| <kbd>/</kbd> | Focus the search field |
| <kbd>←</kbd> <kbd>→</kbd> | On the tabs: move between tabs |
| <kbd>↑</kbd> <kbd>↓</kbd>, <kbd>Home</kbd> <kbd>End</kbd> | Move through results or the tree |
| <kbd>→</kbd> <kbd>←</kbd> | In the tree: open or close a group, or reach a row's eye |
| <kbd>Enter</kbd> | Select the focused region |
| <kbd>V</kbd> | Hide or show the focused tree row |
| <kbd>Esc</kbd> | Back to the list; elsewhere clear the search, then the selection |
| <kbd>Tab</kbd> | Move focus to the model |
| Arrows, <kbd>+</kbd> <kbd>−</kbd> | Turn and zoom the focused model |
| <kbd>1</kbd>–<kbd>6</kbd>, <kbd>0</kbd> | Left, right, anterior, posterior, superior, inferior; oblique |
| <kbd>F</kbd>, <kbd>I</kbd> | Focus, isolate the selected region |
| <kbd>C</kbd>, <kbd>U</kbd>, <kbd>S</kbd> | Show or hide cortex, internal anatomy, spinal cord |
| <kbd>H</kbd> | Cycle hemisphere: both, left, right |
| <kbd>M</kbd> | Open or close the linked MRI |
