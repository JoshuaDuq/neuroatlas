"""Build full-resolution, selectable reference anatomy from frozen inputs."""

import argparse
import json

import nibabel as nib
import numpy as np
import trimesh
from nibabel.freesurfer.io import read_annot, read_geometry, read_morph_data

from .gltf.export import add_region, compact_region, published_area_mm2, write_scene
from .labels import (
    boundary_certainty,
    cerebellum,
    nextbrain,
    segmentation_agreement,
    white_matter,
)
from .labels.placement import placements, surface_placement
from .labels.tissue_labels import export_tissue_labels
from .labels.volumes import conformed_grid, export_volumes
from .layers import (
    arterial_territories,
    cab_np,
    cerebellar_functions,
    comparison,
    coordinate_spaces,
    functional_regions,
    learning,
    networks,
    neuropsych_domains,
    neurosynth_terms,
    receptor_fingerprints,
    spinal_cord,
)
from .sources import (
    HEMISPHERES,
    read_color_table,
    read_config,
    verify_sources,
    write_json,
)
from .surfaces.geometry import (
    extract_structure,
    partition_edges,
    partition_surface,
    partition_vertex_field,
    partition_vertex_labels,
    smooth_display,
)
from .surfaces.ribbons import export_ribbon_labels
from .surfaces.shading import cortical_concavity, ribbon_intensity
from .surfaces.solids import export_solid_envelopes


def cortical_region(atlas, hemisphere, label, name):
    # Julich-Brain marks its medial wall with two masks, and cortex it has not yet
    # mapped with gap maps; Schaefer names its medial wall a background: none is an area.
    non_region = name in {
        "Unknown", "unknown", "???", "Medial_wall", "CorpusCallosumMask", "BrainStemMask",
        "Background+FreeSurfer_Defined_Medial_Wall",
    } or name.startswith("GapMap-")
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
    vertices, faces = read_geometry(source / "surf" / f"{prefix}.pial")
    edges, _ = partition_edges(faces)
    if len(vertices) - len(edges) + len(faces) != 2:
        raise ValueError(f"{prefix}.pial is not a closed genus-zero native surface")
    return vertices, faces


def require_layer_inputs(config):
    """Every input of each declared layer; a declared layer is never left out."""
    inputs = {
        "networks": lambda: [
            networks.annotation_path(config["source_directory"], prefix)
            for prefix in HEMISPHERES
        ],
        "nextbrain": lambda: [
            *nextbrain.paths(config),
            *([boundary_certainty.path(config)] if boundary_certainty.is_published(config) else []),
        ],
        "cerebellar_lobules": lambda: [cerebellum.path(config)],
        "white_matter": lambda: [white_matter.path(config)],
        "spinal_cord": lambda: list(spinal_cord.paths(config).values()),
        "neurosynth_terms": lambda: [neurosynth_terms.DEFINITION, neurosynth_terms.SCORES],
        "arterial_territories": lambda: [
            arterial_territories.DEFINITION,
            arterial_territories.volume_path(config),
            arterial_territories.report_path(config),
        ],
        "cerebellar_functions": lambda: [
            cerebellar_functions.DEFINITION,
            cerebellar_functions.volume_path(config),
            cerebellar_functions.lobules_path(config),
            cerebellar_functions.report_path(config),
        ],
        "coordinate_spaces": lambda: [
            coordinate_spaces.DEFINITION,
            coordinate_spaces.report_path(config),
            *(coordinate_spaces.field_path(config, space)
              for space in coordinate_spaces.read_definition()["spaces"]),
        ],
    }
    missing = [
        str(path)
        for layer in config["anatomy"]["layers"]
        for path in inputs[layer]()
        if not path.exists()
    ]
    if missing:
        raise ValueError(
            f"{config['anatomy']['id']} declares layers whose inputs are missing: {missing}"
        )


def read_networks(config, prefix, vertex_count):
    if not networks.is_declared(config):
        return None
    path = networks.annotation_path(config["source_directory"], prefix)
    labels, colors, names = read_annot(path)
    if len(labels) != vertex_count:
        raise ValueError(f"{path.name} does not describe this surface's vertices")
    networks.verify_palette(colors, names, config["networks"]["maximum_color_jitter"])
    return networks.network_indices(labels, names)


