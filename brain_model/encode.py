"""Container re-encoding for published glTF meshes."""

import json
import struct

import numpy as np

# Fields quantized against one range per file, so a parcel's values stay
# comparable with every other parcel's. Per-primitive ranges would make the
# same sulcal depth decode differently either side of a region boundary.
QUANTIZED_FIELDS = ("_SULC", "_CONCAVITY", "_T1")

FLOAT32 = 5126
UINT32 = 5125
UINT16 = 5123
UINT8 = 5121
INT16 = 5122

COMPONENTS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}
COMPONENT_BYTES = {5120: 1, UINT8: 1, INT16: 2, UINT16: 2, UINT32: 4, FLOAT32: 4}

_GLB_MAGIC = 0x46546C67
_JSON_CHUNK = 0x4E4F534A
_BIN_CHUNK = 0x004E4942

# Quantizing a normal to int16 costs about 1.5e-5 per component; to int8 it
# would cost 4e-3. The wider one keeps the shading field measurably close to
# the source for a quarter of the file's former normal payload.
_NORMAL_SCALE = 32767


def decode_normals(values):
    array = np.asarray(values, dtype=np.float64)
    quantized = np.abs(array).max(initial=0.0) > 1.5
    return array / _NORMAL_SCALE if quantized else array


def decode_field(values, span):
    low, high = span
    return np.asarray(values, dtype=np.float64) / 65535 * (high - low) + low


def _float32_step(magnitude):
    return float(np.spacing(np.float32(magnitude)))


def normal_tolerance():
    return 1.0 / (2 * _NORMAL_SCALE) + _float32_step(1.0)


def field_tolerance(span):
    low, high = span
    return (high - low) / (2 * 65535) + _float32_step(max(abs(low), abs(high)))


def _read_glb(data):
    magic, _version, _length = struct.unpack_from("<III", data, 0)
    if magic != _GLB_MAGIC:
        raise ValueError("not a GLB")
    offset = 12
    gltf = None
    buffer = b""
    while offset < len(data):
        chunk_length, chunk_type = struct.unpack_from("<II", data, offset)
        payload = data[offset + 8 : offset + 8 + chunk_length]
        if chunk_type == _JSON_CHUNK:
            gltf = json.loads(payload)
        elif chunk_type == _BIN_CHUNK:
            buffer = payload
        offset += 8 + chunk_length + (-chunk_length % 4)
    if gltf is None:
        raise ValueError("GLB has no JSON chunk")
    return gltf, buffer


def _write_glb(gltf, buffer):
    buffer = buffer + b"\x00" * (-len(buffer) % 4)
    raw = json.dumps(gltf, separators=(",", ":")).encode()
    raw = raw + b" " * (-len(raw) % 4)
    header = struct.pack("<III", _GLB_MAGIC, 2, 12 + 8 + len(raw) + 8 + len(buffer))
    return b"".join([
        header,
        struct.pack("<II", len(raw), _JSON_CHUNK),
        raw,
        struct.pack("<II", len(buffer), _BIN_CHUNK),
        buffer,
    ])


def _accessor_array(gltf, buffer, index):
    accessor = gltf["accessors"][index]
    view = gltf["bufferViews"][accessor["bufferView"]]
    count = accessor["count"] * COMPONENTS[accessor["type"]]
    start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    dtype = {FLOAT32: "<f4", UINT32: "<u4", UINT16: "<u2", UINT8: "u1", INT16: "<i2"}[
        accessor["componentType"]
    ]
    return np.frombuffer(buffer, dtype=dtype, count=count, offset=start)


def field_ranges(gltf, buffer):
    seen = {name: [] for name in QUANTIZED_FIELDS}
    for mesh in gltf.get("meshes", []):
        for primitive in mesh["primitives"]:
            for name in QUANTIZED_FIELDS:
                index = primitive["attributes"].get(name)
                if index is not None:
                    seen[name].append(_accessor_array(gltf, buffer, index))
    ranges = {}
    for name, arrays in seen.items():
        if not arrays:
            continue
        values = np.concatenate(arrays)
        low, high = float(values.min()), float(values.max())
        # A field that never varies would divide by zero on decode; give it a
        # unit span so every vertex decodes back to the one value it had.
        ranges[name] = [low, high if high > low else low + 1.0]
    return ranges


class _Builder:
    def __init__(self):
        self.blobs = []
        self.length = 0
        self.views = []
        self.accessors = []

    def add(self, array, component_type, kind, *, normalized=False, target=None):
        payload = array.tobytes()
        padding = -self.length % 4
        if padding:
            self.blobs.append(b"\x00" * padding)
            self.length += padding
        view = {"buffer": 0, "byteOffset": self.length, "byteLength": len(payload)}
        if target is not None:
            view["target"] = target
        self.blobs.append(payload)
        self.length += len(payload)
        self.views.append(view)
        accessor = {
            "bufferView": len(self.views) - 1,
            "componentType": component_type,
            "count": len(array) // COMPONENTS[kind],
            "type": kind,
        }
        if normalized:
            accessor["normalized"] = True
        self.accessors.append(accessor)
        return len(self.accessors) - 1


