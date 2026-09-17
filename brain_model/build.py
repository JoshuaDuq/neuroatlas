"""Build full-resolution, selectable reference anatomy from frozen inputs."""

import argparse
import json

import nibabel as nib
import numpy as np
import trimesh
from nibabel.freesurfer.io import read_annot, read_geometry, read_morph_data

from . import learning, networks, nextbrain, spinal_cord, white_matter
from .export import add_region, compact_region, published_area_mm2, write_scene
from .geometry import (
    extract_structure,
    partition_edges,
    partition_surface,
    partition_vertex_field,
    partition_vertex_labels,
)
from .ribbons import export_ribbon_labels
from .shading import cortical_concavity, ribbon_intensity, structure_normals
from .solids import export_solid_envelopes
from .sources import (
    HEMISPHERES,
    read_color_table,
    read_config,
    verify_sources,
    write_json,
)
from .tissue_labels import export_tissue_labels
from .volumes import export_volumes


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


def read_native_surface(source, prefix):
    """The subject's own pial surface, with its native topology asserted.

    fsaverage offered one constant vertex count to compare against; an
    individual reconstruction offers none, so the check moves to the invariant
    FreeSurfer's topology correction actually guarantees: a closed genus-zero
    triangulation. That catches a partial or torn surface, not a decimated one.
    Which reconstruction this is stays pinned by the checksums `verify_sources`
    reads, not by a vertex count written here.
    """
    vertices, faces = read_geometry(source / "surf" / f"{prefix}.pial")
    edges, _ = partition_edges(faces)
    if len(vertices) - len(edges) + len(faces) != 2:
        raise ValueError(f"{prefix}.pial is not a closed genus-zero native surface")
    return vertices, faces


def read_networks(config, prefix, vertex_count):
    """This hemisphere's network index per source vertex, or None if absent.

    Read per hemisphere rather than cached across atlases: both atlases
    partition the same surface, so each gets the same field and neither has to
    know the other exists.
    """
    if not networks.is_available(config):
        return None
    path = networks.annotation_path(config["source_directory"], prefix)
    labels, colors, names = read_annot(path)
    if len(labels) != vertex_count:
        raise ValueError(f"{path.name} does not describe this surface's vertices")
    networks.verify_palette(colors, names)
    return networks.network_indices(labels, names)


def build_cortex(config, atlas):
    scene = trimesh.Scene()
    regions = []
    source = config["source_directory"]
    mri = nib.load(source / "mri/orig.mgz")
    for prefix, hemisphere in HEMISPHERES.items():
        vertices, faces = read_native_surface(source, prefix)
        white, white_faces = read_geometry(source / "surf" / f"{prefix}.white")
        if not np.array_equal(faces, white_faces):
            raise ValueError(f"{prefix}: pial/white topology must correspond")
        labels, colors, names = read_annot(
            source / "label" / f"{prefix}.{atlas['annotation']}.annot"
        )
        partition = partition_surface(vertices, faces, labels)
        sulcal_depth = partition_vertex_field(
            faces, labels, read_morph_data(source / "surf" / f"{prefix}.sulc")
        )
        concavity = partition_vertex_field(faces, labels, cortical_concavity(
            trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
        ))
        intensity = partition_vertex_field(faces, labels, ribbon_intensity(
            np.asarray(mri.dataobj), mri.header.get_vox2ras_tkr(), vertices, white
        ))
        network_ids = read_networks(config, prefix, len(vertices))
        network_field = (
            None if network_ids is None
            else partition_vertex_labels(faces, labels, network_ids)
        )
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
            indices = np.unique(partition.faces[partition.labels == label])
            mesh.vertex_attributes["_SULC"] = sulcal_depth[indices].astype(np.float32)
            mesh.vertex_attributes["_CONCAVITY"] = concavity[indices].astype(np.float32)
            mesh.vertex_attributes["_T1"] = intensity[indices].astype(np.float32)
            if network_field is not None:
                mesh.vertex_attributes["_NETWORK"] = (
                    network_field[indices].astype(np.float32)
                )
                region["networks"] = networks.composition(network_ids[labels == label])
            region.update(
                vertex_count=len(mesh.vertices),
                triangle_count=len(mesh.faces),
                surface_area_mm2=published_area_mm2(mesh.vertices, mesh.faces),
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
        "surface_shading": {
            "attribute": "_SULC",
            "source": "FreeSurfer lh.sulc / rh.sulc",
            "interpolation": "Linear on barycentric atlas partitions",
            "meaning": "Sulcal-depth morphometry; positive values mark sulci",
            "concavity": "_CONCAVITY: normal-projected one-ring displacement / mean edge length; one field-only averaging pass on the intact pial hemisphere",
            "intensity": "_T1: trilinear orig.mgz at corresponding pial/white midpoints in tkregister RAS; illustrative brightness, not measured optical albedo",
        },
    }, regions


