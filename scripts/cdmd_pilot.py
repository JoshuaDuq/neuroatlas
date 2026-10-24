"""Pilot: SNAIL's bundle list tracked in MGH CDMD sub_013, then checked against SNAIL.

Stages run in order and each writes its outputs under WORK, so a later stage
never recomputes an earlier one:

    frames    DWI-to-T1 world transform from the released bbregister matrix
    tissue    WM/GM/CSF partial volumes on the DWI grid from FreeSurfer's aseg
    response  multi-shell multi-tissue response functions
    fit       MSMT-CSD white-matter fODFs (--slice times a single slice)
    track     particle filtering tractography, in T1 world coordinates
    bundles   RecoBundles against DIPY's HCP842 80-bundle atlas
    check     go/no-go measures, identical for CDMD and SNAIL
    cst       why CST streamlines end where they do (stopping status per half)
    asymmetry left/right counts of each bundle's own cortical connections, whole tractogram
    recognition L/R counts with mirrored atlas models and looser thresholds
    validate  own-model recognition under 5 RNG seeds at 15/7+refine and 20/10, with check measures

Follows DIPY 1.12.1's reconst_mcsd, tracking_pft and bundle_extraction examples.
Run with: uv run --with dipy==1.12.1 --with cvxpy --with joblib python scripts/cdmd_pilot.py STAGE
"""

import argparse
import json
import multiprocessing
import os
import sys
import time
from pathlib import Path

import nibabel as nib
import nibabel.processing
import numpy as np
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
# KINGSTON locally; Rorqual jobs set CDMD_PILOT_WORK to their scratch copy.
WORK = Path(os.environ.get("CDMD_PILOT_WORK", "/Volumes/KINGSTON/neuroatlas/cdmd-pilot"))
SUBJECT = "sub_013"
SOURCE = WORK / "source"
DWI = SOURCE / SUBJECT / "dwi" / f"{SUBJECT}_dwi"
T1 = SOURCE / SUBJECT / "anat" / f"{SUBJECT}_t1w.nii.gz"
FREESURFER = SOURCE / "derivatives/freesurfer" / SUBJECT
COREGISTRATION = SOURCE / "derivatives/coregistration" / SUBJECT
DERIVED = WORK / "derived"
os.environ.setdefault("DIPY_HOME", str(WORK / "dipy_home"))

# One diffusion time, so every shell in the model shares one response; Δ = 19 ms
# spans b = 50–6000, Δ = 49 ms reaches 17,800.
DIFFUSION_TIME_MS = 19
WORKERS = int(os.environ.get("SLURM_CPUS_PER_TASK", 4))
STEP_MM = 0.2
TRACKING_SEED = 1
SLR_SEED = 1984
RECOBUNDLES_SEED = 2001

# aseg labels by tissue. Ventral DC carries the cerebral peduncle, so it is white
# matter; deep nuclei are grey matter, where the CMC criterion lets tracts end.
WHITE_MATTER = {2, 7, 16, 28, 41, 46, 60, 77, 85, 251, 252, 253, 254, 255}
GREY_MATTER = {3, 8, 10, 11, 12, 13, 17, 18, 26, 30, 42, 47, 49, 50, 51, 52, 53, 54, 58, 62, 80}
CSF = {4, 5, 14, 15, 24, 31, 43, 44, 63, 72}
SUPERSAMPLE = 4

# SNAIL bundle -> HCP842 atlas bundles. The atlas has one SLF per side and
# splits the corpus callosum differently, so those compare as unions.
BUNDLES = {
    "af.left": ["AF_L"], "af.right": ["AF_R"],
    "cst.left": ["CST_L"], "cst.right": ["CST_R"],
    "cg.left": ["C_L"], "cg.right": ["C_R"],
    "uf.left": ["UF_L"], "uf.right": ["UF_R"],
    "ifof.left": ["IFOF_L"], "ifof.right": ["IFOF_R"],
    "ilf.left": ["ILF_L"], "ilf.right": ["ILF_R"],
    "mdlf.left": ["MdLF_L"], "mdlf.right": ["MdLF_R"],
    "slf.left": ["SLF_L"], "slf.right": ["SLF_R"],
    "cc": ["CC", "CCMid", "CC_ForcepsMajor", "CC_ForcepsMinor"],
}
# bundle_extraction's three recognize settings (reduction, pruning, refine); "15/7+refine"
# is its recognize followed by refine(15, 6).
SETTINGS = {"15/7+refine": (15, 7, True), "15/7": (15, 7, False), "20/10": (20, 10, False), "25/12": (25, 12, False)}
# Per-bundle setting, chosen on the validate stage's 5 RNG seeds (derived/validate.json).
# Association bundles at 20/10: their L/R ratios follow the whole tractogram's (median gap
# 0.12 against 0.49 at 15/7+refine; count CV across seeds 5.6% against 8.9%), and their
# white-matter fractions stay within 0.07 of 15/7+refine's. The CST keeps 15/7+refine: it is
# already balanced there (0.79 against the whole tractogram's 0.82), and 20/10 lowers its
# pericentral-to-brainstem share from 0.59/0.61 to 0.40/0.41. The CC was not validated and
# keeps the first run's setting.
BUNDLE_SETTINGS = {name: "15/7+refine" if name.startswith("cst") or name == "cc" else "20/10" for name in BUNDLES}
SNAIL_UNIONS = {
    "slf.left": ["slf1.left", "slf2.left", "slf_3.left"],
    "slf.right": ["slf1.right", "slf2.right", "slf_3.right"],
    "cc": [f"cc_{i}" for i in range(1, 8)],
}
# Destrieux: precentral, postcentral, paracentral, central sulcus.
PERICENTRAL = {11129, 12129, 11128, 12128, 11103, 12103, 11146, 12146}
BRAINSTEM = 16
ENDPOINT_RADIUS_MM = 3


def save_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n")
    print(f"wrote {path}")


