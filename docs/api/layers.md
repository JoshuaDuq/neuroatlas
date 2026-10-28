# Layer modules

Derived layers that are not cortical parcellations.

## `brain_model.layers.networks`

Yeo 7 networks as a per-vertex attribute; 0 means none.

```{eval-rst}
.. automodule:: brain_model.layers.networks
   :members:
```

## `brain_model.layers.cab_np`

One CAB-NP network per HCP-MMP area, published beside its licence and label key.

```{eval-rst}
.. automodule:: brain_model.layers.cab_np
   :members:
```

## `brain_model.layers.neuropsych_domains`

Each HCP-MMP area's and aseg structure's Neurosynth functions at the threshold in `config/neuropsych-domains.yaml`, with each function's lesion check.

```{eval-rst}
.. automodule:: brain_model.layers.neuropsych_domains
   :members:
```

## `brain_model.layers.functional_regions`

Glasser's 22 sections and the named regions of Glasser and Rolls, from `config/functional-regions.yaml`.

```{eval-rst}
.. automodule:: brain_model.layers.functional_regions
   :members:
```

## `brain_model.layers.learning`

Teaching-set units as explicit unions of source labels, with bounded display surfaces.

```{eval-rst}
.. automodule:: brain_model.layers.learning
   :members:
```

## `brain_model.layers.spinal_cord`

This brain's cervical cord: SCT's segmentation, with PAM50's tracts and grey matter registered to it.

```{eval-rst}
.. automodule:: brain_model.layers.spinal_cord
   :members:
```

## `brain_model.layers.comparison`

Area-conserving Destrieux × HCP-MMP intersections on the pial tessellation. Runs alone with `--anatomy`.

```{eval-rst}
.. automodule:: brain_model.layers.comparison
   :members:
```
