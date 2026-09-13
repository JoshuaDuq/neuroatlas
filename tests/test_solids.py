"""Native solid envelopes must retain the reconstruction's exact boundaries."""

import numpy as np
import pytest
import trimesh
from nibabel.freesurfer.io import read_geometry

from brain_model.geometry import to_gltf
from brain_model.solids import export_solid_envelopes, validate_solid_envelopes
from brain_model.sources import read_config


def test_solid_envelopes_preserve_native_vertices_and_triangles(tmp_path):
    config = read_config()
    config['output_directory'] = tmp_path
    record = export_solid_envelopes(config)
    scene = trimesh.load_scene(tmp_path / record['file'], process=False)
    assert len(scene.geometry) == 4
    for prefix, hemisphere in [('lh', 'left'), ('rh', 'right')]:
        for boundary in ['pial', 'white']:
            native, faces = read_geometry(
                config['source_directory'] / 'surf' / f'{prefix}.{boundary}'
            )
            mesh = scene.geometry[f'{hemisphere}:{boundary}']
            np.testing.assert_allclose(mesh.vertices, to_gltf(native), atol=1e-8)
            np.testing.assert_array_equal(mesh.faces, faces)
            assert mesh.is_watertight
            assert mesh.is_winding_consistent
            assert mesh.volume > 0


def test_solid_validation_rejects_modified_asset(tmp_path):
    config = read_config()
    config['output_directory'] = tmp_path
    record = export_solid_envelopes(config)
    result = validate_solid_envelopes(config, record)
    assert result['identical_native_topology']
    path = tmp_path / record['file']
    path.write_bytes(path.read_bytes() + b'changed')
    with pytest.raises(ValueError, match='checksum'):
        validate_solid_envelopes(config, record)