def fsl_scaled(image):
    """FSL's scaled-voxel frame: voxels times size, x mirrored for neurological storage."""
    zooms = np.asarray(image.header.get_zooms()[:3], dtype=float)
    scale = np.diag([*zooms, 1.0])
    if np.linalg.det(image.affine[:3, :3]) > 0:
        flip = np.eye(4)
        flip[0, 0], flip[0, 3] = -1, (image.shape[0] - 1) * zooms[0]
        scale = flip @ scale
    return scale


def world_from_fsl(matrix, source, reference):
    return reference.affine @ np.linalg.inv(fsl_scaled(reference)) @ matrix @ fsl_scaled(source) @ np.linalg.inv(source.affine)


def sample_labels(labels, labels_affine, points_world):
    """Nearest-voxel labels at world points; 0 outside the grid."""
    index = np.rint(nib.affines.apply_affine(np.linalg.inv(labels_affine), points_world)).astype(int)
    inside = np.all((index >= 0) & (index < labels.shape), axis=1)
    out = np.zeros(len(points_world), dtype=labels.dtype)
    out[inside] = labels[tuple(index[inside].T)]
    return out


def dwi_to_t1():
    return np.array(json.loads((DERIVED / "frames.json").read_text())["dwi_to_t1_world"])


def aseg_class_lookup(labels):
    present = set(np.unique(labels).tolist()) - {0}
    unknown = present - WHITE_MATTER - GREY_MATTER - CSF
    if unknown:
        raise ValueError(f"aseg labels without a tissue class: {sorted(unknown)}")
    lookup = np.zeros(int(labels.max()) + 1, dtype=np.uint8)
    for code, members in ((1, WHITE_MATTER), (2, GREY_MATTER), (3, CSF)):
        lookup[[label for label in members if label < len(lookup)]] = code
    return lookup


def frames(_):
    """Pick the bbregister reference by agreement with the released DWI-space aparc+aseg."""
    dwi = nib.load(f"{DWI}_brainmask.nii.gz")
    released = np.asarray(nib.load(f"{DWI}_aparc+aseg.nii.gz").dataobj).astype(int)
    if released.shape != dwi.shape[:3]:
        raise ValueError("Released DWI-space labels are not on the DWI grid")
    # aparc+aseg's cortical parcels collapse to aseg's cortex for comparison.
    released = np.where((released >= 1000) & (released < 2000), 3, np.where(released >= 2000, 42, released))
    aseg_image = nib.load(FREESURFER / "mri/aseg.mgz")
    aseg = np.asarray(aseg_image.dataobj).astype(int)
    matrix = np.loadtxt(COREGISTRATION / f"{SUBJECT}_dwi2t1w.mat")
    centres = nib.affines.apply_affine(dwi.affine, np.argwhere(np.ones(dwi.shape[:3], bool)))
    brain = released.ravel() > 0

    candidates = {"identity": np.eye(4)}
    for name, path in (("t1w.nii.gz", T1), ("orig.mgz", FREESURFER / "mri/orig.mgz")):
        candidates[f"fsl, reference {name}"] = world_from_fsl(matrix, dwi, nib.load(path))
    agreement = {}
    for name, transform in candidates.items():
        labels = sample_labels(aseg, aseg_image.affine, nib.affines.apply_affine(transform, centres))
        agreement[name] = float(np.mean(labels[brain] == released.ravel()[brain]))
        print(f"{name}: label agreement {agreement[name]:.4f}")
    chosen = max(agreement, key=agreement.get)

    t1, orig = nib.load(T1), nib.load(FREESURFER / "mri/orig.mgz")
    # orig.mgz is conformed from the T1, so both must share one world frame.
    t1_in_orig = np.asarray(
        nib.processing.resample_from_to(t1, (orig.shape, orig.affine), order=1).dataobj
    )
    orig_data = np.asarray(orig.dataobj, dtype=float)
    head = orig_data > 0
    correlation = float(np.corrcoef(t1_in_orig[head], orig_data[head])[0, 1])
    print(f"T1 vs orig.mgz intensity correlation in one world frame: {correlation:.4f}")

    save_json(DERIVED / "frames.json", {
        "dwi_to_t1_world": candidates[chosen].tolist(),
        "chosen": chosen,
        "label_agreement": agreement,
        "t1_orig_correlation": correlation,
        "dwi_axcodes": "".join(nib.aff2axcodes(dwi.affine)),
        "dwi_affine_determinant": float(np.linalg.det(dwi.affine[:3, :3])),
    })


def tissue(_):
    """Exact-ish partial volumes: aseg classes sampled at 4³ points per DWI voxel, then averaged."""
    mask = nib.load(f"{DWI}_brainmask.nii.gz")
    aseg_image = nib.load(FREESURFER / "mri/aseg.mgz")
    aseg = np.asarray(aseg_image.dataobj).astype(int)
    lookup = aseg_class_lookup(aseg)
    classes = lookup[aseg]
    to_t1 = dwi_to_t1()
    offsets = (np.arange(SUPERSAMPLE) + 0.5) / SUPERSAMPLE - 0.5
    sub = np.stack(np.meshgrid(offsets, offsets, offsets, indexing="ij"), -1).reshape(-1, 3)
    pve = np.zeros((*mask.shape[:3], 3), dtype=np.float32)
    voxel_to_t1 = to_t1 @ mask.affine
    for i in range(mask.shape[0]):
        grid = np.argwhere(np.ones(mask.shape[1:3], bool))
        voxels = np.column_stack([np.full(len(grid), i), grid]).astype(float)
        points = (voxels[:, None, :] + sub[None]).reshape(-1, 3)
        labels = sample_labels(classes, aseg_image.affine, nib.affines.apply_affine(voxel_to_t1, points))
        labels = labels.reshape(len(grid), len(sub))
        for code in (1, 2, 3):
            pve[i, grid[:, 0], grid[:, 1], code - 1] = np.mean(labels == code, axis=1)
    for name, k in (("wm", 0), ("gm", 1), ("csf", 2)):
        nib.save(nib.Nifti1Image(pve[..., k], mask.affine), DERIVED / f"pve_{name}.nii.gz")
    dominant = np.where(pve.max(-1) >= 0.5, pve.argmax(-1) + 1, 0).astype(np.uint8)
    nib.save(nib.Nifti1Image(dominant, mask.affine), DERIVED / "tissue_dominant.nii.gz")
    print("tissue volumes (mL):", {n: float(pve[..., k].sum() * np.prod(mask.header.get_zooms()[:3]) / 1000)
                                   for n, k in (("wm", 0), ("gm", 1), ("csf", 2))})


