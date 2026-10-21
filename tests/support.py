"""Readers shared by test modules, kept out of the product code they check."""

import gzip

import numpy as np

from brain_model.labels.volumes import place_crop


def read_published(record, path, shape=None):
    payload = gzip.decompress(path.read_bytes())
    data = np.frombuffer(payload, dtype=record["dtype"]).reshape(
        record["shape"], order=record["order"]
    )
    return place_crop(record, data, shape)
