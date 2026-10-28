"""Fetch the receptor fingerprints config/receptor-fingerprints.yaml lists.

Each EBRAINS dataset publishes a fingerprint (mean and SD per receptor), its
donors and the hemispheres sampled. The files are pinned by checksum and read,
value for value, into data/receptor-fingerprints.json, which the build reads.
A value the config withholds is checked to still be the published one.
"""

import argparse
import json
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from brain_model.layers.receptor_fingerprints import DATA, read_definition
from brain_model.sources import ROOT, sha256

CACHE = ROOT / "data/cache/receptor-fingerprints"
FINGERPRINT_COLUMNS = ["density (mean)", "density (sd)", "density (unit)"]
SUBJECT_COLUMNS = ["subject (ID)", "sex", "age (value)", "age (unit)"]
SAMPLE_COLUMNS = ["tissue sample (ID)", "hemisphere", "from subject (ID)", "pathology"]


def fetch(definition, dataset, kind):
    remote, digest = dataset[kind]
    path = CACHE / dataset["key"] / remote
    url = f"{definition['bucket'].format(key=dataset['key'])}/{remote}"
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        print(f"downloading {dataset['key']}/{remote}", flush=True)
        # Renamed only once complete, so an interrupted download leaves nothing at the cache path.
        partial = path.with_name(path.name + ".part")
        urllib.request.urlretrieve(f"{url}?redirect=true", partial)
        partial.rename(path)
    if sha256(path) != digest:
        raise SystemExit(f"{dataset['key']}/{remote} checksum mismatch")
    return path, url


def rows(path, columns):
    """The table's rows. The IFS and IFJ sets quote some lines whole and separate others by spaces."""
    lines = [line.strip().strip('"') for line in path.read_text().splitlines() if line.strip()]
    table = [line.split("\t") if "\t" in line else line.split() for line in lines]
    if table[0][-len(columns):] != columns:
        raise SystemExit(f"{path.name}: expected columns {columns}, found {table[0]}")
    for row in table[1:]:
        if len(row) != len(table[0]):
            raise SystemExit(f"{path.name}: row {row} does not have {len(table[0])} columns")
    return table[1:]


def number(text):
    value = float(text)
    return int(value) if value.is_integer() else value


def receptor_ids(definition):
    """Every published spelling of a receptor, to its id."""
    ids = {}
    for transmitter in definition["transmitters"]:
        for receptor in transmitter["receptors"]:
            for spelling in [receptor["id"], *receptor.get("aliases", [])]:
                ids[spelling] = receptor["id"]
    return ids


def read_fingerprint(path, definition, dataset):
    ids = receptor_ids(definition)
    receptors = {}
    for label, mean, sd, unit in rows(path, FINGERPRINT_COLUMNS):
        if label not in ids:
            raise SystemExit(f"{dataset['key']}: unknown receptor {label}")
        if unit != definition["unit"]:
            raise SystemExit(f"{dataset['key']}: {label} is in {unit}, not {definition['unit']}")
        if ids[label] in receptors:
            raise SystemExit(f"{dataset['key']}: {label} is listed twice")
        # An SD left blank is published as no SD, not as zero.
        receptors[ids[label]] = {"mean": number(mean), "sd": number(sd) if sd else None}
    for withheld in definition["withheld"]:
        if withheld["dataset"] != dataset["key"]:
            continue
        value = receptors[withheld["receptor"]]
        if value[withheld["field"]] != withheld["published"]:
            raise SystemExit(f"{dataset['key']}: the withheld {withheld['receptor']} {withheld['field']} "
                             f"is now {value[withheld['field']]}, not {withheld['published']}")
        value[withheld["field"]] = None
    return receptors


def read_donors(subjects, samples, key):
    donors = []
    for subject, sex, age, unit in rows(subjects, SUBJECT_COLUMNS):
        if unit != "years":
            raise SystemExit(f"{key}: {subject}'s age is in {unit}")
        donors.append({"id": subject, "sex": sex, "age_years": number(age)})
    sampled = [{"id": sample, "hemisphere": hemisphere, "donor": donor}
               for sample, hemisphere, donor, pathology in rows(samples, SAMPLE_COLUMNS)]
    if len({sample["id"] for sample in sampled}) != len(sampled):
        raise SystemExit(f"{key}: a tissue sample is listed twice")
    if {sample["donor"] for sample in sampled} != {donor["id"] for donor in donors}:
        raise SystemExit(f"{key}: the samples and the subjects name different donors")
    if any(sample["hemisphere"] not in ("left", "right") for sample in sampled):
        raise SystemExit(f"{key}: a sample names no hemisphere")
    return donors, sampled


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--record", action="store_true", help="add the result to data/sources.json")
    args = parser.parse_args()
    definition = read_definition()
    datasets, origins = [], []
    for dataset in definition["datasets"]:
        fetched = {kind: fetch(definition, dataset, kind) for kind in ("fingerprint", "subjects", "samples")}
        donors, samples = read_donors(fetched["subjects"][0], fetched["samples"][0], dataset["key"])
        datasets.append({
            "key": dataset["key"],
            "receptors": read_fingerprint(fetched["fingerprint"][0], definition, dataset),
            "donors": donors,
            "samples": samples,
        })
        origins.extend({"url": url, "sha256": sha256(path)} for path, url in fetched.values())
    DATA.write_text(json.dumps({"unit": definition["unit"], "datasets": datasets}, indent=1) + "\n")
    print(f"{DATA.relative_to(ROOT)}: {len(datasets)} fingerprints")
    if args.record:
        record(origins)
    else:
        print("Re-run with --record to register the result in data/sources.json.")


def record(origins):
    manifest = ROOT / "data/sources.json"
    provenance = json.loads(manifest.read_text())
    relative = str(DATA.relative_to(ROOT))
    definition = read_definition()
    provenance["sources"] = [source for source in provenance["sources"] if source["path"] != relative] + [{
        "path": relative,
        "sha256": sha256(DATA),
        "derived_from": origins,
        "procedure": (
            "scripts/fetch_receptor_fingerprints.py: each EBRAINS receptor dataset's fingerprint, "
            "donors and sampled hemispheres, read value for value"
        ),
        "citation": ", ".join(source["doi"] for source in definition["sources"].values()),
        "license": definition["license"],
    }]
    manifest.write_text(json.dumps(provenance, indent=2) + "\n")
    print(f"recorded {relative}")


if __name__ == "__main__":
    main()
