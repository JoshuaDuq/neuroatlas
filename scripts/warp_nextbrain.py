"""Warp the published NextBrain atlas into the subject grid, once.

This is the one step the package build cannot reproduce: it needs ANTs and runs
for tens of minutes. Run it once, let `--record` register the checksummed result
in `data/sources.json`, and every later build verifies that artefact like any
downloaded input.

    pip install antspyx
    python scripts/warp_nextbrain.py \
        --atlas nextbrain_wholebrain_MNI152_1mm.nii.gz \
        --lut nextbrain_wholebrain_MNI152_1mm_lut.txt \
        --template tpl-MNI152NLin6Asym_res-01_T1w.nii.gz \
        --record

Inputs:

  --atlas, --lut  https://github.com/compneurobilbao/nextbrain-mni-atlas
                  (Casamitjana et al., Nature 2025)
  --template      The MNI152 T1 the atlas was segmented on: FSL's
                  MNI152_T1_1mm.nii.gz, redistributed openly by TemplateFlow as
                  tpl-MNI152NLin6Asym_res-01_T1w.nii.gz.

The template is registered and the label volume merely resampled, so no label
value is ever interpolated. What bounds the achievable accuracy is the other
side of the pair: an averaged template is registered onto one individual's
brain, so the nuclei land where that inter-subject warp puts them, not where a
histological delineation of this subject would.
"""

import argparse
import json
import shutil
import sys
from pathlib import Path

import nibabel as nib
import numpy as np
from nibabel.affines import apply_affine

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from brain_model import nextbrain
from brain_model.sources import ROOT, read_config, sha256

SOURCE_URL = "https://github.com/compneurobilbao/nextbrain-mni-atlas"
TEMPLATE_URL = "https://templateflow.s3.amazonaws.com/tpl-MNI152NLin6Asym"
CITATION = "https://doi.org/10.1038/s41586-025-09708-2"
def procedure(config):
    """Name the brain that was registered to, not just the script that did it."""
    return (
        "scripts/warp_nextbrain.py: ANTs SyN registration of the MNI152NLin6Asym T1 "
        f"to {config['anatomy']['id']} orig.mgz, then genericLabel resampling of "
        "the label volume"
    )

VERIFY_SAMPLES = 2000


def require_ants():
    try:
        import ants
    except ImportError:
        raise SystemExit(
            "This script needs ANTs via ANTsPy, which the package build does not "
            "depend on. Install it with `pip install antspyx` and run this again."
        ) from None
    return ants


def align_voxel_order(image, grid):
    """Reorder `image`'s voxels onto `grid`, when the two differ only by flips.

    Templates are redistributed in varying voxel order: TemplateFlow stores
    MNI152NLin6Asym stepping +x where FSL and the published atlas step −x. Those
    describe identical world space, so matching them is an exact mirror rather
    than a resample — and proving that is what keeps a silent left-right flip
    from ever reaching the atlas.
    """
    if image.shape != grid.shape:
        raise SystemExit(f"Cannot align grids of different shape: {image.shape} vs {grid.shape}")
    picks = []
    for axis in range(3):
        column, target = image.affine[:3, axis], grid.affine[:3, axis]
        if np.allclose(column, target, atol=1e-6):
            picks.append(slice(None))
        elif np.allclose(column, -target, atol=1e-6):
            picks.append(slice(None, None, -1))
        else:
            raise SystemExit(f"Grids differ by more than an axis flip on axis {axis}.")

    # Every relocated voxel must keep the world point it already had.
    rng = np.random.default_rng(0)
    index = rng.integers([0, 0, 0], grid.shape, size=(VERIFY_SAMPLES, 3))
    last = np.array(grid.shape) - 1
    source = np.column_stack([
        last[axis] - index[:, axis] if picks[axis].step == -1 else index[:, axis]
        for axis in range(3)
    ])
    error = np.abs(
        apply_affine(image.affine, source) - apply_affine(grid.affine, index)
    ).max()
    if error > 1e-6:
        raise SystemExit(f"Voxel reordering moved anatomy by {error} mm; refusing to continue.")

    data = np.ascontiguousarray(np.asarray(image.dataobj)[tuple(picks)])
    return nib.Nifti1Image(data, grid.affine, dtype=image.get_data_dtype())


def as_nifti(image, path):
    """Write a NIfTI on the same voxel grid, which is what ANTsPy consumes."""
    nib.save(nib.Nifti1Image(np.asarray(image.dataobj), image.affine), path)
    return path


# ANTsPy's stock "SyN" schedule ends in a level with zero iterations, so the
# finest resolution is never actually optimised. That is far too coarse for
# millimetre nuclei, which are the only reason this atlas is worth warping.
# Four levels make ANTsPy derive shrink factors 8x4x2x1, so the last 20
# iterations run at full resolution. SyNRA's own rigid and affine schedules are
# hardcoded inside ANTsPy and cannot be set from here; only this stage is ours.
REGISTRATION_LEVELS = (100, 70, 50, 20)


