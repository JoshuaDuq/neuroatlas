# Using the viewer

The viewer loads one anatomy at a time. Its window has three parts, each with one job: the masthead says what is loaded, the panel is where you study it, and the stage is where you frame and cut the picture. Tracts, guided circuits and atlas comparison have their own guides, linked below.

## Window layout

```
+-----------------------------------------------------------------------------+
| NeuroAtlas │ Subject │ Atlas │ Colour │ Internal anatomy    Fullscreen PNG ⋯ |
+----------------------------+------------------------------------------------+
| Anatomy Deficits Circuits  |                                                |
| Tracts                     |           3D scene: orbit, zoom, pick          |
|                            |                                                |
| List, or a region/deficit/ |  [Oblique Left Right Anterior Posterior …]     |
| circuit in detail          |  [Section ▾] [Display ▾]                       |
+----------------------------+------------------------------------------------+
| not clinical anatomy · region count · Provenance                            |
+-----------------------------------------------------------------------------+
```

- **Masthead: what is loaded.** **Subject**, cortical **Atlas** (Destrieux or HCP-MMP), **Colour** (Tissue, T1, Regions, Yeo 7, CAB-NP, Functional) and the **Internal anatomy** detail level sit beside the name. Fullscreen, PNG capture and **More settings** (language, theme, single-key shortcuts, keyboard shortcuts) sit at the right. Below 1280 px and on phones they collapse into one summary button, such as "bert · Destrieux · Regions · Teaching set", that opens the same controls with a one-line note on each choice.
- **Panel: what you are studying.** The tabs are **Anatomy**, **Deficits**, **Circuits** and **Tracts**. Search or browse a list. Selecting a region, opening a deficit or starting a circuit shows its details in the same panel, under a **‹ Anatomy › Frontal** path (or **‹ Deficits**, **‹ Circuits**). The mode returns to the list where you left it, and the group returns to the list with that region's row open and in view. While you browse, the selection strip at the top of the list leads back to the details. Inside the details, Escape also returns to the list. Hover a row to reveal its eye controls. A hidden part keeps its eye visible, and the dissection line at the foot of **Anatomy** undoes or restores.
- **Stage: how the picture is framed and cut.** One dock under the anatomy holds the anatomical views (Oblique, Left, Right, Anterior, Posterior, Superior, Inferior; under **View ▾** where they do not fit inline), **Section** (cutting plane and cut labels) and **Display** (hemisphere, cortex and its opacity, internal anatomy, spinal cord, **Reset view**). While a plane is cut, the dock's upper row holds its position, oblique angles, **Reverse side** and **Linked MRI** (behind a disclosure on a narrow stage). Its × returns to the full brain. The PNG action saves the visible stage with its orientation letters, scale bar, colour key, a caption naming the subject, atlas, colouring and view or section, and the not-clinical statement.

On phones the panel becomes a draggable sheet with peek, half and full positions and the same four tabs; the stage toolbar stays above it. In short landscape the sheet sits beside the anatomy.

## Colour modes

- **Regions** shows distinct categorical region colours from the active parcellation palette, with soft specular highlights and sulcal relief.
- **Tissue** shows natural grey and white matter colouring, with trilinearly sampled T1 MRI relief shading across cut faces.
- **T1** shows the specimen's registered T1 MRI in greyscale, with region highlighting.
- **Yeo 7** shows the published Yeo 7 functional-network colouring. Its key appears on the stage.
- **CAB-NP** colours each HCP-MMP area by the one of 12 networks that CAB-NP (Ji et al. 2019) assigns it. Choosing it shows the HCP-MMP atlas, and its key appears on the stage.
- **Functional** draws published functional divisions as solid pieces of cortex inside a glass brain. Its key on the stage switches between **Named** regions (Glasser 2016, Rolls 2023) and Glasser's 22 **Sections**. Choosing it shows the HCP-MMP atlas and hides the internal anatomy, which Display brings back. Cortex opacity scales the glass and the divisions together. Selecting an area names its section and, where a source defines one, its named region.

