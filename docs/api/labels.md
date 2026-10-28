# Label modules

The volumetric label grids sampled on cut faces.

## `brain_model.labels.volumes`

Native-grid MRI and segmentation volumes, cropped to their labels with the crop's affine.

```{eval-rst}
.. automodule:: brain_model.labels.volumes
   :members:
```

## `brain_model.labels.tissue_labels`

Published volumetric anatomy, with the HCP projection restricted to the cortical ribbon.

```{eval-rst}
.. automodule:: brain_model.labels.tissue_labels
   :members:
```

## `brain_model.labels.white_matter`

Gyral white matter: voxels within 5 mm of cortex take the nearest Desikan gyrus. Cut faces only.

```{eval-rst}
.. automodule:: brain_model.labels.white_matter
   :members:
```

## `brain_model.labels.nextbrain`

One brain's NextBrain labels on a 0.4 mm grid in its surface RAS, placed through `orig.mgz`.

```{eval-rst}
.. automodule:: brain_model.labels.nextbrain
   :members:
```

## `brain_model.labels.boundary_certainty`

How often NextBrain nearly tied each pair of touching labels, from the near-tie volume beside a subject segmentation.

```{eval-rst}
.. automodule:: brain_model.labels.boundary_certainty
   :members:
```
