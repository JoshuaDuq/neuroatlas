"""Register each MNI template a published coordinate may be given in onto an anatomy.

Templates come from TemplateFlow, and SPM12's tissue probability maps from SPM's
repository, pinned by checksum. SynthMorph (FreeSurfer 8.2) registers each
skull-stripped template to the anatomy's brain.mgz, joint affine and deformable.
SynthSeg reads the template's own anatomy, which the warp carries onto aseg's grid
to be scored against this brain's segmentation. A published space writes its
template → surface RAS field on a coarse grid; an alternative is only measured,
to show where its reading of the same numbers lands beside each published one.
SynthMorph runs on the CPU here; its output is recorded by checksum rather than
expected to reproduce bit for bit.
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

import nibabel as nib
import nibabel.processing
import numpy as np
from nibabel.freesurfer.io import read_annot, read_geometry
from scipy import ndimage
from scipy.spatial import cKDTree

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from brain_model.layers import coordinate_spaces
from brain_model.sources import ROOT, read_config, sha256

CACHE = ROOT / "data/cache/coordinate-spaces"
# SPM12's tissue classes as a T1-like image SynthMorph and SynthSeg can read: grey, white, fluid.
TISSUE_CONTRAST = (0.55, 1.0, 0.15)
SCHAEFER = "Schaefer2018_400Parcels_7Networks_order"
SEED = 0
GRID_ERROR_SAMPLES = 20_000
OVERLAP_SAMPLES = 2_000


def fetch(space, kind):
    remote, digest = space["source"]["files"][kind]
    path = CACHE / space["id"] / Path(remote).name
    url = f"{space['source']['base']}/{remote}"
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        print(f"downloading {url}", flush=True)
        partial = path.with_name(path.name + ".part")
        urllib.request.urlretrieve(url, partial)
        partial.rename(path)
    if sha256(path) != digest:
        raise SystemExit(f"{path.name} checksum mismatch")
    return path, {"url": url, "sha256": digest}


class Field:
    """A SynthMorph displacement field: a world point on its grid → that point plus its displacement (mm)."""

    def __init__(self, path):
        image = nib.load(path)
        self.data = np.asarray(image.dataobj, dtype=np.float64).reshape(*image.shape[:3], 3)
        self.inverse = np.linalg.inv(image.affine)

    def __call__(self, points):
        voxels = nib.affines.apply_affine(self.inverse, points).T
        moved = [ndimage.map_coordinates(self.data[..., k], voxels, order=1, mode="nearest") for k in range(3)]
        return points + np.stack(moved, axis=1)


def freesurfer(home, command, *arguments, cwd=None):
    env = {**os.environ, "FREESURFER_HOME": str(home)}
    script = f'source "$FREESURFER_HOME/SetUpFreeSurfer.sh" > /dev/null && exec {command} "$@"'
    print(command, " ".join(map(str, arguments)), flush=True)
    subprocess.run(["bash", "-c", script, command, *map(str, arguments)], env=env, cwd=cwd, check=True)


def template_images(space, work):
    """The template as SynthSeg reads it, and skull-stripped as SynthMorph registers it."""
    files = {kind: fetch(space, kind) for kind in space["source"]["files"]}
    if "t1" in files:
        t1 = nib.load(files["t1"][0])
        mask = nib.load(files["mask"][0])
        if mask.shape != t1.shape or not np.allclose(mask.affine, t1.affine):
            raise SystemExit(f"{space['id']}: the brain mask is not on the template's grid")
        brain = np.asarray(mask.dataobj) > 0
        image = t1.get_fdata(dtype=np.float32)
    else:
        tpm = nib.load(files["tissue_probability_maps"][0])
        classes = tpm.get_fdata(dtype=np.float32)
        image = sum(weight * classes[..., k] for k, weight in enumerate(TISSUE_CONTRAST))
        brain = classes[..., :3].sum(axis=3) > 0.5
        t1 = nib.Nifti1Image(image, tpm.affine)
        mask = nib.Nifti1Image(brain.astype(np.uint8), tpm.affine)
    readable, moving = work / "template.nii.gz", work / "moving.nii.gz"
    nib.save(nib.Nifti1Image(image, t1.affine), readable)
    nib.save(nib.Nifti1Image(np.where(brain, image, 0).astype(np.float32), t1.affine), moving)
    return readable, moving, mask, [origin for _, origin in files.values()]


def register(home, threads, space, fixed, aseg, work):
    """Register the template, carry SynthSeg's reading of it onto aseg's grid, and score both."""
    readable, moving, mask, origins = template_images(space, work)
    freesurfer(home, "mri_synthmorph", "register", "-m", "joint", "-j", threads,
               "-t", work / "fwd.nii.gz", "-T", work / "inv.nii.gz", moving, fixed)
    freesurfer(home, "mri_synthseg", "--i", readable, "--o", work / "synthseg.nii.gz",
               "--parc", "--robust", "--threads", threads)
    template = nib.load(readable)
    seg = nibabel.processing.resample_from_to(nib.load(work / "synthseg.nii.gz"), template, order=0)
    nib.save(nib.Nifti1Image(np.asarray(seg.dataobj).astype(np.int16), template.affine), work / "seg.nii.gz")
    freesurfer(home, "mri_synthmorph", "apply", "-m", "nearest", work / "fwd.nii.gz", work / "seg.nii.gz",
               work / "carried.nii.gz")
    carried = nib.load(work / "carried.nii.gz")
    # SynthMorph resamples onto the fixed image's grid; anything else would scramble the labels.
    if carried.shape[:3] != aseg.shape or not np.allclose(carried.affine, aseg.affine, atol=1e-3):
        raise SystemExit(f"SynthMorph's output is not on aseg's grid: {carried.shape}, {carried.affine}")
    brain_points = nib.affines.apply_affine(mask.affine, np.argwhere(np.asarray(mask.dataobj) > 0))
    fwd, inv = Field(work / "fwd.nii.gz"), Field(work / "inv.nii.gz")
    round_trip = np.linalg.norm(fwd(inv(brain_points)) - brain_points, axis=1)
    measured = coordinate_spaces.checks(
        np.rint(carried.get_fdata()).astype(np.int32).reshape(aseg.shape),
        np.asarray(aseg.dataobj).astype(np.int32), round_trip)
    return inv, mask, measured, origins, np.asarray(seg.dataobj).astype(np.int32), template.affine


def write_field(config, definition, space, inv, mask, scanner_to_surface):
    """The template → surface RAS field on the definition's grid, and its error against the full field."""
    node_to_template, shape, valid = coordinate_spaces.grid_nodes(
        mask, definition["grid_spacing_mm"], definition["mask_margin_mm"])
    nodes = nib.affines.apply_affine(node_to_template, np.indices(shape).reshape(3, -1).T)
    target = nib.affines.apply_affine(scanner_to_surface, inv(nodes))
    field = coordinate_spaces.encode_field((target - nodes).reshape(*shape, 3), valid)
    path = coordinate_spaces.field_path(config, space)
    path.parent.mkdir(parents=True, exist_ok=True)
    nib.save(nib.Nifti1Image(field, node_to_template), path)
    # Points anywhere in the template's brain, not only at voxel centres.
    rng = np.random.default_rng(SEED)
    voxels = np.argwhere(np.asarray(mask.dataobj) > 0)
    voxels = voxels[rng.choice(len(voxels), GRID_ERROR_SAMPLES, replace=False)] + rng.uniform(-0.5, 0.5, (GRID_ERROR_SAMPLES, 3))
    points = nib.affines.apply_affine(mask.affine, voxels)
    full = nib.affines.apply_affine(scanner_to_surface, inv(points))
    error = np.linalg.norm(coordinate_spaces.map_points(field, node_to_template, points) - full, axis=1)
    if np.isnan(error).any():
        raise SystemExit(f"{space['id']}: the grid leaves {np.isnan(error).sum()} brain points unmapped")
    return path, {"median": round(float(np.median(error)), 4), "p95": round(float(np.percentile(error, 95)), 4),
                  "max": round(float(error.max()), 4)}