def load_shells():
    from dipy.core.gradients import gradient_table
    from dipy.io.gradients import read_bvals_bvecs

    bvals, bvecs = read_bvals_bvecs(f"{DWI}.bval", f"{DWI}.bvec")
    delta = np.loadtxt(f"{DWI}.delta")
    keep = (bvals == 0) | (delta == DIFFUSION_TIME_MS)
    image = nib.load(f"{DWI}.nii.gz")
    if image.shape[3] != len(bvals) or len(delta) != len(bvals):
        raise ValueError("Gradient files and DWI volumes disagree")
    if np.linalg.det(image.affine[:3, :3]) > 0:
        raise ValueError("FSL bvecs on a neurologically stored image need an x flip")
    # The selected volumes are kept uncompressed, so later stages skip the 1 GB gunzip.
    subset = DERIVED / f"dwi_delta{DIFFUSION_TIME_MS}.nii"
    if not subset.exists():
        selected = np.asarray(image.dataobj, dtype=np.float32)[..., keep]
        nib.save(nib.Nifti1Image(selected, image.affine), subset)
    data = np.asarray(nib.load(subset).dataobj)
    if data.shape[-1] != keep.sum():
        raise ValueError(f"{subset} does not hold the selected volumes")
    return image, data, gradient_table(bvals[keep], bvecs=bvecs[keep])


def response(_):
    from dipy.core.gradients import gradient_table, unique_bvals_tolerance
    from dipy.reconst.mcsd import mask_for_response_msmt, response_from_mask_msmt

    image, data, gtab = load_shells()
    low = gtab.bvals < 1200
    low_gtab = gradient_table(gtab.bvals[low], bvecs=gtab.bvecs[low])
    masks = mask_for_response_msmt(
        low_gtab, data[..., low], roi_radii=10, wm_fa_thr=0.7, gm_fa_thr=0.3,
        csf_fa_thr=0.15, gm_md_thr=0.001, csf_md_thr=0.0032,
    )
    dominant = np.asarray(nib.load(DERIVED / "tissue_dominant.nii.gz").dataobj)
    masks = [m * (dominant == code) for m, code in zip(masks, (1, 2, 3))]
    print("response voxels wm/gm/csf:", [int(m.sum()) for m in masks])
    wm, gm, csf = response_from_mask_msmt(gtab, data, *masks)
    save_json(DERIVED / "response.json", {
        "diffusion_time_ms": DIFFUSION_TIME_MS,
        "bvals": unique_bvals_tolerance(gtab.bvals).tolist(),
        "volumes": int(data.shape[-1]),
        "voxels": [int(m.sum()) for m in masks],
        "wm": wm.tolist(), "gm": gm.tolist(), "csf": csf.tolist(),
    })


def fit(arguments):
    from dipy.core.gradients import unique_bvals_tolerance
    from dipy.reconst.mcsd import MultiShellDeconvModel, multi_shell_fiber_response

    image, data, gtab = load_shells()
    record = json.loads((DERIVED / "response.json").read_text())
    multi = multi_shell_fiber_response(
        sh_order_max=8, bvals=unique_bvals_tolerance(gtab.bvals),
        wm_rf=np.array(record["wm"]), gm_rf=np.array(record["gm"]), csf_rf=np.array(record["csf"]),
    )
    model = MultiShellDeconvModel(gtab, multi)
    mask = np.asarray(nib.load(f"{DWI}_brainmask.nii.gz").dataobj) > 0
    if arguments.slice is not None:
        mask = mask & (np.arange(mask.shape[0]) == arguments.slice)[:, None, None]
    started = time.perf_counter()
    result = model.fit(data, mask=mask, engine="joblib", n_jobs=WORKERS, verbose=False)
    seconds = time.perf_counter() - started
    print(f"fitted {int(mask.sum())} voxels in {seconds:.1f} s ({1000 * seconds / mask.sum():.2f} ms/voxel)")
    if arguments.slice is not None:
        return
    nib.save(nib.Nifti1Image(result.shm_coeff.astype(np.float32), image.affine), DERIVED / "fodf_wm_sh.nii.gz")
    nib.save(nib.Nifti1Image(result.volume_fractions.astype(np.float32), image.affine), DERIVED / "fractions.nii.gz")
    save_json(DERIVED / "fit.json", {"voxels": int(mask.sum()), "seconds": seconds, "workers": WORKERS})


_TRACKING = {}


def _load_tracking():
    """The direction getter and stopping maps, built once before the workers fork.

    pft_tracking(sh=...) rebuilds the whole-volume PMF (~2.2 GB) on every call, so
    each worker would hold its own; this builds the same objects it does, once.
    """
    from dipy.data import default_sphere
    from dipy.direction import ProbabilisticDirectionGetter
    from dipy.tracking.stopping_criterion import CmcStoppingCriterion

    sh_image = nib.load(DERIVED / "fodf_wm_sh.nii.gz")
    wm, gm, csf = (np.asarray(nib.load(DERIVED / f"pve_{n}.nii.gz").dataobj, dtype=float) for n in ("wm", "gm", "csf"))
    _TRACKING["affine"] = sh_image.affine
    _TRACKING["getter"] = ProbabilisticDirectionGetter.from_shcoeff(
        np.asarray(sh_image.dataobj, dtype=float), max_angle=20.0, sphere=default_sphere,
        sh_to_pmf=True, pmf_threshold=0.1, basis_type=None, legacy=True,
    )
    _TRACKING["criterion"] = CmcStoppingCriterion.from_pve(
        wm, gm, csf, step_size=STEP_MM, average_voxel_size=float(np.mean(sh_image.header.get_zooms()[:3])),
    )