def build_structure_layer(config, image, labels, describe, filename):
    """Marching-cubes meshes for one labelled volume, exported as a glTF layer.

    Everything geometric is identical between the coarse and fine layers, so
    they share this; `describe` supplies only what differs, the region record
    and its published colour.
    """
    volume = np.asarray(image.dataobj)
    if not np.all(volume == np.rint(volume)):
        raise ValueError(f"{filename}: segmentation must hold integer labels")
    affine = image.header.get_vox2ras_tkr()
    voxel_volume = float(abs(np.linalg.det(affine[:3, :3])))
    scene = trimesh.Scene()
    regions = []
    for label in labels:
        region, color = describe(label)
        region.update(
            voxel_count=int(np.count_nonzero(volume == label)),
            voxel_size_mm=[float(x) for x in image.header.get_zooms()[:3]],
        )
        mesh = extract_structure(volume, label, affine)
        normals = structure_normals(
            volume == label,
            affine,
            mesh.vertices,
            config["structures"]["shading_sigma_voxels"],
        )
        exported = add_region(scene, mesh.vertices, mesh.faces, normals, region, color)
        region.update(
            vertex_count=len(exported.vertices),
            triangle_count=len(exported.faces),
            surface_area_mm2=published_area_mm2(exported.vertices, exported.faces),
            segmentation_volume_mm3=float(region["voxel_count"] * voxel_volume),
        )
        regions.append(region)
    write_scene(scene, config["output_directory"] / filename)
    return {
        "file": filename,
        "region_count": len(regions),
        "voxel_to_surface_ras_mm": affine.tolist(),
        "shading": {
            "method": "Gaussian segmentation gradient normals; geometry unchanged",
            "sigma_voxels": config["structures"]["shading_sigma_voxels"],
        },
    }, regions


def build_structures(config):
    """The coarse detail level: 35 native FreeSurfer structures."""
    image = nib.load(config["source_directory"] / "mri/aseg.mgz")
    table = read_color_table()

    def describe(label):
        name, color = table[label]
        hemisphere = "midline"
        if name.startswith("Left-"):
            hemisphere = "left"
        elif name.startswith("Right-"):
            hemisphere = "right"
        return {
            "id": f"aseg:{hemisphere}:{label}",
            "label": name.replace("-", " "),
            "source_name": name,
            "atlas": "aseg",
            "hemisphere": hemisphere,
            "source_label_id": label,
            "kind": "structure",
        }, color

    return build_structure_layer(
        config, image, config["structures"]["labels"], describe, "structures.glb"
    )


def build_nextbrain_structures(config):
    """The fine detail level: NextBrain nuclei resolved well enough to have a shape."""
    image, labels, table = nextbrain.load(config)
    settings = config[nextbrain.ATLAS_ID]
    chosen = nextbrain.meshed_indices(labels, table, settings["minimum_mesh_voxels"])

    def describe(index):
        published, color = table[index]
        name = nextbrain.structure_name_of(published)
        hemisphere = nextbrain.hemisphere_of(index)
        return {
            "id": nextbrain.region_id_of(index),
            "label": f"{name.replace('_', ' ')} · {hemisphere}",
            "source_name": name,
            "source_published_name": published,
            "atlas": nextbrain.ATLAS_ID,
            "hemisphere": hemisphere,
            "source_label_id": index,
            "kind": "structure",
        }, color

    return build_structure_layer(config, image, chosen, describe, "nextbrain.glb")


def detail_levels(config):
    """The internal-anatomy layers, coarse first.

    Exactly one is drawn at a time: both segment the same anatomy, so drawing
    them together would put two thalami in the same place.
    """
    levels = [{"id": "aseg", "label": "FreeSurfer subcortical segmentation"}]
    if nextbrain.is_available(config):
        levels.append(
            {"id": nextbrain.ATLAS_ID, "label": config[nextbrain.ATLAS_ID]["label"]}
        )
    return levels