def schaefer_on_grid(config, aseg):
    """This brain's Schaefer parcel at each ribbon voxel, as the viewer's cut shows it (nearest pial/white vertex)."""
    source = config["source_directory"]
    ribbon = np.asarray(nib.load(source / "mri/ribbon.mgz").dataobj)
    tkr = aseg.header.get_vox2ras_tkr()
    labels = np.zeros(aseg.shape, np.int32)
    for prefix, ribbon_label, first in (("lh", 3, 0), ("rh", 42, 200)):
        annotation, _, names = read_annot(source / f"label/{prefix}.{SCHAEFER}.annot")
        lookup = np.array([0, *range(first + 1, first + len(names))])
        voxels = np.argwhere(ribbon == ribbon_label)
        pial, _ = read_geometry(source / f"surf/{prefix}.pial")
        white, _ = read_geometry(source / f"surf/{prefix}.white")
        nearest = cKDTree(np.vstack([pial, white])).query(nib.affines.apply_affine(tkr, voxels))[1] % len(pial)
        vertex_labels = annotation[nearest]
        labels[tuple(voxels.T)] = np.where(vertex_labels >= 0, lookup[np.clip(vertex_labels, 0, None)], 0)
    return labels


def shares(values):
    values = values[values > 0]
    keys, counts = np.unique(values, return_counts=True)
    return dict(zip(keys.tolist(), (counts / max(len(values), 1)).tolist()))