def _track_chunk(seeds):
    from dipy.tracking.tracker import ParticleFilteringTracking

    # pft_tracking's defaults and the tracking_pft example's settings, lengths in steps.
    generator = ParticleFilteringTracking(
        _TRACKING["getter"], _TRACKING["criterion"], seeds, _TRACKING["affine"],
        max_cross=1, step_size=STEP_MM, minlen=int(2 / STEP_MM), maxlen=int(500 / STEP_MM),
        pft_back_tracking_dist=2, pft_front_tracking_dist=1, particle_count=15, pft_max_trial=20,
        return_all=False, random_seed=TRACKING_SEED, initial_directions=None, save_seeds=False,
        min_wm_pve_before_stopping=1, unidirectional=False, randomize_forward_direction=False,
    )
    return [np.asarray(s, dtype=np.float32) for s in generator]


def track(arguments):
    from dipy.io.stateful_tractogram import Space, StatefulTractogram
    from dipy.io.streamline import save_tractogram
    from dipy.tracking import utils

    pve_wm = nib.load(DERIVED / "pve_wm.nii.gz")
    seeds = utils.seeds_from_mask(np.asarray(pve_wm.dataobj) >= 0.5, pve_wm.affine, density=2)
    if arguments.seeds:
        seeds = seeds[np.random.default_rng(TRACKING_SEED).choice(len(seeds), arguments.seeds, replace=False)]
    print(f"{len(seeds)} seeds")
    started = time.perf_counter()
    # Forked workers share the parent's maps; spawned ones ran ~10x slower here.
    _load_tracking()
    with multiprocessing.get_context("fork").Pool(WORKERS) as pool:
        chunks = pool.map(_track_chunk, np.array_split(seeds, WORKERS * 16))
    streamlines = [s for chunk in chunks for s in chunk]
    seconds = time.perf_counter() - started
    print(f"{len(streamlines)} streamlines in {seconds:.1f} s")
    if arguments.seeds:
        return
    to_t1 = dwi_to_t1()
    moved = [nib.affines.apply_affine(to_t1, s).astype(np.float32) for s in streamlines]
    tractogram = StatefulTractogram(moved, nib.load(T1), Space.RASMM)
    save_tractogram(tractogram, str(DERIVED / "tractogram.trk"))
    save_json(DERIVED / "track.json", {"seeds": len(seeds), "streamlines": len(streamlines), "seconds": seconds})


def bundles(_):
    from dipy.align.streamlinear import whole_brain_slr
    from dipy.data.fetcher import fetch_bundle_atlas_hcp842, get_bundle_atlas_hcp842
    from dipy.io.stateful_tractogram import Space, StatefulTractogram
    from dipy.io.streamline import load_tractogram, save_tractogram
    from dipy.segment.bundles import RecoBundles

    fetch_bundle_atlas_hcp842()
    atlas_file, bundle_pattern = get_bundle_atlas_hcp842()
    available = {Path(p).name.split(".")[0]: p for p in sorted(Path(bundle_pattern).parent.glob(Path(bundle_pattern).name)) if not p.name.startswith("._")}
    missing = {b for names in BUNDLES.values() for b in names} - set(available)
    if missing:
        raise ValueError(f"Atlas lacks {sorted(missing)}; has {sorted(available)}")
    atlas = load_tractogram(atlas_file, "same", bbox_valid_check=False).streamlines
    target = load_tractogram(str(DERIVED / "tractogram.trk"), "same")
    moved, transform, _, _ = whole_brain_slr(
        atlas, target.streamlines, x0="affine", verbose=True, progressive=True,
        rng=np.random.default_rng(SLR_SEED),
    )
    recognizer = RecoBundles(moved, verbose=False, rng=np.random.default_rng(RECOBUNDLES_SEED))
    # Every recognition starts from the same RNG state, so no bundle's result depends on the
    # bundles recognised before it; with one shared stream, SLF swung from 862/224 to 1026/869.
    start = recognizer.rng.bit_generator.state
    counts = {}
    out = DERIVED / "bundles"
    out.mkdir(exist_ok=True)
    for name, atlas_names in BUNDLES.items():
        reduction, pruning, refine = SETTINGS[BUNDLE_SETTINGS[name]]
        selected = set()
        for atlas_name in atlas_names:
            model = load_tractogram(available[atlas_name], "same", bbox_valid_check=False).streamlines
            recognizer.rng.bit_generator.state = start
            recognized, labels = recognizer.recognize(
                model_bundle=model, model_clust_thr=0.1, reduction_thr=reduction, pruning_thr=pruning,
                reduction_distance="mdf", pruning_distance="mdf", slr=True,
            )
            if len(recognized) == 0:
                counts[atlas_name] = 0
                continue
            if refine:
                _, labels = recognizer.refine(
                    model_bundle=model, pruned_streamlines=recognized, model_clust_thr=0.1,
                    reduction_thr=15, pruning_thr=6, reduction_distance="mdf", pruning_distance="mdf", slr=True,
                )
            counts[atlas_name] = len(labels)
            selected.update(np.asarray(labels).tolist())
        indices = sorted(selected)
        save_tractogram(StatefulTractogram(target.streamlines[indices], target, Space.RASMM), str(out / f"{name}.trk"))
    save_json(DERIVED / "bundles.json", {
        "slr_transform": np.asarray(transform).tolist(),
        "settings": BUNDLE_SETTINGS,
        "rng": f"each recognition from the post-construction state of default_rng({RECOBUNDLES_SEED})",
        "atlas_counts": counts,
    })


