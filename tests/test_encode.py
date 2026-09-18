import json
import struct

import numpy as np
import pytest
import trimesh

from brain_model.encode import (
    INT16,
    UINT8,
    UINT16,
    decode_field,
    decode_normals,
    field_tolerance,
    normal_tolerance,
    published_field_ranges,
    reencode,
)
from brain_model.export import add_region


def read_json_chunk(data):
    length = struct.unpack_from("<I", data, 12)[0]
    return json.loads(data[20 : 20 + length])


def cortical_scene(parcels=3, vertices_per=40, seed=0):
    """A scene shaped like a cortical layer: several parcels, all four fields."""
    rng = np.random.default_rng(seed)
    scene = trimesh.Scene()
    for parcel in range(parcels):
        points = rng.normal(scale=8.0, size=(vertices_per, 3))
        faces = np.array(
            [[i, (i + 1) % vertices_per, (i + 2) % vertices_per]
             for i in range(vertices_per)]
        )
        normals = points / np.linalg.norm(points, axis=1, keepdims=True)
        region = {
            "id": f"destrieux:left:{parcel}",
            "label": f"Parcel {parcel}",
            "atlas": "destrieux",
            "hemisphere": "left",
            "source_label_id": parcel,
            "kind": "cortex",
        }
        mesh = add_region(scene, points, faces, normals, region, [10, 20, 30])
        mesh.vertex_attributes["_SULC"] = rng.normal(size=vertices_per).astype(np.float32)
        mesh.vertex_attributes["_CONCAVITY"] = rng.normal(
            scale=0.3, size=vertices_per
        ).astype(np.float32)
        mesh.vertex_attributes["_T1"] = rng.uniform(
            40, 190, size=vertices_per
        ).astype(np.float32)
        mesh.vertex_attributes["_NETWORK"] = rng.integers(
            0, 8, size=vertices_per
        ).astype(np.float32)
    return scene


def exported(scene):
    from trimesh.exchange.gltf import export_glb

    return export_glb(scene, include_normals=True)


def primitives(gltf):
    for mesh in gltf["meshes"]:
        yield from mesh["primitives"]


def test_positions_and_triangles_survive_byte_for_byte():
    # The whole fidelity claim: a re-encoded file describes the same geometry,
    # not a close one. Positions keep float32 and indices keep their values.
    raw = exported(cortical_scene())
    packed, _ = reencode(raw)
    before = trimesh.load(
        trimesh.util.wrap_as_stream(raw), file_type="glb", process=False
    )
    after = trimesh.load(
        trimesh.util.wrap_as_stream(packed), file_type="glb", process=False
    )
    assert set(before.geometry) == set(after.geometry)
    for name, original in before.geometry.items():
        np.testing.assert_array_equal(
            original.vertices.astype(np.float32),
            after.geometry[name].vertices.astype(np.float32),
        )
        np.testing.assert_array_equal(original.faces, after.geometry[name].faces)


def test_indices_narrow_to_uint16_and_network_to_uint8():
    packed, _ = reencode(exported(cortical_scene()))
    gltf = read_json_chunk(packed)
    for primitive in primitives(gltf):
        assert gltf["accessors"][primitive["indices"]]["componentType"] == UINT16
        network = primitive["attributes"]["_NETWORK"]
        assert gltf["accessors"][network]["componentType"] == UINT8
        assert not gltf["accessors"][network].get("normalized")


def test_network_indices_are_carried_unchanged():
    # A Yeo index is an identifier. Rounding one would rename a network.
    raw = exported(cortical_scene())
    packed, _ = reencode(raw)
    before = trimesh.load(
        trimesh.util.wrap_as_stream(raw), file_type="glb", process=False
    )
    after = trimesh.load(
        trimesh.util.wrap_as_stream(packed), file_type="glb", process=False
    )
    for name, original in before.geometry.items():
        np.testing.assert_array_equal(
            original.vertex_attributes["_NETWORK"].astype(np.uint8),
            after.geometry[name].vertex_attributes["_NETWORK"],
        )


def test_shading_fields_decode_within_the_encoding_bound():
    raw = exported(cortical_scene())
    packed, ranges = reencode(raw)
    before = trimesh.load(
        trimesh.util.wrap_as_stream(raw), file_type="glb", process=False
    )
    after = trimesh.load(
        trimesh.util.wrap_as_stream(packed), file_type="glb", process=False
    )
    for field, span in ranges.items():
        for name, original in before.geometry.items():
            decoded = decode_field(
                after.geometry[name].vertex_attributes[field], span
            )
            error = np.abs(decoded - original.vertex_attributes[field]).max()
            assert error <= field_tolerance(span)