def reencode(data, *, ranges=None, normals=True, fields=True):
    gltf, buffer = _read_glb(data)
    if not fields:
        ranges = {}
    elif ranges is None:
        ranges = field_ranges(gltf, buffer)
    else:
        present = field_ranges(gltf, buffer)
        ranges = {name: span for name, span in ranges.items() if name in present}
    out = _Builder()
    quantized_normals = False
    # Surfaces that share a source accessor must go on sharing it. The pial
    # and white envelopes of one hemisphere are the same triangles over
    # different vertices, and writing that index buffer twice would add more
    # than every narrowing here removes.
    written = {}

    for mesh in gltf.get("meshes", []):
        for primitive in mesh["primitives"]:
            attributes = {}
            for name, index in primitive["attributes"].items():
                if (name, index) in written:
                    attributes[name] = written[name, index]
                    continue
                values = _accessor_array(gltf, buffer, index)
                source = gltf["accessors"][index]
                if name == "POSITION":
                    # Copied verbatim, min/max included: this is the claim.
                    new = out.add(values, FLOAT32, "VEC3", target=34962)
                    out.accessors[new]["min"] = source["min"]
                    out.accessors[new]["max"] = source["max"]
                    attributes[name] = new
                elif name == "NORMAL" and normals:
                    unit = values.reshape(-1, 3).astype(np.float64)
                    packed = np.clip(
                        np.rint(unit * _NORMAL_SCALE), -_NORMAL_SCALE, _NORMAL_SCALE
                    ).astype("<i2")
                    attributes[name] = out.add(
                        packed.ravel(), INT16, "VEC3", normalized=True, target=34962
                    )
                    quantized_normals = True
                elif name == "_NETWORK":
                    codes = np.rint(values).astype(np.uint8)
                    if not np.array_equal(codes.astype(np.float32), values):
                        raise ValueError("_NETWORK is not an integer index")
                    attributes[name] = out.add(codes, UINT8, "SCALAR", target=34962)
                elif name in ranges:
                    low, high = ranges[name]
                    unit = (values.astype(np.float64) - low) / (high - low)
                    # Clamping here would quietly move a vertex's value onto
                    # the end of a range that was measured somewhere else.
                    if unit.min() < 0 or unit.max() > 1:
                        raise ValueError(f"{name} falls outside the given range")
                    packed = np.rint(unit * 65535).astype("<u2")
                    attributes[name] = out.add(
                        packed, UINT16, "SCALAR", normalized=True, target=34962
                    )
                else:
                    attributes[name] = out.add(
                        values, source["componentType"], source["type"], target=34962
                    )
                written[name, index] = attributes[name]
            primitive["attributes"] = attributes

            if "indices" in primitive:
                source_index = primitive["indices"]
                triangles = _accessor_array(gltf, buffer, source_index)
                vertices = out.accessors[attributes["POSITION"]]["count"]
                narrow = vertices <= 65536 and int(triangles.max(initial=0)) < 65536
                if ("indices", source_index, narrow) in written:
                    primitive["indices"] = written["indices", source_index, narrow]
                    continue
                packed = triangles.astype("<u2") if narrow else triangles.astype("<u4")
                primitive["indices"] = out.add(
                    packed, UINT16 if narrow else UINT32, "SCALAR", target=34963
                )
                written["indices", source_index, narrow] = primitive["indices"]

    gltf["accessors"] = out.accessors
    gltf["bufferViews"] = out.views
    payload = b"".join(out.blobs)
    gltf["buffers"] = [{"byteLength": len(payload)}]

    if quantized_normals:
        # Normalized int16 normals are only legal under this extension, and a
        # reader without it would misread them rather than fail, so it is
        # required rather than merely used.
        for key in ("extensionsUsed", "extensionsRequired"):
            listed = gltf.setdefault(key, [])
            if "KHR_mesh_quantization" not in listed:
                listed.append("KHR_mesh_quantization")

    if ranges:
        # The decode the viewer must apply, published beside the data that
        # needs it rather than inferred from it.
        gltf.setdefault("extras", {})["field_ranges"] = ranges

    return _write_glb(gltf, payload), ranges


def published_field_ranges(path):
    gltf, _ = _read_glb(path.read_bytes())
    recorded = gltf.get("extras", {}).get("field_ranges", {})
    return {name: recorded.get(name, [0.0, 1.0]) for name in QUANTIZED_FIELDS}
