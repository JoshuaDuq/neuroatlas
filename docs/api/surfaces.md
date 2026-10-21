# Surface modules

Cortical geometry, the transfer of labels between registered spheres, the closed envelopes that drive solid cuts, the ribbon labels, and the shading fields.

## `brain_model.surfaces.geometry`

Coordinate conversions, marching-cubes extraction, the bounded display smoothing, and the misclassification check for solids.

```{eval-rst}
.. automodule:: brain_model.surfaces.geometry
   :members:
```

## `brain_model.surfaces.registration`

Categorical atlas transfer between brains, through the registered spheres (`sphere.reg`). Labels are resampled by nearest vertex and are never interpolated.

```{eval-rst}
.. automodule:: brain_model.surfaces.registration
   :members:
```

## `brain_model.surfaces.solids`

The closed native pial and white envelopes that drive the GPU stencil cuts. Vertices and triangles are the native ones.

```{eval-rst}
.. automodule:: brain_model.surfaces.solids
   :members:
```

## `brain_model.surfaces.ribbons`

Per-vertex parcel labels that close the cortical ribbon into solid wedges, and the owner of each triangle when a parcel boundary crosses it.

```{eval-rst}
.. automodule:: brain_model.surfaces.ribbons
   :members:
```

## `brain_model.surfaces.shading`

Cortical shading fields derived from source morphometry, such as sulcal depth and concavity. Positions never change.

```{eval-rst}
.. automodule:: brain_model.surfaces.shading
   :members:
```
