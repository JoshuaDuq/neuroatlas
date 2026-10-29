# Layer modules

Derived layers that are not cortical parcellations.

## Networks

`brain_model.layers.networks`: Yeo 7 networks as a per-vertex attribute; 0 means none.

```{eval-rst}
.. automodule:: brain_model.layers.networks
   :members:
```

## CAB-NP

`brain_model.layers.cab_np`: One CAB-NP network per HCP-MMP area, published beside its licence and label key.

```{eval-rst}
.. automodule:: brain_model.layers.cab_np
   :members:
```

## Neuropsychological domains

`brain_model.layers.neuropsych_domains`: Each HCP-MMP area's and aseg structure's Neurosynth functions at the threshold in `config/neuropsych-domains.yaml`, with each function's lesion check.

```{eval-rst}
.. automodule:: brain_model.layers.neuropsych_domains
   :members:
```

## Functional regions

`brain_model.layers.functional_regions`: Glasser's 22 sections and the named regions of Glasser and Rolls, from `config/functional-regions.yaml`.

```{eval-rst}
.. automodule:: brain_model.layers.functional_regions
   :members:
```

## Teaching set

`brain_model.layers.learning`: Teaching-set units as explicit unions of source labels, with bounded display surfaces.

```{eval-rst}
.. automodule:: brain_model.layers.learning
   :members:
```

## Spinal cord

`brain_model.layers.spinal_cord`: This brain's cervical cord: SCT's segmentation, with PAM50's tracts and grey matter registered to it.

```{eval-rst}
.. automodule:: brain_model.layers.spinal_cord
   :members:
```

## Atlas comparison

`brain_model.layers.comparison`: Area-conserving intersections between each pair of configured cortical atlases on the pial tessellation. Runs alone with `--anatomy`.

```{eval-rst}
.. automodule:: brain_model.layers.comparison
   :members:
```

## Arterial territories

`brain_model.layers.arterial_territories`: The Liu et al. (2023) arterial territory atlas, registered from its template: its regions, cut labels, per-vertex territories, region shares and checks.

```{eval-rst}
.. automodule:: brain_model.layers.arterial_territories
   :members:
```

## Cerebellar functions

`brain_model.layers.cerebellar_functions`: The Nettekoven et al. (2024) functional cerebellar atlas, registered from the SUIT template and kept to the cerebellar cortex: its regions, cut labels, lobule shares and checks.

```{eval-rst}
.. automodule:: brain_model.layers.cerebellar_functions
   :members:
```