def build_cortex(config, atlas, field_ranges=None):
    scene = trimesh.Scene()
    regions = []
    source = config["source_directory"]
    mri = nib.load(source / "mri/orig.mgz")
    territories = (
        arterial_territories.read_definition() if arterial_territories.is_declared(config) else None
    )
    if territories:
        territory_grid = arterial_territories.territory_index(config, territories)
    for prefix, hemisphere in HEMISPHERES.items():
        vertices, faces = read_native_surface(source, prefix)
        white, white_faces = read_geometry(source / "surf" / f"{prefix}.white")
        if not np.array_equal(faces, white_faces):
            raise ValueError(f"{prefix}: pial/white topology must correspond")
        labels, colors, names = read_annot(
            source / "label" / f"{prefix}.{atlas['annotation']}.annot"
        )
        other_names = (
            networks.published_seventeen_network_names(config, atlas, prefix)
            if "names_from" in atlas else None
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
        territory_ids = (
            arterial_territories.vertex_indices(*territory_grid, vertices, white)
            if territories else None
        )
        territory_field = (
            None if territory_ids is None
            else partition_vertex_labels(faces, labels, territory_ids)
        )
        for label in np.unique(labels):
            name = "Unknown" if label == -1 else names[label].decode()
            color = [128, 128, 128] if label == -1 else colors[label, :3].tolist()
            region = cortical_region(atlas["id"], hemisphere, label, name)
            region["source_annotation_value"] = (
                0 if label == -1 else int(colors[label, 4])
            )
            region["source_vertex_count"] = int(np.count_nonzero(labels == label))
            if other_names is not None and region["kind"] == "cortex":
                region["source_17_network_name"] = other_names[name]
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
            if territory_field is not None:
                mesh.vertex_attributes["_TERRITORY"] = (
                    territory_field[indices].astype(np.float32)
                )
                composed = arterial_territories.composition_of_counts(
                    arterial_territories.counts_of(territory_ids[labels == label], territories),
                    territories,
                )
                # The medial wall and unmapped cortex are not regions; their supply says nothing.
                if composed and region["kind"] == "cortex":
                    region.update(composed)
            region.update(
                vertex_count=len(mesh.vertices),
                triangle_count=len(mesh.faces),
                surface_area_mm2=published_area_mm2(mesh.vertices, mesh.faces),
            )
            if region["kind"] == "cortex":
                # Mid-ribbon points; the cut volume's ribbon voxels replace this where they label the parcel.
                region.update(surface_placement((vertices + white)[labels == label] / 2))
            regions.append(region)
        print(
            f"{atlas['id']} {hemisphere}: {len(vertices):,} source vertices, "
            f"{len(partition.faces):,} export triangles",
            flush=True,
        )
    filename = f"cortex-{atlas['id']}.glb"
    # The first cortical atlas measures the shading fields; the second is held
    # to the same span, so one decode in the viewer serves both files.
    ranges = write_scene(scene, config["output_directory"] / filename, ranges=field_ranges)
    return {
        **atlas,
        "file": filename,
        "field_ranges": ranges,
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


def build_structure_layer(config, grid, labels, describe, filename):
    volume = grid.labels
    if not np.all(volume == np.rint(volume)):
        raise ValueError(f"{filename}: segmentation must hold integer labels")
    affine = grid.voxel_to_surface
    voxel_volume = grid.voxel_volume_mm3
    smoothing = config["structures"]["smoothing"]
    scene = trimesh.Scene()
    regions = []
    placed = placements(volume, affine, labels)
    for label in labels:
        region, color = describe(label)
        region.update(
            voxel_count=int(np.count_nonzero(volume == label)),
            voxel_size_mm=grid.spacing_mm,
        )
        source = extract_structure(volume, label, affine)
        mesh = smooth_display(source, volume == label, affine, smoothing)
        region["display_maximum_displacement_mm"] = float(
            np.linalg.norm(mesh.vertices - source.vertices, axis=1).max()
        )
        exported = add_region(
            scene, mesh.vertices, mesh.faces, mesh.vertex_normals, region, color
        )
        region.update(
            vertex_count=len(exported.vertices),
            triangle_count=len(exported.faces),
            surface_area_mm2=published_area_mm2(exported.vertices, exported.faces),
            segmentation_volume_mm3=float(region["voxel_count"] * voxel_volume),
            # After the mesh is added: the manifest carries placements, the GLB's extras do not.
            **placed[label],
        )
        regions.append(region)
    write_scene(scene, config["output_directory"] / filename)
    return {
        "file": filename,
        "region_count": len(regions),
        "voxel_to_surface_ras_mm": affine.tolist(),
        "voxel_size_mm": grid.spacing_mm,
        "display_geometry": {
            "method": "Marching cubes, then bounded Taubin smoothing that moves "
            "no voxel centre across the surface",
            **smoothing,
            "source_volumes_unchanged": True,
        },
    }, regions


def build_structures(config):
    grid = conformed_grid(nib.load(config["source_directory"] / "mri/aseg.mgz"))
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
        config, grid, config["structures"]["labels"], describe, "structures.glb"
    )


def build_nextbrain_structures(config):
    grid, table = nextbrain.load(config)
    settings = config[nextbrain.ATLAS_ID]
    chosen = nextbrain.meshed_indices(grid, table, settings["minimum_mesh_volume_mm3"])

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

    return build_structure_layer(config, grid, chosen, describe, "nextbrain.glb")


def detail_levels(config):
    levels = [{"id": "aseg", "label": "FreeSurfer subcortical segmentation"}]
    if nextbrain.is_declared(config):
        levels.append(
            {"id": nextbrain.ATLAS_ID, "label": config[nextbrain.ATLAS_ID]["label"]}
        )
    return levels


def cut_atlases(config):
    atlases = [
        {"id": a["id"], "label": a["label"], "citation": a["citation"], "surface": True}
        for a in config["atlases"]
    ]
    if nextbrain.is_declared(config):
        settings = config[nextbrain.ATLAS_ID]
        atlases.append(
            {
                "id": nextbrain.ATLAS_ID,
                "label": settings["label"],
                "citation": settings["citation"],
                "surface": False,
                "procedure": settings["procedure"],
            }
        )
    if arterial_territories.is_declared(config):
        atlases.append(arterial_territories.cut_atlas(arterial_territories.read_definition()))
    if cerebellar_functions.is_declared(config):
        atlases.append(cerebellar_functions.cut_atlas(cerebellar_functions.read_definition()))
    return atlases


def territory_grids(config):
    """The label grids whose regions take territory shares: by atlas, and the teaching set's own.

    The teaching set clips some aseg units below a NextBrain floor, so its units are counted on
    the grids it builds from, not on aseg's whole labels.
    """
    grids = {"aseg": conformed_grid(nib.load(config["source_directory"] / "mri/aseg.mgz"))}
    units = {}
    if white_matter.is_declared(config):
        grids["wmparc"] = conformed_grid(nib.load(white_matter.path(config)))
    if nextbrain.is_declared(config):
        source = nextbrain.load(config)
        grids["nextbrain"] = source[0]
        units = {name: grid for name, grid, _, _ in learning.source_groups(config, source)}
    if cerebellum.is_declared(config):
        grids["cerebnet"] = cerebellum.load(config)
    pair = lambda grid: (grid.labels.astype(np.int64), grid.voxel_to_surface)
    return ({atlas: pair(grid) for atlas, grid in grids.items()},
            {source: pair(grid) for source, grid in units.items()})


def anatomy_record(config):
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
    if "reconstruction" in config["anatomy"]:
        report = config["anatomy"]["reconstruction"]["provenance"]
        reconstruction = json.loads((config["source_directory"] / report).read_text())
        limitations.extend(reconstruction["limitations"])
    return limitations


def resolution_limitations(config, fine):
    aseg = "FreeSurfer's subcortical segmentation uses a 1 mm grid; fine nuclei and cerebellar folia are unresolved in it."
    if fine is None:
        return [aseg]
    spacing = f"{fine['voxel_size_mm'][0]:g} mm"
    if config[nextbrain.ATLAS_ID]["procedure"] != nextbrain.SUBJECT_SEGMENTATION:
        return [
            aseg,
            f"NextBrain labels were warped from MNI152 onto this brain's {spacing} grid; the template's anatomy, not this brain's, sets their boundaries wherever the registration cannot.",
        ]
    return [
        aseg,
        f"NextBrain labels are this brain's own Bayesian segmentation at {spacing}, estimated from a 1 mm T1 with a histological atlas as prior: where neighbouring structures share their T1 contrast, the atlas rather than the scan places the boundary between them.",
    ]


def boundary_certainty_limitations(config):
    if not boundary_certainty.is_published(config):
        return []
    return [
        f"Boundary certainty is NextBrain's competition between its own labels: the share of a boundary where its two most probable labels were within {config[nextbrain.ATLAS_ID]['near_tie_margin']:g} of each other. It is conditional on one registration and is not agreement with another segmentation; a confident boundary can still be misplaced.",
        "Boundaries across the midline are not rated: each hemisphere is segmented separately and joined.",
    ]


def cerebellum_limitations(config):
    limitations = [
        "Learning publishes the cerebellar cortex and the deep nuclei, but not cerebellar white matter, which would enclose the nuclei; the nuclei therefore sit in the space it occupies.",
    ]
    if not cerebellum.is_declared(config):
        return [
            *limitations,
            "Learning units come from two segmentations of the same brain, so an aseg-sourced and a NextBrain-sourced surface can overlap slightly where they meet.",
        ]
    return [
        *limitations,
        "Learning cerebellar lobules are FastSurfer CerebNet's segmentation of this brain's 1 mm T1 in SUIT nomenclature; vermis I–V is part of lobules I–IV and V, and folia are not resolved.",
        "Cerebellar lobules are published as teaching surfaces only; MRI cuts carry no lobule labels.",
        "Learning units come from three segmentations of the same brain (aseg, NextBrain and CerebNet), so surfaces from different sources can overlap slightly where they meet.",
    ]


def network_limitations(config):
    if not networks.is_declared(config):
        return []
    limitations = [
        "Networks describe group resting-state functional connectivity from 1000 subjects, not a region's measured function in this brain.",
        "Cortical parcel network shares count assigned source vertices; NextBrain cortical region shares count assigned projected cortical voxels. Unassigned samples are excluded. Neither is a surface-area fraction.",
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
    require_layer_inputs(config)
    if nextbrain.is_declared(config):
        nextbrain.verify_procedure(config, provenance)
    if boundary_certainty.is_published(config):
        boundary_certainty.verify_margin(config, provenance)
    atlas_metadata = []
    regions = []
    field_ranges = None
    for atlas in config["atlases"]:
        metadata, cortex = build_cortex(config, atlas, field_ranges)
        field_ranges = metadata.pop("field_ranges") or field_ranges
        metadata["ribbon_labels"] = export_ribbon_labels(config, atlas, cortex)
        atlas_metadata.append(metadata)
        regions.extend(cortex)
    coarse, internal = build_structures(config)
    regions.extend(internal)
    levels = [{**level} for level in detail_levels(config)]
    levels[0].update(coarse)
    fine = None
    if nextbrain.is_declared(config):
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
    if white_matter.is_declared(config):
        regions.extend(white_matter.build_regions(config))
    export_volumes(config)
    cord_layers = []
    if spinal_cord.is_declared(config):
        cord = spinal_cord.load(config)
        built, cord_regions = build_structure_layer(
            config, cord, sorted(spinal_cord.label_table(config)),
            spinal_cord.describer(config), "spinal-cord.glb",
        )
        path = config["output_directory"] / built["file"]
        cord_layers = [spinal_cord.layer(config, built, cord_regions, path)]
        regions.extend(cord_regions)
    if arterial_territories.is_declared(config) or cerebellar_functions.is_declared(config):
        grids = territory_grids(config)
    if arterial_territories.is_declared(config):
        territories = arterial_territories.read_definition()
        regions.extend(arterial_territories.build_regions(config, territories))
        arterial_territories.compose(config, territories, regions, *grids)
    if cerebellar_functions.is_declared(config):
        cerebellar = cerebellar_functions.read_definition()
        regions.extend(cerebellar_functions.build_regions(config, cerebellar))
        cerebellar_functions.compose(config, cerebellar, regions, grids[0])
    manifest = {
        "supplemental_layers": cord_layers,
        "volumes": {"file": "volumes.json"},
        "tissues": {"file": "tissue-labels.json"},
        "solid_envelopes": export_solid_envelopes(config),
        "schema_version": 1,
        "appearance": {**config["appearance"], "field_ranges": field_ranges or {}},
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
        "networks": networks.metadata() if networks.is_declared(config) else None,
        "cab_np": cab_np.export(config, regions),
        "functional_regions": functional_regions.export(config, regions),
        "neuropsych_domains": neuropsych_domains.export(config, regions),
        "neurosynth_terms": neurosynth_terms.export(config, regions),
        "receptor_fingerprints": receptor_fingerprints.export(config, regions),
        **(
            {"boundary_certainty": boundary_certainty.export(config, regions)}
            if boundary_certainty.is_published(config)
            else {}
        ),
        **(
            {"segmentation_agreement": segmentation_agreement.export(config, regions)}
            if nextbrain.is_declared(config)
            else {}
        ),
        **(
            {"arterial_territories": arterial_territories.metadata(config, territories)}
            if arterial_territories.is_declared(config)
            else {}
        ),
        **(
            {"cerebellar_functions": cerebellar_functions.metadata(config, cerebellar)}
            if cerebellar_functions.is_declared(config)
            else {}
        ),
        **(
            {"coordinate_spaces": coordinate_spaces.export(config, coordinate_spaces.read_definition())}
            if coordinate_spaces.is_declared(config)
            else {}
        ),
        "cut_atlases": cut_atlases(config),
        "detail_levels": levels,
        "regions": regions,
        "boundary_convention": "Barycentric vertex cells on mixed-label triangles",
        "limitations": [
            *(spinal_cord.limitations(config) if cord_layers else []),
            *anatomy_limitations(config),
            "Destrieux labels identify gyri and sulci; HCP labels identify multimodal areas.",
            "Subvertex label boundaries are visualization conventions, not measured boundaries.",
            *resolution_limitations(config, fine),
            f"Learning anatomy is a derived overview of explicit label unions, with display smoothing bounded to {learning.read_definition(config)['smoothing']['maximum_displacement_mm']:g} mm. Measurements remain source-voxel counts; smoothness does not add anatomical resolution.",
            "Learning brainstem territories omit separately displayed nuclei and pathways; they are not complete brainstem subdivisions.",
            *cerebellum_limitations(config),
            "NextBrain nuclei below the geometry threshold, its white matter, its cerebellar cortical layers and its cortical parcels have no mesh and remain cut labels only.",
            "Only one internal-anatomy detail level is drawn at a time; the coarse and fine layers segment the same anatomy.",
            f"Internal solids are marching-cubes surfaces smoothed for display by at most {config['structures']['smoothing']['maximum_displacement_mm']:g} mm and never across a voxel centre; between voxel centres their boundaries are a display convention, not a measurement.",
            "Where a segmented structure meets itself at a corner its surface pinches there and is not a two-manifold; validation counts those edges, and the volume each surface encloses stays definite.",
            "NextBrain cortical parcels are published as ctx-rh- names for both hemispheres, an artefact of the reused label block; the hemisphere field is authoritative.",
            *boundary_certainty_limitations(config),
            *(segmentation_agreement.limitations() if nextbrain.is_declared(config) else []),
            "Cortical regions are surface patches; the solids that cap them at a cut are closed by extruding each patch to its corresponding white-surface vertices.",
            "Each region's centroid is the mean of its voxel centres (a cortical parcel's, of its voxels in the cortical ribbon), and can lie outside a curved region; its anchor, where the linked MRI and a cut go to show it, is its own voxel nearest that centroid. A parcel no ribbon voxel carries is placed by its mid-ribbon surface points instead.",
            "A cut assigns each source triangle to the parcel holding most of its vertices, so a parcel boundary on a cut can differ from the surface's barycentric boundary by one triangle.",
            *network_limitations(config),
            *cab_np.limitations(),
            *functional_regions.limitations(),
            *neuropsych_domains.limitations(),
            *neurosynth_terms.limitations(config),
            *receptor_fingerprints.limitations(),
            *white_matter.limitations(config),
            *(arterial_territories.limitations() if arterial_territories.is_declared(config) else []),
            *(cerebellar_functions.limitations() if cerebellar_functions.is_declared(config) else []),
            *(coordinate_spaces.limitations(coordinate_spaces.read_definition())
              if coordinate_spaces.is_declared(config) else []),
        ],
        "provenance": provenance,
    }
    tissues = export_tissue_labels(config, manifest)
    if nextbrain.ATLAS_ID in tissues["atlases"]:
        nextbrain.mark_uncut(manifest["regions"], tissues["atlases"][nextbrain.ATLAS_ID])
    if comparison.is_enabled(config):
        comparison.attach_comparisons(config, manifest)
    write_json(config["output_directory"] / "manifest.json", manifest)
    published = write_anatomy_index(config)
    print(f"Exported {len(regions)} meshes including explicit non-region surfaces.")
    print(f"Published anatomies: {', '.join(entry['id'] for entry in published)}")


if __name__ == "__main__":
    main()
