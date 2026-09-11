"""Categorical atlas transfer between brains, through registered spheres."""

import numpy as np
from scipy.spatial import cKDTree


def resample_surface_labels(source_sphere, target_sphere, labels):
    """Give every target vertex the label of its nearest source vertex.

    Both surfaces are FreeSurfer `sphere.reg`, so proximity here is proximity in
    the registration's own space, not in either brain's anatomy. This is
    `mri_surf2surf`'s forward nearest-neighbour rule, and it is the only rule
    that leaves the labels categorical: an average of two area ids is not an
    area. The result is an atlas projected onto this subject, never a
    parcellation measured on it.

    No coordinate is read back out, so neither brain's geometry is touched.
    """
    for sphere in (source_sphere, target_sphere):
        if (
            sphere.ndim != 2
            or sphere.shape[1] != 3
            or len(sphere) == 0
            or not np.isfinite(sphere).all()
        ):
            raise ValueError("Registered spheres require finite (n, 3) vertices")
    if labels.shape != (len(source_sphere),) or labels.dtype.kind not in "iu":
        raise ValueError("One integer label is required per source vertex")
    nearest = cKDTree(source_sphere).query(target_sphere)[1]
    return labels[nearest]
