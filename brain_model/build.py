"""Build full-resolution, selectable reference anatomy from frozen inputs."""

import nibabel as nib
import numpy as np
import trimesh
from nibabel.freesurfer.io import read_annot, read_geometry

from .export import add_region, compact_region, write_scene
from .geometry import extract_structure, partition_surface
from .sources import read_color_table, read_config, verify_sources, write_json

HEMISPHERES = {"lh": "left", "rh": "right"}


def cortical_region(atlas, hemisphere, label, name):
    non_region = name in {"Unknown", "unknown", "???", "Medial_wall"}
    display = name.replace("_", " ")
    return {
        "id": f"{atlas}:{hemisphere}:{label}",
        "label": f"{display} · {hemisphere}",
        "source_name": name,
        "atlas": atlas,
        "hemisphere": hemisphere,
        "source_label_id": int(label),
        "kind": "non-region" if non_region else "cortex",
    }


def build_cortex(config, atlas):
    scene = trimesh.Scene()
    regions = []
    for prefix, hemisphere in HEMISPHERES.items():
        source = config["source_directory"]
        vertices, faces = read_geometry(source / "surf" / f"{prefix}.pial")
        labels, colors, names = read_annot(
            source / "label" / f"{prefix}.{atlas['annotation']}.annot"
        )
        if len(vertices) != 163842 or len(faces) != 327680:
            raise ValueError("Expected full-resolution native fsaverage topology")
        partition = partition_surface(vertices, faces, labels)
        for label in np.unique(labels):
            name = "Unknown" if label == -1 else names[label].decode()
            color = [128, 128, 128] if label == -1 else colors[label, :3].tolist()
            region = cortical_region(atlas["id"], hemisphere, label, name)
            region["source_annotation_value"] = (
                0 if label == -1 else int(colors[label, 4])
            )
            region["source_vertex_count"] = int(np.count_nonzero(labels == label))
            geometry = compact_region(partition, label)
            mesh = add_region(scene, *geometry, region, color)
            region.update(
                vertex_count=len(mesh.vertices),
                triangle_count=len(mesh.faces),
                surface_area_mm2=float(mesh.area * 1e6),
            )
            regions.append(region)
        print(
            f"{atlas['id']} {hemisphere}: {len(vertices):,} source vertices, "
            f"{len(partition.faces):,} export triangles",
            flush=True,
        )
    filename = f"cortex-{atlas['id']}.glb"
    write_scene(scene, config["output_directory"] / filename)
    return {
        **atlas,
        "file": filename,
        "region_count": sum(r["kind"] == "cortex" for r in regions),
    }, regions


def build_structures(config):
    image = nib.load(config["source_directory"] / "mri/aseg.mgz")
    volume = np.asarray(image.dataobj)
    if not np.all(volume == np.rint(volume)):
        raise ValueError("aseg must contain integer-valued segmentation labels")
    affine = image.header.get_vox2ras_tkr()
    table = read_color_table()
    scene = trimesh.Scene()
    regions = []
    for label in config["structures"]["labels"]:
        name, color = table[label]
        hemisphere = "midline"
        if name.startswith("Left-"):
            hemisphere = "left"
        elif name.startswith("Right-"):
            hemisphere = "right"
        region = {
            "id": f"aseg:{hemisphere}:{label}",
            "label": name.replace("-", " "),
            "source_name": name,
            "atlas": "aseg",
            "hemisphere": hemisphere,
            "source_label_id": label,
            "kind": "structure",
            "voxel_count": int(np.count_nonzero(volume == label)),
            "voxel_size_mm": [float(x) for x in image.header.get_zooms()[:3]],
        }
        mesh = extract_structure(volume, label, affine)
        exported = add_region(
            scene, mesh.vertices, mesh.faces, mesh.vertex_normals, region, color
        )
        region.update(
            vertex_count=len(exported.vertices),
            triangle_count=len(exported.faces),
            surface_area_mm2=float(mesh.area),
            segmentation_volume_mm3=float(
                region["voxel_count"] * abs(np.linalg.det(affine[:3, :3]))
            ),
        )
        regions.append(region)
    filename = "structures.glb"
    write_scene(scene, config["output_directory"] / filename)
    return {
        "file": filename,
        "region_count": len(regions),
        "voxel_to_surface_ras_mm": affine.tolist(),
    }, regions


def main():
    config = read_config()
    provenance = verify_sources()
    atlas_metadata = []
    regions = []
    for atlas in config["atlases"]:
        metadata, cortex = build_cortex(config, atlas)
        atlas_metadata.append(metadata)
        regions.extend(cortex)
    structures, internal = build_structures(config)
    regions.extend(internal)
    manifest = {
        "schema_version": 1,
        "template": "FreeSurfer fsaverage (FreeSurfer 6)",
        "coordinate_system": {
            "units": "meters",
            "x": "right",
            "y": "superior",
            "z": "posterior",
            "source": "surface RAS (tkregister)",
            "from_surface_ras_mm": [
                [0.001, 0, 0, 0],
                [0, 0, 0.001, 0],
                [0, -0.001, 0, 0],
                [0, 0, 0, 1],
            ],
        },
        "atlases": atlas_metadata,
        "structures": structures,
        "regions": regions,
        "boundary_convention": "Barycentric vertex cells on mixed-label triangles",
        "limitations": [
            "Reference template anatomy; not individual anatomy or clinical validation.",
            "Destrieux labels identify gyri and sulci; HCP labels identify multimodal areas.",
            "HCP-MMP is the published Mills fsaverage projection, not native HCP space.",
            "Subvertex label boundaries are visualization conventions, not measured boundaries.",
            "Internal structures use an unsmoothed 1 mm label volume; fine nuclei and cerebellar folia are unresolved.",
            "Cortical regions are surface patches, not closed anatomical solids.",
        ],
        "provenance": provenance,
    }
    write_json(config["output_directory"] / "manifest.json", manifest)
    print(f"Exported {len(regions)} meshes including explicit non-region surfaces.")


if __name__ == "__main__":
    main()