def warp_labels(ants, template, atlas, fixed, work):
    """Register the template, then carry the labels along that transform."""
    target = ants.image_read(str(fixed))
    result = ants.registration(
        fixed=target,
        moving=ants.image_read(str(template)),
        type_of_transform="SyNRA",
        random_seed=0,
        reg_iterations=REGISTRATION_LEVELS,
        outprefix=str(work / "mni152-to-subject-"),
        verbose=True,
    )
    warped = ants.apply_transforms(
        fixed=target,
        moving=ants.image_read(str(atlas)),
        transformlist=result["fwdtransforms"],
        interpolator="genericLabel",
    )
    path = work / "nextbrain-warped.nii.gz"
    ants.image_write(warped, str(path))
    return path


def write_on_grid(warped, reference, destination):
    """Rewrap the warped labels with subject's grid and a label-safe dtype.

    Registration preserved the voxel grid, so this restores the FreeSurfer
    header that `get_vox2ras_tkr` reads rather than converting any coordinate.
    The datatype must be set deliberately: `reference` is an intensity volume
    stored as uint8, and inheriting that silently wraps every label id above
    255 into a different structure. The written file is read back and compared
    so no such truncation can pass quietly again.
    """
    labels = np.asarray(nib.load(warped).dataobj)
    if labels.shape != reference.shape:
        raise SystemExit(f"Warped labels are {labels.shape}, expected {reference.shape}.")
    if not np.all(labels == np.rint(labels)):
        raise SystemExit("Warped labels are not integral: resampling was not genericLabel.")
    labels = labels.astype(np.int32)
    header = reference.header.copy()
    header.set_data_dtype(np.int32)
    destination.parent.mkdir(parents=True, exist_ok=True)
    nib.save(nib.MGHImage(labels, reference.affine, header=header), destination)

    written = np.asarray(nib.load(destination).dataobj).astype(np.int32)
    if not np.array_equal(written, labels):
        raise SystemExit(f"Writing {destination.name} did not preserve every label id.")


def record_sources(config, entries):
    """Register the derived artefacts, replacing any entry for the same path."""
    manifest = ROOT / "data/sources.json"
    provenance = json.loads(manifest.read_text())
    for path, derived_from in entries:
        relative = str(path.relative_to(ROOT))
        provenance["sources"] = [
            source for source in provenance["sources"] if source["path"] != relative
        ] + [{
            "path": relative,
            "sha256": sha256(path),
            "anatomy": config["anatomy"]["id"],
            "optional": True,
            "derived_from": derived_from,
            "procedure": procedure(config),
            "citation": CITATION,
        }]
        print(f"recorded {relative}")
    manifest.write_text(json.dumps(provenance, indent=2) + "\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--atlas", type=Path, required=True, help="NextBrain MNI152 label volume")
    parser.add_argument("--lut", type=Path, required=True, help="NextBrain label table")
    parser.add_argument("--template", type=Path, required=True, help="MNI152 T1 the atlas was segmented on")
    parser.add_argument("--work", type=Path, default=ROOT / "data/cache/nextbrain")
    parser.add_argument("--anatomy", help="warp onto this declared anatomy instead of the selected one")
    parser.add_argument("--record", action="store_true", help="add the results to data/sources.json")
    args = parser.parse_args()

    ants = require_ants()
    config = read_config(args.anatomy)
    volume_path, lut_path = nextbrain.paths(config)
    args.work.mkdir(parents=True, exist_ok=True)

    atlas = nib.load(args.atlas)
    template = as_nifti(
        align_voxel_order(nib.load(args.template), atlas),
        args.work / "template-on-atlas-grid.nii.gz",
    )
    reference = nib.load(config["source_directory"] / "mri/orig.mgz")
    fixed = as_nifti(reference, args.work / "subject-orig.nii.gz")

    warped = warp_labels(ants, template, args.atlas, fixed, args.work)
    write_on_grid(warped, reference, volume_path)
    lut_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(args.lut, lut_path)

    # Read it back through the build's own loader: grid registration, integrality
    # and LUT coverage are all asserted there, so a bad warp fails now, not later.
    regions = nextbrain.build_regions(config)
    kept = sum(region["voxel_count"] for region in regions)
    print(f"\n{volume_path.relative_to(ROOT)}: {len(regions)} regions, {kept:,} labelled voxels")

    if args.record:
        record_sources(config, [(volume_path, SOURCE_URL), (lut_path, SOURCE_URL)])
    else:
        print("Re-run with --record to register these files in data/sources.json.")


if __name__ == "__main__":
    main()