def cut_atlases(config):
    """Which label volumes a cut may sample, and whether each has a surface.

    Every surface atlas also publishes a cut volume. NextBrain publishes only a
    cut volume, so `surface` is what tells the viewer that selecting it must
    leave the cortical layer alone.
    """
    atlases = [
        {"id": a["id"], "label": a["label"], "citation": a["citation"], "surface": True}
        for a in config["atlases"]
    ]
    if nextbrain.is_available(config):
        settings = config[nextbrain.ATLAS_ID]
        atlases.append(
            {
                "id": nextbrain.ATLAS_ID,
                "label": settings["label"],
                "citation": settings["citation"],
                "surface": False,
            }
        )
    return atlases


def anatomy_record(config):
    """What brain this is, taken from the reconstruction rather than restated.

    The recon version is read from the subject's own build stamp rather than
    from the config: a version written by hand could drift away from the files
    it describes, and the stamp is the only copy the reconstruction itself
    vouches for. Not every published reconstruction ships one, so its absence is
    reported as absent instead of guessed at.

    The fields are listed rather than spread, because the anatomy declaration
    also carries local paths and unpacking instructions that are nobody's
    business once the model is built.
    """
    anatomy = config["anatomy"]
    stamp = config["source_directory"] / "scripts/build-stamp.txt"
    return {
        "id": anatomy["id"],
        "subject": anatomy["subject"],
        "display_name": anatomy["display_name"],
        "label": anatomy["label"],
        "individual": anatomy["individual"],
        "source_url": anatomy["source_url"],
        "reconstruction": stamp.read_text().strip() if stamp.exists() else None,
        "hcp_projected_from": anatomy.get("project_hcp_from"),
    }


def anatomy_limitations(config):
    """What is true of this brain in particular, rather than of the pipeline.

    Derived from the anatomy's own declaration rather than written out per
    brain, because a published limitation that quietly describes a different
    model than the one built is worse than no limitation at all.
    """
    if config["anatomy"]["individual"]:
        limitations = [
            "One published individual's anatomy, not an averaged template: it is nobody else's brain, and no part of it is clinically validated.",
            "Destrieux labels are this subject's own FreeSurfer parcellation.",
        ]
    else:
        limitations = [
            "An averaged reference template: it is nobody's anatomy, and no part of it is clinically validated.",
            "Destrieux labels are the template parcellation; no individual brain was measured to place them.",
        ]
    if config["anatomy"].get("project_hcp_from"):
        limitations.extend([
            "HCP-MMP is the published Mills fsaverage projection, resampled again onto this brain through FreeSurfer's registered spheres: two registrations, and native HCP space is neither of them.",
            "Labels projected between brains are bounded by that registration, not by the accuracy of the published parcellation.",
        ])
    else:
        limitations.append(
            "HCP-MMP is the published Mills fsaverage projection, not native HCP space."
        )
    return limitations


def network_limitations(config):
    """What a network share does and does not say, stated where it is published.

    Network membership is group data. On an individual it is where a
    group-average network falls on this person's folds, which is not a
    measurement of their networks; on a template no projection happens and the
    claim is only the weaker one about the template itself.
    """
    if not networks.is_available(config):
        return []
    limitations = [
        "Networks are resting-state functional connectivity from 1000 subjects: a region's share says which networks its surface falls in, not what the region does.",
        "Network shares are computed over a region's own source vertices, so they follow vertex density rather than surface area.",
    ]
    if config["anatomy"]["individual"]:
        limitations.append(
            "Networks are a group average projected onto one person's folds through registered spheres; they are not this individual's measured networks."
        )
    else:
        limitations.append(
            "Networks are published in this template's space and are not resampled, but they remain a group average of other brains."
        )
    return limitations


