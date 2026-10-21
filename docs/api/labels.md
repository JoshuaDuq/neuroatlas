# Label modules

The volumetric label grids the viewer samples on the GPU, the tissue labels, the gyral white matter, and the NextBrain labels.

## `brain_model.labels.volumes`

Lossless native-grid MRI and segmentation assets for the registered sections. It crops each label grid to its non-zero voxels, carries the crop's affine, and writes the gzip binary. The crop rule is in [Architecture](../concepts/architecture.md#label-grids-are-cropped-to-their-labels).

```{eval-rst}
.. automodule:: brain_model.labels.volumes
   :members:
```

## `brain_model.labels.tissue_labels`

Published volumetric anatomy, and the HCP projection restricted to the cortical ribbon.

```{eval-rst}
.. automodule:: brain_model.labels.tissue_labels
   :members:
```

## `brain_model.labels.white_matter`

FreeSurfer's gyral white-matter parcellation. Each white-matter voxel within 5 mm of the cortex takes the nearest Desikan gyrus. These parcels are published as cut-only regions.

```{eval-rst}
.. automodule:: brain_model.labels.white_matter
   :members:
```

## `brain_model.labels.nextbrain`

The NextBrain histological labels for one brain, on their own 0.4 mm grid in that brain's surface RAS. It joins the two hemispheres and places the volume through `orig.mgz`'s scanner-to-surface transform.

```{eval-rst}
.. automodule:: brain_model.labels.nextbrain
   :members:
```