def overlap(p, q):
    return sum(min(p.get(k, 0), q.get(k, 0)) for k in set(p) | set(q)) if p and q else 0.0


def offsets(points, reference, alternative, aseg, parcels, radius):
    """Where the same numbers land read as the reference template and as the alternative."""
    to_voxel = np.linalg.inv(aseg.affine)
    measured = {}
    for group, group_points in points.items():
        a, b = reference(group_points), alternative(group_points)
        distance = np.linalg.norm(a - b, axis=1)
        measured[f"{group}_offset_mm"] = {"median": round(float(np.median(distance)), 4),
                                          "p95": round(float(np.percentile(distance, 95)), 4),
                                          "max": round(float(distance.max()), 4)}
        if group == "cortex":
            a, b = (np.rint(nib.affines.apply_affine(to_voxel, x)).astype(int) for x in (a, b))
            ball = np.argwhere(np.ones((2 * radius + 1,) * 3)) - radius
            ball = ball[np.linalg.norm(ball, axis=1) <= radius]
            sample = np.random.default_rng(SEED).choice(len(a), OVERLAP_SAMPLES, replace=False)
            scores = [overlap(shares(parcels[tuple((a[i] + ball).T)]), shares(parcels[tuple((b[i] + ball).T)]))
                      for i in sample]
            measured["sphere_overlap"] = {"median": round(float(np.median(scores)), 4),
                                          "p10": round(float(np.percentile(scores, 10)), 4)}
    return measured


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--anatomy", help="register onto this declared anatomy instead of the selected one")
    parser.add_argument("--freesurfer", type=Path,
                        default=Path(os.environ.get("FREESURFER_HOME", "/Applications/freesurfer/8.2.0")))
    parser.add_argument("--threads", type=int, default=min(8, os.cpu_count() or 1))
    parser.add_argument("--record", action="store_true", help="add the results to data/sources.json")
    args = parser.parse_args()
    config = read_config(args.anatomy)
    if not coordinate_spaces.is_declared(config):
        raise SystemExit(f"{config['anatomy']['id']} does not declare the coordinate_spaces layer")
    stamp = (args.freesurfer / "build-stamp.txt").read_text().strip()
    if stamp != config["freesurfer_build"]:
        raise SystemExit(f"Expected FreeSurfer {config['freesurfer_build']}, found {stamp}.")
    definition = coordinate_spaces.read_definition()
    if definition["radius_mm"] != int(definition["radius_mm"]):
        raise SystemExit("The overlap measurement needs a whole-millimetre radius on aseg's 1 mm grid")

    mri = config["source_directory"] / "mri"
    aseg = nib.load(mri / "aseg.mgz")
    brain = nib.load(mri / "brain.mgz")
    scanner_to_surface = aseg.header.get_vox2ras_tkr() @ np.linalg.inv(aseg.affine)
    parcels = schaefer_on_grid(config, aseg)
    report = {"freesurfer_build": stamp, "spaces": {}, "alternatives": {}}
    origins, fields, readings, points = [], [], {}, None
    with tempfile.TemporaryDirectory() as work:
        work = Path(work)
        fixed = work / "fixed.nii.gz"
        nib.save(nib.Nifti1Image(np.asarray(brain.dataobj).astype(np.float32), brain.affine), fixed)
        for space in definition["spaces"]:
            (work / space["id"]).mkdir()
            inv, mask, measured, space_origins, seg, affine = register(
                args.freesurfer, args.threads, space, fixed, aseg, work / space["id"])
            path, error = write_field(config, definition, space, inv, mask, scanner_to_surface)
            readings[space["id"]] = inv
            if points is None:
                # The comparison points: where the first published template's own anatomy is cortex or deep grey.
                deep = [v for name, pair in coordinate_spaces.SUBCORTICAL.items() if name != "lateral-ventricle"
                        for v in pair]
                points = {
                    "cortex": nib.affines.apply_affine(affine, np.argwhere(
                        np.isin(seg, coordinate_spaces.CORTEX) | ((seg >= 1000) & (seg < 3000)))),
                    "subcortical": nib.affines.apply_affine(affine, np.argwhere(np.isin(seg, deep))),
                }
            report["spaces"][space["id"]] = {"checks": measured, "grid_error_mm": error, "field_sha256": sha256(path)}
            origins += space_origins
            fields.append(path)
        for alternative in definition["alternatives"]:
            (work / alternative["id"]).mkdir()
            inv, _, measured, alternative_origins, _, _ = register(
                args.freesurfer, args.threads, alternative, fixed, aseg, work / alternative["id"])
            report["alternatives"][alternative["id"]] = {
                "checks": measured,
                "against": {reference: offsets(points, reading, inv, aseg, parcels, int(definition["radius_mm"]))
                            for reference, reading in readings.items()},
            }
            origins += alternative_origins
    report["method"] = (
        "mri_synthmorph register -m joint (skull-stripped template → brain.mgz); SynthSeg --parc --robust reads the "
        "template, carried by apply -m nearest onto aseg's grid and scored against aseg. A published field samples "
        f"the inverse warp every {definition['grid_spacing_mm']:g} mm over the template's brain dilated "
        f"{definition['mask_margin_mm']:g} mm. Offsets read the same numbers as each template at the first published "
        f"template's own cortex and deep grey, with {definition['radius_mm']:g} mm sphere overlap of this brain's "
        "Schaefer-400 parcels."
    )
    coordinate_spaces.report_path(config).write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))
    coordinate_spaces.accept(report, definition)
    if args.record:
        record(config, definition, [*fields, coordinate_spaces.report_path(config)], origins)
    else:
        print("Re-run with --record to register these files in data/sources.json.")


def record(config, definition, paths, origins):
    manifest = ROOT / "data/sources.json"
    provenance = json.loads(manifest.read_text())
    for path in paths:
        relative = str(path.relative_to(ROOT))
        provenance["sources"] = [s for s in provenance["sources"] if s["path"] != relative] + [{
            "path": relative,
            "sha256": sha256(path),
            "anatomy": config["anatomy"]["id"],
            "derived_from": origins,
            "procedure": "scripts/register_coordinate_spaces.py: SynthMorph registration of each MNI template to brain.mgz, inverse warp sampled on a coarse grid",
            "citation": "; ".join(space["doi"] for space in definition["spaces"]),
            "license": "; ".join(space["license"] for space in definition["spaces"]),
        }]
        print(f"recorded {relative}")
    manifest.write_text(json.dumps(provenance, indent=2) + "\n")


if __name__ == "__main__":
    main()
