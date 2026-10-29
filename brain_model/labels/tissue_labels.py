"""Published volumetric anatomy and explicitly ribbon-restricted surface-atlas projections."""

import json

import nibabel as nib
import numpy as np
from nibabel.freesurfer.io import read_annot, read_geometry
from scipy.spatial import cKDTree

from ..sources import read_color_table, read_config, sha256, verify_sources, write_json
from ..layers import arterial_territories, cerebellar_functions
from . import nextbrain, white_matter
from .volumes import encode_cropped_volume, validate_same_grid


def describe_source_label(value, table, regions):
    name, color = table[value]
    hemisphere = (
        "left"
        if name.startswith(("Left-", "ctx_lh_", "ctx-lh-"))
        else "right"
        if name.startswith(("Right-", "ctx_rh_", "ctx-rh-"))
        else "midline"
    )
    cortex = value >= 11100
    matches = [
        region
        for region in regions
        if (
            cortex
            and region["atlas"] == "destrieux"
            and region["hemisphere"] == hemisphere
            # FreeSurfer 6 annotations write `&` where the LUT writes `_and_`.
            and region["source_name"].replace("&", "_and_") == name[7:]
        )
        or (
            not cortex
            # Atlas-qualified: the fine detail level publishes structures too,
            # and its published indices overlap these FreeSurfer label ids.
            and region["atlas"] == "aseg"
            and region["kind"] == "structure"
            and region["source_label_id"] == value
        )
    ]
    if len(matches) > 1:
        raise ValueError(f"Ambiguous source label: {name}")
    return {
        "source_label_id": int(value),
        "name": name,
        "color": color,
        "hemisphere": hemisphere,
        "kind": "cortex" if cortex else "tissue",
        "region_id": matches[0]["id"] if matches else None,
    }


def project_surface_atlas(config, atlas, image, codes, labels, regions):
    """A surface atlas on the cut: each ribbon voxel takes its nearest pial or white vertex's label.

    Cortex outside the ribbon takes the annotation's entry 0, its unlabelled one.
    """
    ribbon_image = nib.load(config["source_directory"] / "mri/ribbon.mgz")
    validate_same_grid(ribbon_image, image)
    source = np.asarray(image.dataobj)
    affine = image.header.get_vox2ras_tkr()
    ribbon = np.asarray(ribbon_image.dataobj)
    projected = codes.copy()
    for prefix, hemisphere, lower, ribbon_label in [
        ("lh", "left", 11100, 3),
        ("rh", "right", 12100, 42),
    ]:
        annotation, colors, names = read_annot(
            config["source_directory"] / "label" / f"{prefix}.{atlas['annotation']}.annot"
        )
        published = {
            region["source_label_id"]: region
            for region in regions
            if region["atlas"] == atlas["id"] and region["hemisphere"] == hemisphere
        }
        lookup = {}
        for label_id, name in enumerate(names):
            # A table entry no vertex of this brain carries has no region.
            region = published.get(label_id, {"kind": "non-region"})
            lookup[label_id] = len(labels)
            labels.append(
                {
                    "source_label_id": label_id,
                    "name": name.decode(),
                    "color": colors[label_id, :3].tolist(),
                    "hemisphere": hemisphere,
                    "kind": "cortex",
                    "region_id": region["id"] if region["kind"] == "cortex" else None,
                }
            )
        mask = (source > lower) & (source < lower + 100)
        unknown = lookup[0]
        if labels[unknown]["region_id"] is not None:
            raise ValueError(f"{atlas['id']}: annotation entry 0 must be its unlabelled one")
        projected[mask] = unknown
        coordinates = np.argwhere(mask & (ribbon == ribbon_label))
        points = nib.affines.apply_affine(affine, coordinates)
        pial, _ = read_geometry(config["source_directory"] / "surf" / f"{prefix}.pial")
        white, _ = read_geometry(
            config["source_directory"] / "surf" / f"{prefix}.white"
        )
        nearest = cKDTree(np.vstack([pial, white])).query(points)[1] % len(pial)
        projected[tuple(coordinates.T)] = np.array(
            [lookup[int(label)] for label in annotation[nearest]], dtype=np.uint16
        )
    return projected


