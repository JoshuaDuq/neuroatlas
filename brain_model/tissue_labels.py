"""Published volumetric anatomy and explicitly ribbon-restricted HCP projection."""

import json

import nibabel as nib
import numpy as np
from nibabel.freesurfer.io import read_annot, read_geometry
from scipy.spatial import cKDTree

from . import nextbrain
from .sources import read_color_table, read_config, sha256, verify_sources, write_json
from .volumes import encode_volume


def describe_source_label(value, table, regions):
    name, color = table[value]
    hemisphere = (
        "left"
        if name.startswith(("Left-", "ctx_lh_"))
        else "right"
        if name.startswith(("Right-", "ctx_rh_"))
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
            and region["source_name"] == name[7:]
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


def project_hcp(config, source, affine, codes, labels, regions):
    ribbon_image = nib.load(config["source_directory"] / "mri/ribbon.mgz")
    if not np.array_equal(ribbon_image.header.get_vox2ras_tkr(), affine):
        raise ValueError("Cortical ribbon registration mismatch.")
    ribbon = np.asarray(ribbon_image.dataobj)
    projected = codes.copy()
    for prefix, hemisphere, lower, ribbon_label in [
        ("lh", "left", 11100, 3),
        ("rh", "right", 12100, 42),
    ]:
        annotation, colors, names = read_annot(
            config["source_directory"] / "label" / f"{prefix}.HCPMMP1.annot"
        )
        lookup = {}
        for label_id, name in enumerate(names):
            region = next(
                region
                for region in regions
                if region["atlas"] == "hcp-mmp"
                and region["hemisphere"] == hemisphere
                and region["source_label_id"] == label_id
            )
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
        unknown = next(
            code for code in lookup.values() if labels[code]["region_id"] is None
        )
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


def export_tissue_labels(config, manifest):
    source_path = config["source_directory"] / "mri/aparc.a2009s+aseg.mgz"
    image = nib.load(source_path)
    source = np.asarray(image.dataobj)
    affine = image.header.get_vox2ras_tkr()
    table = read_color_table()
    values, inverse = np.unique(source, return_inverse=True)
    labels = [
        describe_source_label(int(value), table, manifest["regions"])
        for value in values
    ]
    codes = inverse.reshape(source.shape).astype(np.uint16)
    atlases = {}
    for atlas in ["destrieux", "hcp-mmp"]:
        atlas_labels = [dict(label) for label in labels]
        data = (
            codes
            if atlas == "destrieux"
            else project_hcp(
                config, source, affine, codes, atlas_labels, manifest["regions"]
            )
        )
        encoded_image = nib.MGHImage(
            data.astype(np.int32), image.affine, header=image.header.copy()
        )
        record = encode_volume(
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
    if nextbrain.is_available(config):
        atlases[nextbrain.ATLAS_ID] = nextbrain.export_atlas(
            config, manifest["regions"]
        )
    metadata = {
        "schema_version": 1,
        "source_sha256": sha256(source_path),
        "atlases": atlases,
        "limitations": [
            "Native 1 mm reference-template tissue labels; no claim of subvoxel anatomical accuracy.",
            "HCP cortical volume labels are a derived ribbon-restricted projection, not a published native HCP volumetric atlas.",
            "Native voxel boundaries and high-resolution cortical surfaces may not coincide exactly.",
        ],
    }
    if nextbrain.ATLAS_ID in atlases:
        metadata["limitations"].append(
            "NextBrain labels were nonlinearly warped from MNI152 to fsaverage; "
            "registration error, not the published delineation, bounds their accuracy."
        )
    write_json(config["output_directory"] / "tissue-labels.json", metadata)
    return metadata


if __name__ == "__main__":
    config = read_config()
    verify_sources()
    manifest = json.loads((config["output_directory"] / "manifest.json").read_text())
    export_tissue_labels(config, manifest)
