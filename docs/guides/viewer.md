# Using the viewer

The window has three homes. The **masthead** says what data is loaded. The **panel** is where you explore and drill into it. The **stage** holds the tools that act on the picture.

```
+------------------------------------------------------------------------+
| NeuroAtlas | Subject  Atlas | Colour  Internal anatomy   Full screen ⋯ |
+------------------------+-----------------------------------------------+
| Anatomy Functions      |                                               |
| Deficits Circuits      |                    3D stage                   |
| Tracts                 |                                               |
| Search, list or detail | [View ▾] [Section ▾] [Display ▾]              |
+------------------------+-----------------------------------------------+
| Not clinical anatomy · description · N visible regions · Provenance    |
+------------------------------------------------------------------------+
```

On phones the panel becomes a sheet with peek, half and full positions; in short landscape it sits beside the anatomy.

## Masthead

| Field | Choices |
| :--- | :--- |
| Subject | SNAIL, `bert`, `aomic` |
| Atlas | Destrieux (74 regions per hemisphere) or HCP-MMP (180 areas per hemisphere) |
| Colour | Tissue, T1 MRI, Regions, Yeo 7 networks, CAB-NP networks, Functional divisions |
| Internal anatomy | Teaching set, FreeSurfer aseg, NextBrain |

CAB-NP and Functional divisions colour HCP-MMP areas only, so choosing one switches the atlas; the option says so before you choose it. While the Functions or Deficits tab paints the brain, Colour reads **Functions** or **Deficit**; choosing a colour there replaces the paint.

When the fields do not fit, they collapse into one summary button that opens the same fields. **⋯** holds Language, Theme, Single-key shortcuts and the keyboard shortcut list. **Save image** writes the stage as a PNG, with its orientation letters, scale bar, colour key, a caption and the not-clinical statement.

## Panel

Five tabs: **Anatomy**, **Functions**, **Deficits**, **Circuits** and **Tracts**. Each starts as a searchable list. Opening an item shows its detail under one location bar; **‹** returns to the list where you left it, and so does <kbd>Esc</kbd>.

Functions and Deficits are covered in [their own guide](functions-and-deficits.md), Circuits in [Guided circuits](circuits.md), and Tracts in [Diffusion and tracts](tracts.md).

### Anatomy

Search by name, or browse the **Whole brain** or **By system**. Select a region in the list or on the model to open its detail:

- Hemisphere, lobe or system, surface area or volume, centroid in RAS millimetres, and the source label.
- **Focus**, **Isolate**, **Hide** and **Linked MRI**.
- **Overlap with** the other cortical atlas (SNAIL only; see below).
- **Functional division**, **Neuropsychological functions** and **Functional networks**, as disclosures that stay open between selections.
- The deficits and guided-circuit landmarks that involve the region, each opening in its own tab.

### Dissection

The eye beside a row hides that region or group; **L** and **R** act on each side. Hiding cortex exposes the subject's own white-matter surface. Hidden parts stay searchable, and selecting one reveals it. The line at the foot of Anatomy reads “N parts hidden · Undo · Restore all”. Switching subject clears the dissection.

### Atlas overlap

On SNAIL, a Destrieux or HCP-MMP region lists the regions of the other atlas it shares pial surface with: the shared area in mm² and its share of the selected region's **whole** surface, with the unassigned remainder shown. The two directions therefore give different percentages. Activate a row to outline that intersection; a section turns outlines off. **Download CSV** exports every pair at full precision with checksums and citations. The method is in [Atlases](../concepts/atlases.md#comparing-destrieux-and-hcp-mmp).

## Stage

The dock at the bottom left holds three tools.

- **View** holds the presets: oblique, left, right, anterior, posterior, superior, inferior.
- **Section** chooses the cutting plane (full brain, sagittal, coronal, axial, oblique) and the cut labels.
- **Display** holds hemisphere, cortex and its opacity, internal anatomy, spinal cord and **Reset view**.

A cut adds the section bar above the dock: a slider and a millimetre field for the position, tilt and azimuth for an oblique plane, **Reverse side**, **Linked MRI**, and × to return to the full brain. Positions are surface RAS millimetres: +R right, +A anterior, +S superior. Each solid is capped where the plane meets it, and the cap samples the label volume of the chosen cut labels.

SNAIL publishes no spinal cord, because its scan ends inside the brainstem; Display says so.

### Linked MRI

**Linked MRI** (region detail, section bar, or <kbd>M</kbd>) opens the subject's T1 in three orthogonal sections around a shared crosshair, with window and level, a segmentation overlay, voxel label readout and PNG export. The slices always show the full original scan; dissection does not change them.

## Status bar

“Not clinical anatomy”, a description of the subject, the visible region count and **Provenance**. Provenance lists the subject, reconstruction, atlases, published files and sources.

## Links and notices

The address bar holds a link to what is on screen. It carries only what differs from the opening view.

| Field | Holds |
| :--- | :--- |
| `anatomy`, `atlas`, `detail`, `cuts` | Subject, cortical atlas, internal anatomy, cut labels |
| `colors`, `level`, `function`, `opacity`, `mri` | Colour, functional level, function, cortex opacity, MRI window |
| `hemi`, `cortex`, `internal`, `cord`, `system` | What is drawn |
| `cut`, `pos`, `tilt`, `az`, `rev` | The cutting plane and its position |
| `region`, `isolate`, `hidden` | Selection, isolation, dissection |
| `view`, `cam` | The preset, or the exact camera once moved |
| `tab`, `deficit`, `circuit`, `step` | Panel tab, deficit, circuit and landmark |
| `lang` | Language |

A link is applied field by field. A field the subject cannot apply is left out and named in a notice under the tabs. Notices say what changed or failed, stay until your next action, and offer **Reload** when a newer NeuroAtlas has been published.

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