def nextbrain_limitations(config, record):
    if config[nextbrain.ATLAS_ID]["procedure"] != nextbrain.SUBJECT_SEGMENTATION:
        return [
            "NextBrain labels were nonlinearly warped from the MNI152 template to "
            + (
                "this individual; registration between an averaged template and one "
                "brain, not the published delineation, bounds their accuracy."
                if config["anatomy"]["individual"]
                else "this template; registration between two averaged brains, not "
                "the published delineation, bounds their accuracy."
            )
        ]
    if record["block"] == 1:
        return []
    spacing = f"{record['voxel_spacing_mm'][0]:g} mm"
    source = f"{record['source_voxel_spacing_mm'][0]:g} mm"
    absent = len(record["labels_absent_from_cut"])
    return [
        f"NextBrain cut faces sample {spacing} blocks of the {source} labels, each "
        "taking its most frequent label: thin structures are coarser on a cut than on "
        "their surfaces"
        + (
            f", and {absent} label{'s' if absent != 1 else ''} too small to win any "
            "block appear on no cut."
            if absent
            else "."
        )
    ]


def export_tissue_labels(config, manifest):
    source_path = config["source_directory"] / "mri/aparc.a2009s+aseg.mgz"
    image = nib.load(source_path)
    source = np.asarray(image.dataobj)
    table = read_color_table()
    values, inverse = np.unique(source, return_inverse=True)
    labels = [
        describe_source_label(int(value), table, manifest["regions"])
        for value in values
    ]
    codes = inverse.reshape(source.shape).astype(np.uint16)
    atlases = {}
    # Destrieux is the source volume's own parcellation; every other surface atlas is projected.
    for surface in config["atlases"]:
        atlas = surface["id"]
        atlas_labels = [dict(label) for label in labels]
        data = (
            codes
            if atlas == "destrieux"
            else project_surface_atlas(
                config, surface, image, codes, atlas_labels, manifest["regions"]
            )
        )
        encoded_image = nib.MGHImage(
            data.astype(np.int32), image.affine, header=image.header.copy()
        )
        record = encode_cropped_volume(
            encoded_image,
            config["output_directory"] / f"tissues-{atlas}.volume",
            np.dtype("<u2"),
        )
        record["labels"] = atlas_labels
        record["label_method"] = (
            "Original FreeSurfer aparc.a2009s+aseg labels, lossless ID encoding"
            if atlas == "destrieux"
            else "Derived nearest pial/white vertex labels, restricted to published cortical voxels AND native gray ribbon; other tissues unchanged"
        )
        atlases[atlas] = record
    if nextbrain.is_declared(config):
        atlases[nextbrain.ATLAS_ID] = nextbrain.export_atlas(
            config, manifest["regions"]
        )
    if arterial_territories.is_declared(config):
        atlases[arterial_territories.ATLAS_ID] = arterial_territories.export_cut_atlas(
            config, arterial_territories.read_definition(), image, codes,
            [dict(label) for label in labels], manifest["regions"],
        )
    if cerebellar_functions.is_declared(config):
        atlases[cerebellar_functions.ATLAS_ID] = cerebellar_functions.export_cut_atlas(
            config, cerebellar_functions.read_definition(), image, codes,
            [dict(label) for label in labels], manifest["regions"],
        )
    metadata = {
        "schema_version": 1,
        "source_sha256": sha256(source_path),
        "atlases": atlases,
        "limitations": [
            "Native 1 mm tissue labels from one individual's own segmentation; no claim of subvoxel anatomical accuracy."
            if config["anatomy"]["individual"]
            else "Native 1 mm tissue labels from an averaged segmentation; no claim of subvoxel anatomical accuracy.",
            "HCP-MMP and Julich-Brain cortical volume labels are derived ribbon-restricted projections of their surface labels, not published native volumetric atlases.",
            "Native voxel boundaries and high-resolution cortical surfaces may not coincide exactly.",
        ],
    }
    if nextbrain.ATLAS_ID in atlases:
        metadata["limitations"].extend(nextbrain_limitations(config, atlases[nextbrain.ATLAS_ID]))
    if white_matter.is_declared(config):
        metadata["white_matter"] = white_matter.export_volume(
            config, manifest["regions"]
        )
        metadata["limitations"].extend(white_matter.limitations(config))
    write_json(config["output_directory"] / "tissue-labels.json", metadata)
    return metadata


if __name__ == "__main__":
    config = read_config()
    verify_sources(config)
    manifest = json.loads((config["output_directory"] / "manifest.json").read_text())
    export_tissue_labels(config, manifest)