def measures(streamlines, aseg, destrieux, affine, voxel_mm, is_cst):
    """Per-bundle measures in one subject's own segmentation."""
    from dipy.tracking.streamline import length

    points = np.concatenate(streamlines)
    labels = sample_labels(aseg, affine, points)
    radius = int(round(ENDPOINT_RADIUS_MM / voxel_mm))
    ball = np.linalg.norm(np.mgrid[-radius:radius + 1, -radius:radius + 1, -radius:radius + 1], axis=0) <= radius
    record = {
        "streamlines": len(streamlines),
        "length_mm_median": float(np.median(length(streamlines))),
        "points_in_white_matter": float(np.isin(labels, list(WHITE_MATTER)).mean()),
        "points_in_brain_tissue": float(np.isin(labels, list(WHITE_MATTER | GREY_MATTER)).mean()),
    }
    if is_cst:
        cortex = ndimage.binary_dilation(np.isin(destrieux, list(PERICENTRAL)), ball)
        stem = aseg == BRAINSTEM
        # Below the lowest labelled brainstem voxel is medulla or cord, never cortex.
        stem_floor = float(nib.affines.apply_affine(affine, np.argwhere(stem))[:, 2].min())
        stem = ndimage.binary_dilation(stem, ball)
        ends = np.array([[s[0], s[-1]] for s in streamlines])
        in_cortex = sample_labels(cortex.astype(np.uint8), affine, ends.reshape(-1, 3)).reshape(-1, 2) > 0
        in_stem = (sample_labels(stem.astype(np.uint8), affine, ends.reshape(-1, 3)).reshape(-1, 2) > 0) | (ends[..., 2] < stem_floor)
        record["cortex_to_brainstem"] = float(np.mean((in_cortex[:, 0] & in_stem[:, 1]) | (in_cortex[:, 1] & in_stem[:, 0])))
    return record


def check(_):
    snail_dir = ROOT / "public/diffusion/snail-subject-1"
    subjects = {
        "cdmd": (FREESURFER / "mri", {name: [DERIVED / "bundles" / f"{name}.trk"] for name in BUNDLES}),
        "snail": (ROOT / "data/snail/mri", {
            name: [snail_dir / f"bundles_{part}.trk.gz" for part in SNAIL_UNIONS.get(name, [name])] for name in BUNDLES
        }),
    }
    report = {}
    for subject, (mri, files) in subjects.items():
        aseg_image = nib.load(mri / "aseg.mgz")
        aseg = np.asarray(aseg_image.dataobj).astype(int)
        destrieux = np.asarray(nib.load(mri / "aparc.a2009s+aseg.mgz").dataobj).astype(int)
        voxel_mm = float(aseg_image.header.get_zooms()[0])
        report[subject] = {}
        for name, paths in files.items():
            streamlines = [s for p in paths for s in nib.streamlines.load(str(p)).streamlines]
            if not streamlines:
                report[subject][name] = {"streamlines": 0}
                continue
            report[subject][name] = measures(streamlines, aseg, destrieux, aseg_image.affine, voxel_mm, name.startswith("cst"))
            print(subject, name, report[subject][name])

    # Cortex the DWI never imaged: aseg cortex voxels mapped into the DWI grid.
    aseg_image = nib.load(FREESURFER / "mri/aseg.mgz")
    aseg = np.asarray(aseg_image.dataobj)
    cortex = nib.affines.apply_affine(aseg_image.affine, np.argwhere(np.isin(aseg, [3, 42])))
    mask = nib.load(f"{DWI}_brainmask.nii.gz")
    in_dwi = nib.affines.apply_affine(np.linalg.inv(mask.affine) @ np.linalg.inv(dwi_to_t1()), cortex)
    outside_grid = ~np.all((in_dwi > -0.5) & (in_dwi < np.array(mask.shape[:3]) - 0.5), axis=1)
    inside = ~outside_grid
    outside_mask = outside_grid.copy()
    index = np.rint(in_dwi[inside]).astype(int)
    outside_mask[inside] = np.asarray(mask.dataobj)[tuple(index.T)] == 0
    report["cdmd_cortex_outside_dwi"] = {"grid": float(outside_grid.mean()), "brain_mask": float(outside_mask.mean())}
    print(report["cdmd_cortex_outside_dwi"])
    save_json(DERIVED / "check.json", report)


STATUS = {-2: "PYERROR", -1: "OUTSIDEIMAGE", 0: "INVALIDPOINT", 1: "TRACKPOINT", 2: "ENDPOINT"}
VALID = ("ENDPOINT", "OUTSIDEIMAGE")
DEEP_GREY = {10, 11, 12, 13, 17, 18, 26, 49, 50, 51, 52, 53, 54, 58}


def _track_with_status(seeds):
    """ParticleFilteringTracking's own loop, keeping each half's stopping status.

    Same seeding, RNG and steps as _track_chunk, so every streamline that run
    kept is reproduced exactly; the halves it discarded are kept here too.
    """
    import random

    from dipy.utils import fast_numpy
    from dipy.tracking.tracker import ParticleFilteringTracking

    tracker = ParticleFilteringTracking(
        _TRACKING["getter"], _TRACKING["criterion"], seeds, _TRACKING["affine"],
        max_cross=1, step_size=STEP_MM, minlen=int(2 / STEP_MM), maxlen=int(500 / STEP_MM),
        pft_back_tracking_dist=2, pft_front_tracking_dist=1, particle_count=15, pft_max_trial=20,
        return_all=True, random_seed=TRACKING_SEED, min_wm_pve_before_stopping=1,
    )
    inverse = np.linalg.inv(tracker.affine)
    forward = np.empty((tracker.max_length + 1, 3))
    backward = forward.copy()
    out = []
    for world_seed in seeds:
        s = inverse[:3, :3] @ world_seed + inverse[:3, 3]
        seed = hash(np.abs(np.sum(s) + tracker.random_seed)) % (np.iinfo(np.uint32).max - 1)
        random.seed(seed)
        np.random.seed(seed)
        fast_numpy.seed(seed)
        directions = tracker.direction_getter.initial_direction(s)[:1]
        if len(directions) == 0:
            out.append((world_seed, None, "NODIRECTION", "NODIRECTION"))
            continue
        first = directions[0]
        steps_f, status_f = tracker._tracker(s, first, forward)
        first = -first
        if steps_f > 1:
            opposite = forward[0] - forward[1]
            if np.linalg.norm(opposite) > 0:
                first = opposite / np.linalg.norm(opposite)
        steps_b, status_b = tracker._tracker(s, first, backward)
        voxels = forward[:steps_f].copy() if steps_b == 1 else np.concatenate(
            (backward[steps_b - 1:0:-1], forward[:steps_f]))
        line = nib.affines.apply_affine(tracker.affine, voxels).astype(np.float32)
        out.append((world_seed, line, STATUS[int(status_f)], STATUS[int(status_b)]))
    return out