def test_normals_decode_to_unit_vectors_within_the_encoding_bound():
    raw = exported(cortical_scene())
    packed, _ = reencode(raw)
    before = trimesh.load(
        trimesh.util.wrap_as_stream(raw), file_type="glb", process=False
    )
    after = trimesh.load(
        trimesh.util.wrap_as_stream(packed), file_type="glb", process=False
    )
    gltf = read_json_chunk(packed)
    for primitive in primitives(gltf):
        accessor = gltf["accessors"][primitive["attributes"]["NORMAL"]]
        assert accessor["componentType"] == INT16
        assert accessor["normalized"] is True
    for name, original in before.geometry.items():
        decoded = decode_normals(after.geometry[name].vertex_normals)
        assert np.abs(decoded - original.vertex_normals).max() <= normal_tolerance()


def test_quantized_normals_require_the_extension_that_defines_them():
    # A reader without it would take int16 normals at face value rather than
    # fail, so declaring it as merely used would not be enough.
    gltf = read_json_chunk(reencode(exported(cortical_scene()))[0])
    assert "KHR_mesh_quantization" in gltf["extensionsRequired"]
    assert "KHR_mesh_quantization" in gltf["extensionsUsed"]


def test_a_file_can_decline_both_quantizing_steps():
    packed, ranges = reencode(
        exported(cortical_scene()), normals=False, fields=False
    )
    gltf = read_json_chunk(packed)
    assert ranges == {}
    assert "extensionsRequired" not in gltf
    for primitive in primitives(gltf):
        # Indices and the network index narrow either way: both are exact.
        assert gltf["accessors"][primitive["indices"]]["componentType"] == UINT16
        assert gltf["accessors"][primitive["attributes"]["_NETWORK"]][
            "componentType"
        ] == UINT8


def test_a_shared_range_is_used_rather_than_the_files_own():
    # Two cortical files carry the same fields, and one decode in the viewer
    # serves both only if the build holds the second to the first's span.
    _, ranges = reencode(exported(cortical_scene(seed=1)))
    second, reused = reencode(exported(cortical_scene(seed=1)), ranges=ranges)
    assert reused == ranges
    assert read_json_chunk(second)["extras"]["field_ranges"] == ranges


def test_a_value_outside_a_given_range_is_refused_rather_than_clamped():
    ranges = {"_SULC": [0.0, 0.1], "_CONCAVITY": [-1.0, 1.0], "_T1": [0.0, 255.0]}
    with pytest.raises(ValueError, match="outside the given range"):
        reencode(exported(cortical_scene(seed=2)), ranges=ranges)


def test_a_file_without_recorded_ranges_reads_straight_through(tmp_path):
    path = tmp_path / "plain.glb"
    path.write_bytes(exported(cortical_scene()))
    spans = published_field_ranges(path)
    assert all(span == [0.0, 1.0] for span in spans.values())
    values = np.array([0.0, 0.25, 1.0])
    np.testing.assert_allclose(decode_field(values * 65535, spans["_SULC"]), values)


def test_a_constant_field_still_decodes_to_the_value_it_had():
    scene = cortical_scene(parcels=1)
    mesh = next(iter(scene.geometry.values()))
    flat = np.full(len(mesh.vertices), 3.5, dtype=np.float32)
    mesh.vertex_attributes["_SULC"] = flat
    packed, ranges = reencode(exported(scene))
    after = trimesh.load(
        trimesh.util.wrap_as_stream(packed), file_type="glb", process=False
    )
    decoded = decode_field(
        next(iter(after.geometry.values())).vertex_attributes["_SULC"].ravel(),
        ranges["_SULC"],
    )
    np.testing.assert_allclose(decoded, flat, atol=1e-6)


def test_accessors_shared_between_surfaces_stay_shared():
    # The pial and white envelopes of one hemisphere are the same triangles
    # over different vertices and share one index accessor. Writing that
    # buffer once per surface costs more than every narrowing here saves.
    import json as _json
    import struct as _struct

    scene = cortical_scene(parcels=2, vertices_per=40)
    raw = bytearray(exported(scene))
    gltf = read_json_chunk(bytes(raw))
    first, second = gltf["meshes"][0]["primitives"][0], gltf["meshes"][1]["primitives"][0]
    second["indices"] = first["indices"]
    body = _json.dumps(gltf, separators=(",", ":")).encode()
    body += b" " * (-len(body) % 4)
    length = _struct.unpack_from("<I", raw, 12)[0]
    rebuilt = (
        raw[:12]
        + _struct.pack("<II", len(body), 0x4E4F534A)
        + body
        + raw[20 + length :]
    )
    rebuilt = bytearray(rebuilt)
    _struct.pack_into("<I", rebuilt, 8, len(rebuilt))

    packed, _ = reencode(bytes(rebuilt))
    out = read_json_chunk(packed)
    primitive_list = list(primitives(out))
    assert primitive_list[0]["indices"] == primitive_list[1]["indices"]
