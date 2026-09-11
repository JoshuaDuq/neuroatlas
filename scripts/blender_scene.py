"""Assemble an editable, source-scale scene and render the reference anatomy.

Run with Blender --background --python scripts/blender_scene.py.
No modifiers, vertex relocation, decimation or generated anatomical detail.
"""

import json
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]


def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def import_collection(name, filename):
    collection = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(collection)
    existing = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / "public/models" / filename),
                              merge_vertices=False)
    for obj in set(bpy.data.objects) - existing:
        for previous in list(obj.users_collection):
            previous.objects.unlink(obj)
        collection.objects.link(obj)
        if obj.type == "MESH":
            obj["source_atlas_color"] = list(obj.data.materials[0].diffuse_color)
            obj["geometry_policy"] = "Source-derived positions; no geometry modifiers"
            obj.name = obj.get("label", obj.name)
    return collection


def create_material(name, color):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = (*color, 1)
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = .54
    shader.inputs["IOR"].default_value = 1.4
    shader.inputs["Specular IOR Level"].default_value = .32
    return material


def add_area(name, location, power, size, color):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = power
    data.shape = "DISK"
    data.size = size
    data.color = color
    light = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(light)
    light.location = location
    point_at(light, (0, -.015, .01))


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1
    anatomy = import_collection("01 · Anatomical cortex · Destrieux", "cortex-destrieux.glb")
    function = import_collection("02 · Multimodal cortex · HCP-MMP", "cortex-hcp-mmp.glb")
    structures = import_collection("03 · Internal anatomy · aseg", "structures.glb")
    function.hide_render = True
    function.hide_viewport = True
    cortex = create_material("Cortex · warm ivory", (.64, .57, .46))
    internal = create_material("Internal anatomy · muted stone", (.49, .46, .41))
    medial = create_material("Non-region · medial wall", (.33, .35, .36))
    for collection in [anatomy, function, structures]:
        for obj in collection.objects:
            if obj.type != "MESH":
                continue
            material = cortex if obj.get("kind") == "cortex" else internal
            if obj.get("kind") == "non-region":
                material = medial
            obj.data.materials.clear()
            obj.data.materials.append(material)

    camera_data = bpy.data.cameras.new("Anatomy camera")
    camera = bpy.data.objects.new("Anatomy camera", camera_data)
    scene.collection.objects.link(camera)
    camera.location = (-.32, .13, .15)
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = .245
    camera_data.clip_start = .001
    camera_data.clip_end = 10
    point_at(camera, (0, -.018, .004))
    scene.camera = camera
    add_area("Key · large softbox", (-.24, .16, .29), 7, .22, (1, .91, .78))
    add_area("Fill · cool softbox", (-.18, -.2, .05), 2.5, .2, (.72, .84, 1))
    add_area("Rim · superior", (.16, -.05, .22), 8, .16, (.78, .88, 1))
    world = bpy.data.worlds.new("Midnight studio")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (.035, .045, .065, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = .35
    scene.world = world
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 128
    scene.cycles.use_denoising = True
    scene.cycles.seed = 0
    scene.render.resolution_x = 1800
    scene.render.resolution_y = 1500
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.view_transform = "AgX"
    scene.render.film_transparent = False
    scene["coordinate_convention"] = "Blender RAS meters: +X right, +Y anterior, +Z superior"
    # Read from the manifest rather than restated: which brain is in these GLBs
    # is a build-time choice, and a scene that says otherwise outlives it.
    anatomy = json.loads((ROOT / "public/models/manifest.json").read_text())["anatomy"]
    scene["anatomy"] = anatomy["label"]
    scene["scientific_scope"] = (
        f"{anatomy['label']}; conversion fidelity, not clinical accuracy"
    )
    readme = bpy.data.texts.new("READ ME · Brain model")
    readme.write(
        "SOURCE-DERIVED BRAIN\n\n"
        "Select objects to inspect region_id, atlas, hemisphere and source_label_id.\n"
        "Enable only one cortical collection at a time to avoid overlap.\n"
        "Hide cortical collections to inspect 35 internal structures.\n"
        "Native region colors remain in source_atlas_color custom properties.\n"
        "No smoothing, subdivision or decimation modifiers are applied.\n"
        "Internal shading uses gradient normals, with all source positions unchanged.\n"
        "Cortical regions are open surface patches, not watertight solids.\n"
        "Full methodology and licenses accompany public/models.\n"
    )
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == "VIEW_3D":
                area.spaces.active.region_3d.view_perspective = "CAMERA"
                area.spaces.active.shading.type = "MATERIAL"
    output = ROOT / "deliverables"
    output.mkdir(exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output / "Brain-Atlas.blend"))
    inventory = [dict(id=obj.get("region_id"), vertices=len(obj.data.vertices),
                      faces=len(obj.data.polygons), modifiers=len(obj.modifiers))
                 for obj in bpy.data.objects if obj.type == "MESH"]
    (output / "blender-inventory.json").write_text(json.dumps(inventory, indent=2) + "\n")
    scene.render.filepath = str(output / "brain-preview.png")
    bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    main()
