# Building an anatomy

The pipeline checks source files against [`data/sources.json`](https://github.com/JoshuaDuq/neuroatlas/blob/main/data/sources.json), then compiles them into the assets used by the viewer. The sources needed for CDMD are committed, so a fresh clone can build and validate it without regenerating the segmentations:

```bash
uv sync --locked
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
```

The build writes `public/models/cdmd/` and updates the anatomy index; validation writes `validation.json`. Build the viewer with `npm run build --prefix web`. The build takes about two and a half minutes and 3.1 GB per anatomy. See [Validation and limits](../validation.md) for the checks.

## Configuration

- [`config/model.yaml`](https://github.com/JoshuaDuq/neuroatlas/blob/main/config/model.yaml) declares sources, optional layers and display settings. Missing inputs for declared layers cause the build to fail.
- [`config/learning-anatomy.yaml`](https://github.com/JoshuaDuq/neuroatlas/blob/main/config/learning-anatomy.yaml) defines teaching solids as unions of source labels.
- `config/neuropsych-domains.yaml` and `config/neurosynth-terms.yaml` select the functional maps. Their derived scores are committed under `data/`.

The build does not remove files it no longer writes. Remove obsolete files from the output directory before validating a changed configuration.

## Regenerating sources

These steps are needed only when changing or reconstructing sources. They require tools outside the Python environment:

- `scripts/reconstruct_subject.py`: FreeSurfer 8.2 and a FreeSurfer licence. It writes a reconstruction and `reconstruction.json`; run `prepare_subject.py` afterward to record sources and project annotations. Pass `--rerecord` if recorded checksums have changed. A reconstruction changes checksums, so rebuild all assets for that anatomy.
- `scripts/segment_nextbrain.py`: FreeSurfer 8.2; approximately 20 minutes of CPU per brain. It writes the labels and a near-tie volume from NextBrain's posteriors, which boundary certainty is built from. `--record` registers the result.
- `scripts/segment_cerebellum.py`: FastSurfer v2.6.0 and its pinned environment; approximately 8 minutes of CPU per brain. Use `--record` to register the result.
- `scripts/fetch_julich_brain.py`: downloads Julich-Brain 3.1's `fsaverage` maps from EBRAINS, pinned by checksum, and writes them as annotations; run `prepare_subject.py` afterward to project them. `--record` registers the result.
- `scripts/register_arterial_territories.py`: FreeSurfer 8.2's SynthMorph; about 8 minutes and 6.5 GB on the CPU. Registers the Liu et al. (2023) territory atlas's template to the anatomy, carries the atlas across and refuses a registration that fails its checks against the anatomy's own segmentation. `--record` registers the result.
- `scripts/fetch_receptor_fingerprints.py`: downloads the receptor datasets `config/receptor-fingerprints.yaml` lists from EBRAINS, pinned by checksum, into `data/receptor-fingerprints.json`. `--record` registers the result.
- `scripts/segment_spinal_cord.py`: the Spinal Cord Toolbox 7.3 (its own installer, in `~/sct_7.3` or `$SCT_DIR`), with its cord model and PAM50 pinned by checksum; approximately 10 minutes of CPU per brain. `--record` registers the result.
- `scripts/tractseg_cdmd.py`: MRtrix3 3.0.8, TractSeg 2.10, torch and pretrained weights. See [Diffusion and tracts](tracts.md#cdmds-tractseg-bundles-and-fa) for the method and packaging commands.

For the repository's configured tool locations and command options, inspect the scripts before running them. On macOS arm64, `scripts/freesurfer/` contains the memory workarounds used for FreeSurfer 8.2; sliced convolutions may change floating-point results.

After changing a curated Neurosynth term, regenerate the domain scores before building:

```bash
uv run --with nimare==0.22.1 --with nilearn==0.13.1 python scripts/derive_domain_scores.py
```

The full term-score table is substantially more expensive to regenerate; `scripts/derive_term_scores_submit_rorqual.sh` submits the workload as a Slurm array. To rebuild only atlas-comparison files for an anatomy that enables them, run:

```bash
uv run python -m brain_model.layers.comparison --anatomy cdmd
```