def write_anatomy_index(config):
    """List the brains published beside this one, for the viewer to offer.

    Built by reading the manifests actually on disk rather than the
    declarations, so the index can never offer a brain whose assets are not
    there. Each entry is what that brain's own manifest says about itself.
    """
    published = config["output_directory"].parent
    entries = []
    for path in sorted(published.glob("*/manifest.json")):
        anatomy = json.loads(path.read_text())["anatomy"]
        entries.append(
            {
                field: anatomy[field]
                for field in ("id", "display_name", "label", "individual")
            }
        )
    write_json(
        published / "anatomies.json",
        {"default": config["default_anatomy"], "anatomies": entries},
    )
    return entries


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--anatomy", help="build this declared anatomy instead of the selected one"
    )
    config = read_config(parser.parse_args().anatomy)
    provenance = verify_sources(config)
    atlas_metadata = []
    regions = []
    for atlas in config["atlases"]:
        metadata, cortex = build_cortex(config, atlas)
        metadata["ribbon_labels"] = export_ribbon_labels(config, atlas, cortex)
        atlas_metadata.append(metadata)
        regions.extend(cortex)
    coarse, internal = build_structures(config)
    regions.extend(internal)
    levels = [{**level} for level in detail_levels(config)]
    levels[0].update(coarse)
    if nextbrain.is_available(config):
        fine, nuclei = build_nextbrain_structures(config)
        levels[1].update(fine)
        regions.extend(nuclei)
        overview, learning_regions = learning.build(config)
        levels.append(overview)
        regions.extend(learning_regions)
        # Whatever earned geometry is published as a structure, so it must not
        # also be published as a cut-only region under the same identifier.
        regions.extend(
            nextbrain.build_regions(
                config, skip=[region["source_label_id"] for region in nuclei]
            )
        )
    if white_matter.is_available(config):
        regions.extend(white_matter.build_regions(config))
    export_volumes(config)
    cord_layers, cord_regions = [], []
    if spinal_cord.is_available(config):
        layer, cord_regions = spinal_cord.build(config)
        cord_layers = [layer]
        regions.extend(cord_regions)
    manifest = {
        "supplemental_layers": cord_layers,
        "volumes": {"file": "volumes.json"},
        "tissues": {"file": "tissue-labels.json"},
        "solid_envelopes": export_solid_envelopes(config),
        "schema_version": 1,
        "appearance": config["appearance"],
        "anatomy": anatomy_record(config),
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
        "networks": networks.metadata() if networks.is_available(config) else None,
        "cut_atlases": cut_atlases(config),
        "detail_levels": levels,
        "regions": regions,
        "boundary_convention": "Barycentric vertex cells on mixed-label triangles",
        "limitations": [
            *(spinal_cord.limitations(config) if cord_regions else []),
            *anatomy_limitations(config),
            "Destrieux labels identify gyri and sulci; HCP labels identify multimodal areas.",
            "Subvertex label boundaries are visualization conventions, not measured boundaries.",
            "Source internal segmentations use a 1 mm grid; fine nuclei and cerebellar folia are unresolved.",
            "Learning anatomy is a derived overview of explicit label unions, with display smoothing bounded to 0.6 mm. Measurements remain source-voxel counts; smoothness does not add anatomical resolution.",
            "Learning brainstem territories omit separately displayed nuclei and pathways; they are not complete brainstem subdivisions.",
            "Learning publishes the cerebellar cortical mantle and the deep nuclei, but not cerebellar white matter, which would enclose the nuclei; the nuclei therefore sit in the space it occupies.",
            "Learning units come from two segmentations of the same brain, so an aseg-sourced and a NextBrain-sourced surface can overlap slightly where they meet.",
            "NextBrain nuclei below the geometry threshold, its white matter, its cerebellar cortical layers and its cortical parcels have no mesh and remain cut labels only.",
            "Only one internal-anatomy detail level is drawn at a time; the coarse and fine layers segment the same anatomy.",
            "Solid nuclei are marching-cubes surfaces over a warped 1 mm grid, not measured boundaries.",
            "Where a segmented structure meets itself at a corner its surface pinches there and is not a two-manifold; validation counts those edges, and the volume each surface encloses stays definite.",
            "NextBrain cortical parcels are published as ctx-rh- names for both hemispheres, an artefact of the reused label block; the hemisphere field is authoritative.",
            "Cortical regions are surface patches; the solids that cap them at a cut are closed by extruding each patch to its corresponding white-surface vertices.",
            "A cut assigns each source triangle to the parcel holding most of its vertices, so a parcel boundary on a cut can differ from the surface's barycentric boundary by one triangle.",
            *network_limitations(config),
            *white_matter.limitations(config),
        ],
        "provenance": provenance,
    }
    export_tissue_labels(config, manifest)
    write_json(config["output_directory"] / "manifest.json", manifest)
    published = write_anatomy_index(config)
    print(f"Exported {len(regions)} meshes including explicit non-region surfaces.")
    print(f"Published anatomies: {', '.join(entry['id'] for entry in published)}")


if __name__ == "__main__":
    main()