def _upper_end_classes(streamlines, aseg_image, destrieux):
    """Where each streamline's upper end lies: distances (mm) to cortex classes and deep grey."""
    aseg = np.asarray(aseg_image.dataobj).astype(int)
    voxel = aseg_image.header.get_zooms()[:3]
    distance = {
        "pericentral": ndimage.distance_transform_edt(~np.isin(destrieux, list(PERICENTRAL)), sampling=voxel),
        "cortex": ndimage.distance_transform_edt(~np.isin(aseg, [3, 42]), sampling=voxel),
        "deep_grey": ndimage.distance_transform_edt(~np.isin(aseg, list(DEEP_GREY)), sampling=voxel),
    }
    ends = np.array([s[0] if s[0][2] > s[-1][2] else s[-1] for s in streamlines])
    index = np.rint(nib.affines.apply_affine(np.linalg.inv(aseg_image.affine), ends)).astype(int)
    index = np.clip(index, 0, np.array(aseg.shape) - 1)
    found = {name: d[tuple(index.T)] for name, d in distance.items()}
    within = {name: d <= ENDPOINT_RADIUS_MM for name, d in found.items()}
    classes = np.where(within["pericentral"], "pericentral",
              np.where(within["cortex"], "other cortex",
              np.where(within["deep_grey"], "deep grey", "white matter")))
    return ends, classes, found


def cst(_):
    """Why CDMD's recognised CST streamlines end where they do, and SNAIL's for comparison."""
    from collections import Counter

    from dipy.tracking import utils
    from scipy.spatial import cKDTree

    pve_wm = nib.load(DERIVED / "pve_wm.nii.gz")
    seeds = utils.seeds_from_mask(np.asarray(pve_wm.dataobj) >= 0.5, pve_wm.affine, density=2)
    tree = cKDTree(seeds)
    to_dwi = np.linalg.inv(dwi_to_t1())
    aseg_image = nib.load(FREESURFER / "mri/aseg.mgz")
    destrieux = np.asarray(nib.load(FREESURFER / "mri/aparc.a2009s+aseg.mgz").dataobj).astype(int)
    _load_tracking()
    report = {}
    for side in ("left", "right"):
        bundle = [np.asarray(s) for s in nib.streamlines.load(str(DERIVED / "bundles" / f"cst.{side}.trk")).streamlines]
        # Each kept streamline passes exactly through the seed it grew from.
        own = []
        for s in bundle:
            distances, nearest = tree.query(nib.affines.apply_affine(to_dwi, s))
            own.append(int(nearest[np.argmin(distances)]) if distances.min() < 1e-3 else -1)
        own = np.array(own)
        if np.any(own < 0):
            raise ValueError(f"{np.sum(own < 0)} CST streamlines match no seed")
        # Seeds in every DWI voxel the bundle crosses: the ones it kept and the ones it lost.
        crossed = {tuple(v) for s in bundle for v in np.rint(nib.affines.apply_affine(np.linalg.inv(pve_wm.affine), nib.affines.apply_affine(to_dwi, s))).astype(int)}
        seed_voxels = np.rint(nib.affines.apply_affine(np.linalg.inv(pve_wm.affine), seeds)).astype(int)
        region = np.flatnonzero([tuple(v) in crossed for v in seed_voxels])
        with multiprocessing.get_context("fork").Pool(WORKERS) as pool:
            results = [r for chunk in pool.map(_track_with_status, np.array_split(seeds[region], WORKERS * 8)) for r in chunk]
        by_seed = dict(zip(region.tolist(), results))

        # PFT is chaotic, so this holds only on the platform that tracked the bundle.
        rerun = [nib.affines.apply_affine(dwi_to_t1(), by_seed[i][1]) for i in own]
        reproduced = [len(r) == len(s) and np.allclose(r, s, atol=1e-4) for r, s in zip(rerun, bundle)]
        if np.mean(reproduced) < 1:
            raise ValueError(f"Only {np.mean(reproduced):.3f} of the CST reruns reproduce the bundle")
        ends, classes, found = _upper_end_classes(bundle, aseg_image, destrieux)
        # The upper half is whichever half's last point is the upper end.
        upper_status = []
        for i, s in zip(own, bundle):
            _, line, status_f, status_b = by_seed[i]
            upper_status.append(status_f if line[-1][2] >= line[0][2] else status_b)
        tally_region = Counter((f, b) for _, _, f, b in results)
        report[side] = {
            "streamlines": len(bundle),
            "reproduced": float(np.mean(reproduced)),
            "upper_end_class": dict(Counter(classes.tolist())),
            "upper_end_status_by_class": {c: dict(Counter(np.array(upper_status)[classes == c].tolist())) for c in np.unique(classes)},
            "upper_end_z_mm_median_by_class": {c: float(np.median(ends[classes == c, 2])) for c in np.unique(classes)},
            "white_matter_ends_distance_mm_median": {k: float(np.median(v[classes == "white matter"])) for k, v in found.items()} if np.any(classes == "white matter") else {},
            "region_seeds": len(region),
            "region_kept": float(np.mean([f in VALID and b in VALID for _, _, f, b in results])),
            "region_status_pairs": {f"{f}/{b}": n for (f, b), n in tally_region.most_common()},
        }
        print(side, json.dumps(report[side], indent=1))

    snail_mri = ROOT / "data/snail/mri"
    snail_aseg = nib.load(snail_mri / "aseg.mgz")
    snail_destrieux = np.asarray(nib.load(snail_mri / "aparc.a2009s+aseg.mgz").dataobj).astype(int)
    for side in ("left", "right"):
        bundle = [np.asarray(s) for s in nib.streamlines.load(str(ROOT / f"public/diffusion/snail-subject-1/bundles_cst.{side}.trk.gz")).streamlines]
        ends, classes, _ = _upper_end_classes(bundle, snail_aseg, snail_destrieux)
        report[f"snail_{side}"] = {"streamlines": len(bundle), "upper_end_class": dict(Counter(classes.tolist())),
                                   "upper_end_z_mm_median_by_class": {c: float(np.median(ends[classes == c, 2])) for c in np.unique(classes)}}
        print("snail", side, report[f"snail_{side}"])
    save_json(DERIVED / "cst.json", report)


