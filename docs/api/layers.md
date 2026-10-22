# Layer modules

The derived layers. These are not parcellations of the cortex: the Yeo networks carried as a surface attribute, the CAB-NP network of each HCP-MMP area, the functional divisions of HCP-MMP areas, the learning overview, the reference spinal cord, and the atlas comparison.

## `brain_model.layers.networks`

The Yeo 7 resting-state networks, carried as a per-vertex surface layer rather than as an atlas. The index is part of the published contract, and 0 means no network.

```{eval-rst}
.. automodule:: brain_model.layers.networks
   :members:
```

## `brain_model.layers.cab_np`

The Cole-Anticevic network partition, one network per HCP-MMP1.0 area. Its assignments are published in their own file beside the licence and the original label key.

```{eval-rst}
.. automodule:: brain_model.layers.cab_np
   :members:
```

## `brain_model.layers.neuropsych_domains`

Each HCP-MMP1.0 area's neuropsychological domains: those whose Neurosynth consistency z, averaged over the area on `fsaverage`, reaches the threshold in `config/neuropsych-domains.yaml`, with the lesion check of each domain. Published per area in `neuropsych-domains.json`.

```{eval-rst}
.. automodule:: brain_model.layers.neuropsych_domains
   :members:
```

## `brain_model.layers.functional_regions`

Published groupings of HCP-MMP1.0 areas at two levels: Glasser's 22 sections and the named regions Glasser and Rolls define, transcribed in `config/functional-regions.yaml` and published per area in `functional-regions.json`.

```{eval-rst}
.. automodule:: brain_model.layers.functional_regions
   :members:
```

## `brain_model.layers.learning`

Traceable anatomical unions, with bounded and illustrative display surfaces. Each unit is an explicit union of source labels, defined in `config/learning-anatomy.yaml`.

```{eval-rst}
.. automodule:: brain_model.layers.learning
   :members:
```

## `brain_model.layers.spinal_cord`

The Z-Anatomy reference cord, placed illustratively by a rigid translation below the brainstem. Its shape is not deformed.

```{eval-rst}
.. automodule:: brain_model.layers.spinal_cord
   :members:
```

## `brain_model.layers.comparison`

Area-conserving atlas intersections on the original pial tessellation. Every shared area is accumulated per pair of regions, and the unassigned remainder is kept. It is run on its own with `--anatomy`, as described in [Comparing cortical atlases](../guides/atlas-comparison.md#publishing-comparison-assets).

```{eval-rst}
.. automodule:: brain_model.layers.comparison
   :members:
```
