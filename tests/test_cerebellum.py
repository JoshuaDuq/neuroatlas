import nibabel as nib
import numpy as np
import pytest

from brain_model.labels import cerebellum
from brain_model.layers.learning import read_definition


def subject(tmp_path):
    """A conformed-style recon whose orig.mgz stores bytes, as FreeSurfer's does."""
    mri = tmp_path / "mri"
    mri.mkdir()
    orig = nib.MGHImage(np.zeros((4, 4, 4), np.uint8), np.eye(4))
    nib.save(orig, mri / "orig.mgz")
    nib.save(nib.MGHImage(np.zeros((4, 4, 4), np.int32), np.eye(4)), mri / "aseg.mgz")
    return {
        "source_directory": tmp_path,
        "anatomy": {"id": "test", "layers": ["cerebellar_lobules"]},
    }, nib.load(mri / "orig.mgz")


def test_lobule_ids_survive_a_byte_valued_reference_header(tmp_path):
    # orig.mgz's uchar header once clipped every Cbm_* ID to 255.
    config, orig = subject(tmp_path)
    labels = np.zeros((4, 4, 4), np.int16)
    labels[1, 1, 1], labels[2, 2, 2], labels[3, 3, 3] = 601, 631, 46
    cerebellum.save(labels, orig, cerebellum.path(config))
    np.testing.assert_array_equal(cerebellum.load(config).labels, labels)


def test_a_label_cerebnet_does_not_publish_is_refused(tmp_path):
    config, orig = subject(tmp_path)
    labels = np.zeros((4, 4, 4), np.int16)
    labels[0, 0, 0] = 89  # 601 wrapped through a byte
    cerebellum.save(labels, orig, cerebellum.path(config))
    with pytest.raises(ValueError, match="does not publish"):
        cerebellum.load(config)


def test_lobules_replace_the_undivided_mantle_only_where_declared():
    plain = read_definition({"anatomy": {"layers": []}})
    lobed = read_definition({"anatomy": {"layers": ["cerebellar_lobules"]}})
    mantle = {"cerebellar-cortex-left", "cerebellar-cortex-right"}
    assert mantle <= {unit["id"] for unit in plain["aseg"]}
    assert not plain["cerebnet"]
    assert not mantle & {unit["id"] for unit in lobed["aseg"]}
    assert {label for unit in lobed["cerebnet"] for label in unit["labels"]} == cerebellum.LOBULES