PAIRED = ("af", "slf", "ilf", "ifof", "uf", "mdlf", "cg", "cst")
PAIR_COVERAGE = 0.9


def _cortical_ends(streamlines, aseg_image, destrieux):
    """Each end's nearest Destrieux cortical parcel within ENDPOINT_RADIUS_MM (0 if none),
    or -1 when it lies in, or below, the brainstem."""
    aseg = np.asarray(aseg_image.dataobj).astype(int)
    voxel = aseg_image.header.get_zooms()[:3]
    cortex = (destrieux >= 11100) & (destrieux < 13000)
    distance, nearest = ndimage.distance_transform_edt(~cortex, sampling=voxel, return_indices=True)
    stem = aseg == BRAINSTEM
    stem_floor = nib.affines.apply_affine(aseg_image.affine, np.argwhere(stem))[:, 2].min()
    stem_distance = ndimage.distance_transform_edt(~stem, sampling=voxel)
    ends = np.array([[s[0], s[-1]] for s in streamlines]).reshape(-1, 3)
    index = np.clip(np.rint(nib.affines.apply_affine(np.linalg.inv(aseg_image.affine), ends)).astype(int),
                    0, np.array(aseg.shape) - 1)
    at = tuple(index.T)
    parcel = np.where(distance[at] <= ENDPOINT_RADIUS_MM, destrieux[tuple(nearest[(slice(None),) + at])], 0)
    parcel = np.where((stem_distance[at] <= ENDPOINT_RADIUS_MM) | (ends[:, 2] < stem_floor), -1, parcel)
    return parcel.reshape(-1, 2)