## Anatomical sections

Use the stage **Section** tool.

- **Planes**: full brain, sagittal, coronal, axial, or an arbitrary oblique plane. A sagittal offset of 0 mm is midsagittal.
- **Offsets**: a slider and a numerical input move the plane in native surface RAS millimetres ($+A$ anterior, $+S$ superior, $+R$ right).
- **Oblique angles**: tilt from axial, and azimuth around the superior axes.

Each closed solid is capped with the polygon where the plane meets it, so the cut face stays on the reconstruction. [Architecture](../concepts/architecture.md#cut-caps) describes how the caps are drawn.

## Linked MRI reference

**Linked MRI** (from region details, the section bar, or **M**) opens three orthogonal T1 sections.

- The shared 3D crosshair synchronises with the slice planes.
- Window and centre contrast controls, voxel-exact label inspection, and PNG snapshot export are included.
- Coordinates read as a signed RAS triple in millimetres, the same in the panel and in the MRI readout.

MRI reference slices always show the original scan. Dissection and cut labels do not change them.

## Selective dissection

Use the eye controls in the anatomy list to hide a region or a whole group. Group controls marked **L** and **R** act on each side separately. The **Hide** action in anatomical details removes the selected region.

Hiding cortical parcels exposes the subject's native white-matter surface beneath them. That tissue stays in place and blocks selection of deeper structures behind it. Hemisphere, cortex transparency and plane cuts apply to the exposed tissue too. Restoring the cortex closes the exposure.

- **Undo** reverses one dissection action.
- **Restore all** brings back every explicitly removed part, keeping the current hemisphere, appearance and cut settings.
- Hidden entries stay searchable. Select one to reveal it, or use its eye control to restore only its dissection visibility.

Dissection also applies to 3D cut faces, including sampled white-matter parcels. Hidden region identifiers travel in the URL. Undo history lasts for the current visit. Switching anatomical subjects clears the dissection, because the parcels differ between subjects.

## Keyboard navigation

Every part of the viewer is reachable without a pointer, including the model. Press <kbd>?</kbd> in the app for the live list.

| Keys | Action |
| :--- | :--- |
| <kbd>/</kbd> | Focus the search field (in Circuits, focus the tour list) |
| <kbd>↑</kbd> <kbd>↓</kbd> | Move through results or the region tree |
| <kbd>Enter</kbd> | Select the focused region |
| <kbd>Tab</kbd> | Move focus to the model |
| <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> | Turn the model, once it holds focus |
| <kbd>+</kbd> <kbd>−</kbd> | Zoom the model in or out |
| <kbd>1</kbd>–<kbd>6</kbd> | Left, right, anterior, posterior, superior, inferior view |
| <kbd>0</kbd> | Return to the oblique view |
| <kbd>F</kbd> / <kbd>I</kbd> | Focus / isolate the selected region |
| <kbd>C</kbd> / <kbd>U</kbd> | Show or hide the cortex / the internal anatomy |
| <kbd>S</kbd> | Show or hide the spinal cord |
| <kbd>H</kbd> | Cycle hemisphere: both, left, right |
| <kbd>M</kbd> | Open or close the linked MRI slices (with tracts loaded, the MRI with tracts) |

The arrow keys turn the model the way dragging turns it. The anatomy follows the arrow, so the pointer and the keyboard share one mental model. Rotation is clamped short of the poles so the horizon cannot flip, and zoom obeys the same near and far limits as the scroll wheel.

## Related guides

- [Diffusion and tracts](tracts.md) covers the **Tracts** tab and the MRI with tracts view.
- [Atlas comparison](atlas-comparison.md) covers the **Compare atlases** table on SNAIL.
- [Guided circuits](circuits.md) covers the **Circuits** tab.
- [Embedding](embedding.md) covers the headless JavaScript API.
