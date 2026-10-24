"""FastSurfer CerebNet's cerebellar lobules, on the subject's conformed grid."""

import nibabel as nib
import numpy as np

from ..sources import declares
from .volumes import conformed_grid, load_on_grid

ATLAS_ID = "cerebnet"
SOURCE = "mri/cerebellum.CerebNet.mgz"
CITATION = "https://doi.org/10.1016/j.neuroimage.2022.119703"

# FastSurfer writes CerebNet's lobules with the Cbm_* IDs of its own
# FastSurferCNN/config/FreeSurferColorLUT.txt (630 and 631 are newer than this
# repository's FreeSurfer table), and the corpus medullare as aseg's cerebellar
# white matter.
LOBULES = frozenset([*range(601, 609), *range(610, 612), *range(613, 615), *range(616, 618),
                     *range(619, 621), *range(622, 629), 630, 631])
WHITE_MATTER = frozenset({7, 46})


def path(config):
    return config["source_directory"] / SOURCE


def is_declared(config):
    return declares(config, "cerebellar_lobules")


def load(config):
    grid = conformed_grid(load_on_grid(config, path(config)))
    unknown = set(np.unique(grid.labels).tolist()) - LOBULES - WHITE_MATTER - {0}
    if unknown:
        raise ValueError(f"{SOURCE} holds labels CerebNet does not publish: {sorted(unknown)}")
    return grid


def save(labels, reference, destination):
    """Write labels with a conformed volume's header, so it shares aseg's grid."""
    header = reference.header.copy()
    # orig.mgz stores bytes; its header would clip the 600s IDs.
    header.set_data_dtype(np.int16)
    nib.save(nib.MGHImage(labels.astype(np.int16), reference.affine, header=header), destination)
    if not np.array_equal(np.asarray(nib.load(destination).dataobj), labels):
        raise ValueError(f"Writing {destination.name} did not preserve every label")