def _hemisphere_pairs(parcels):
    """(hemisphere, unordered hemisphere-free parcel pair) per streamline; None across hemispheres.

    Destrieux codes are 11xxx left and 12xxx right, so code % 1000 is the homologue.
    """
    out = []
    for a, b in parcels:
        cortical = [p for p in (a, b) if p > 0]
        if 0 in (a, b) or not cortical:
            out.append(None)
            continue
        sides = {p // 1000 for p in cortical}
        if len(sides) != 1:
            out.append(None)
            continue
        out.append(("left" if sides == {11} else "right", tuple(sorted(p % 1000 if p > 0 else p for p in (a, b)))))
    return out


def asymmetry(_):
    """Left/right counts for each bundle's own cortical connections, in the whole tractogram."""
    from collections import Counter

    aseg_image = nib.load(FREESURFER / "mri/aseg.mgz")
    destrieux = np.asarray(nib.load(FREESURFER / "mri/aparc.a2009s+aseg.mgz").dataobj).astype(int)
    whole = _hemisphere_pairs(_cortical_ends(nib.streamlines.load(str(DERIVED / "tractogram.trk")).streamlines,
                                             aseg_image, destrieux))
    whole_counts = Counter(w for w in whole if w is not None)
    report = {"whole_intrahemispheric": dict(Counter(w[0] for w in whole if w is not None))}
    for bundle in PAIRED:
        recognised = {}
        pooled = Counter()
        for side in ("left", "right"):
            streamlines = nib.streamlines.load(str(DERIVED / "bundles" / f"{bundle}.{side}.trk")).streamlines
            recognised[side] = len(streamlines)
            pooled.update(p for _, p in filter(None, _hemisphere_pairs(_cortical_ends(streamlines, aseg_image, destrieux))))
        # The parcel pairs carrying PAIR_COVERAGE of the bundle, both sides pooled.
        total, kept, pairs = sum(pooled.values()), 0, []
        for pair, n in pooled.most_common():
            if kept >= PAIR_COVERAGE * total:
                break
            pairs.append(pair)
            kept += n
        counts = {side: sum(whole_counts[(side, pair)] for pair in pairs) for side in ("left", "right")}
        report[bundle] = {
            "recognised": recognised,
            "recognised_left_right_ratio": recognised["left"] / recognised["right"],
            "pairs": len(pairs),
            "whole_tractogram": counts,
            "whole_left_right_ratio": counts["left"] / counts["right"],
            "recognised_share": {side: recognised[side] / counts[side] for side in ("left", "right")},
        }
        print(bundle, report[bundle])
    save_json(DERIVED / "asymmetry.json", report)


ATLAS_PAIRS = {"af": "AF", "slf": "SLF", "ilf": "ILF", "ifof": "IFOF", "uf": "UF", "mdlf": "MdLF", "cg": "C", "cst": "CST"}
_RECOGNITION = {}


def _recognise(task):
    """One recognition from the forked parent's RecoBundles; each task starts from the same RNG state."""
    model_name, setting = task
    reduction, pruning, refine = SETTINGS[setting]
    recognizer, model = _RECOGNITION["recognizer"], _RECOGNITION["models"][model_name]
    recognized, labels = recognizer.recognize(
        model_bundle=model, model_clust_thr=0.1, reduction_thr=reduction, pruning_thr=pruning,
        reduction_distance="mdf", pruning_distance="mdf", slr=True,
    )
    if refine and len(recognized):
        _, labels = recognizer.refine(
            model_bundle=model, pruned_streamlines=recognized, model_clust_thr=0.1,
            reduction_thr=15, pruning_thr=6, reduction_distance="mdf", pruning_distance="mdf", slr=True,
        )
    return task, np.asarray(labels if len(recognized) else [], dtype=int)


def recognition(_):
    """L/R counts with each side's own atlas model, with one model mirrored onto both sides, and
    at the example's looser thresholds, against the whole-tractogram ratios of `asymmetry`."""
    from dipy.data.fetcher import get_bundle_atlas_hcp842
    from dipy.io.streamline import load_tractogram
    from dipy.segment.bundles import RecoBundles
    from dipy.tracking.streamline import Streamlines, transform_streamlines

    _, bundle_pattern = get_bundle_atlas_hcp842()
    folder = Path(bundle_pattern).parent
    mirror = np.diag([-1.0, 1, 1, 1])  # MNI x = 0 is the midline
    models = {}
    for atlas in ATLAS_PAIRS.values():
        for side in "LR":
            native = load_tractogram(str(folder / f"{atlas}_{side}.trk"), "same", bbox_valid_check=False).streamlines
            models[f"{atlas}_{side}"] = native
            models[f"mirrored {atlas}_{side}"] = Streamlines(transform_streamlines(native, mirror))
    target = load_tractogram(str(DERIVED / "tractogram.trk"), "same")
    transform = np.array(json.loads((DERIVED / "bundles.json").read_text())["slr_transform"])
    _RECOGNITION["models"] = models
    _RECOGNITION["recognizer"] = RecoBundles(
        transform_streamlines(target.streamlines, transform), verbose=False, rng=np.random.default_rng(RECOBUNDLES_SEED),
    )
    tasks = [(name, setting) for name in models for setting in SETTINGS]
    with multiprocessing.get_context("fork").Pool(WORKERS) as pool:
        counts = {task: len(labels) for task, labels in pool.map(_recognise, tasks, chunksize=1)}

    whole = json.loads((DERIVED / "asymmetry.json").read_text())
    report = {}
    for bundle, atlas in ATLAS_PAIRS.items():
        sources = {
            "own model per side": (f"{atlas}_L", f"{atlas}_R"),
            "left model on both": (f"{atlas}_L", f"mirrored {atlas}_L"),
            "right model on both": (f"mirrored {atlas}_R", f"{atlas}_R"),
        }
        report[bundle] = {"whole_left_right_ratio": whole[bundle]["whole_left_right_ratio"]}
        for source, (left, right) in sources.items():
            for setting in SETTINGS:
                l, r = counts[(left, setting)], counts[(right, setting)]
                report[bundle][f"{source}, {setting}"] = {"left": l, "right": r, "ratio": l / r if r else None}
        print(bundle, json.dumps(report[bundle]))
    save_json(DERIVED / "recognition.json", report)


VALIDATION_SEEDS = (2001, 2002, 2003, 2004, 2005)
VALIDATION_SETTINGS = ("15/7+refine", "20/10")


def validate(_):
    """Own-model recognition under several RNG seeds at the run's setting and at 20/10, with the
    check measures of every result; seed RECOBUNDLES_SEED's 20/10 bundles are saved."""
    from dipy.data.fetcher import get_bundle_atlas_hcp842
    from dipy.io.stateful_tractogram import Space, StatefulTractogram
    from dipy.io.streamline import load_tractogram, save_tractogram
    from dipy.segment.bundles import RecoBundles
    from dipy.tracking.streamline import transform_streamlines

    _, bundle_pattern = get_bundle_atlas_hcp842()
    folder = Path(bundle_pattern).parent
    _RECOGNITION["models"] = {
        f"{atlas}_{side}": load_tractogram(str(folder / f"{atlas}_{side}.trk"), "same", bbox_valid_check=False).streamlines
        for atlas in ATLAS_PAIRS.values() for side in "LR"
    }
    target = load_tractogram(str(DERIVED / "tractogram.trk"), "same")
    transform = np.array(json.loads((DERIVED / "bundles.json").read_text())["slr_transform"])
    moved = transform_streamlines(target.streamlines, transform)
    aseg_image = nib.load(FREESURFER / "mri/aseg.mgz")
    aseg = np.asarray(aseg_image.dataobj).astype(int)
    destrieux = np.asarray(nib.load(FREESURFER / "mri/aparc.a2009s+aseg.mgz").dataobj).astype(int)
    voxel_mm = float(aseg_image.header.get_zooms()[0])
    saved = DERIVED / "bundles_20_10"
    saved.mkdir(exist_ok=True)
    tasks = [(f"{atlas}_{side}", setting) for atlas in ATLAS_PAIRS.values() for side in "LR" for setting in VALIDATION_SETTINGS]
    report = {}
    for seed in VALIDATION_SEEDS:
        _RECOGNITION["recognizer"] = RecoBundles(moved, verbose=False, rng=np.random.default_rng(seed))
        with multiprocessing.get_context("fork").Pool(WORKERS) as pool:
            labels = dict(pool.map(_recognise, tasks, chunksize=1))
        report[seed] = {}
        for bundle, atlas in ATLAS_PAIRS.items():
            for side, letter in (("left", "L"), ("right", "R")):
                for setting in VALIDATION_SETTINGS:
                    streamlines = target.streamlines[labels[(f"{atlas}_{letter}", setting)]]
                    key = f"{bundle}.{side}, {setting}"
                    report[seed][key] = measures(list(streamlines), aseg, destrieux, aseg_image.affine, voxel_mm,
                                                 bundle == "cst") if len(streamlines) else {"streamlines": 0}
                    if seed == RECOBUNDLES_SEED and setting == "20/10":
                        save_tractogram(StatefulTractogram(streamlines, target, Space.RASMM), str(saved / f"{bundle}.{side}.trk"))
        print(seed, json.dumps({k: v["streamlines"] for k, v in report[seed].items()}))
    save_json(DERIVED / "validate.json", report)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    stages = parser.add_subparsers(dest="stage", required=True)
    for name in ("frames", "tissue", "response", "bundles", "check", "cst", "asymmetry", "recognition", "validate"):
        stages.add_parser(name)
    stages.add_parser("fit").add_argument("--slice", type=int, help="fit one sagittal slice only, to time it")
    stages.add_parser("track").add_argument("--seeds", type=int, help="track a random subset, to time it")
    arguments = parser.parse_args()
    DERIVED.mkdir(parents=True, exist_ok=True)
    globals()[arguments.stage](arguments)


if __name__ == "__main__":
    sys.exit(main())
