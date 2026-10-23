# Building an anatomy

The pipeline turns one FreeSurfer reconstruction into the files the viewer loads. Every source file is checked against its SHA-256 in [`data/sources.json`](https://github.com/JoshuaDuq/neuroatlas/blob/main/data/sources.json) before it is read.

```bash
uv run python scripts/prepare_subject.py --anatomy bert
uv run python scripts/segment_nextbrain.py --anatomy bert --record
uv run python -m brain_model.build --anatomy bert
uv run python -m brain_model.validate --anatomy bert
npm run build
```

| Step | Does | Writes |
| :--- | :--- | :--- |
| `prepare_subject.py` | Fetches or unpacks the declared reconstruction, then projects HCP-MMP (and Schaefer, where declared) from `fsaverage`. Refuses to change a recorded checksum without `--rerecord`. | `data/<anatomy>/` |
| `segment_nextbrain.py` | Runs FreeSurfer 8.2 SuperSynth and NextBrain on each hemisphere at 0.4 mm and joins them. `--record` registers the result. About 20 minutes of CPU; run it alone. | `data/nextbrain-<anatomy>/` |
| `brain_model.build` | Exports atlases, solids, label volumes, cord and manifest, and updates the anatomy index. | `public/models/<anatomy>/` |
| `brain_model.validate` | Reads the outputs back against the sources. See [Validation](../validation.md). | `validation.json` |
| `npm run build` | Bundles the viewer. | `dist/` |

The sources of `snail`, `bert` and `aomic` are committed, so build, validate and the tests run on a fresh clone. A build takes about two and a half minutes and 3.1 GB per anatomy.

## Configuration

- [`config/model.yaml`](https://github.com/JoshuaDuq/neuroatlas/blob/main/config/model.yaml) declares each anatomy, its optional `layers:` (`networks`, `nextbrain`, `white_matter`, `spinal_cord`), smoothing bound and appearance. Build and validation fail when a declared layer's input is missing, and publish nothing undeclared. The build does not delete files it no longer writes; remove them by hand.
- [`config/learning-anatomy.yaml`](https://github.com/JoshuaDuq/neuroatlas/blob/main/config/learning-anatomy.yaml) defines the teaching solids as unions of source labels.
- The neuropsychological functions read committed scores. After changing a term in `config/neuropsych-domains.yaml`, re-derive them (Neurosynth 7 is downloaded to `data/cache/`; about five minutes a term):

  ```bash
  uv run --with nimare==0.22.1 --with nilearn==0.13.1 python scripts/derive_domain_scores.py
  ```

- To add only the SNAIL atlas-comparison files to an existing build:

  ```bash
  uv run python -m brain_model.layers.comparison --anatomy snail
  ```

## Other scripts

- `extract_spinal_cord.py` writes the checksummed Z-Anatomy cord array the build reads.
- `prepare_diffusion*.py` produce the tract reference; see [Diffusion and tracts](tracts.md#data).
- `blender_scene.py` assembles a Blender scene from the exports into `deliverables/`.
- `published-version.mjs` records every published file's SHA-256 and size; Vite hands it to the viewer so each request carries its own version.

## Re-running the SNAIL reconstruction

`data/snail/reconstruction.json` records the commands. Run them in a scratch subjects directory: recon-all's `BA_exvivo` step replaces any `fsaverage` it finds, and would delete the committed `data/fsaverage`.

```bash
export FREESURFER_HOME=/Applications/freesurfer/8.2.0
source "$FREESURFER_HOME/SetUpFreeSurfer.sh"
export SUBJECTS_DIR="$(mktemp -d)"
FS_V8_XOPTS=0 recon-all -sd "$SUBJECTS_DIR" -s snail \
  -i public/diffusion/snail-subject-1/t1_warped.nii.gz -motioncor -openmp 4
fspython scripts/freesurfer/run_patched.py "$FREESURFER_HOME/python/scripts/mri_synthstrip" \
  --threads 4 -i "$SUBJECTS_DIR/snail/mri/orig.mgz" -o "$SUBJECTS_DIR/snail/mri/synthstrip.mgz"
recon-all -sd "$SUBJECTS_DIR" -s snail -all -openmp 4
```

Copy the outputs listed in `SUBJECT_FILES` of `prepare_subject.py` into `data/snail/`, write a new `reconstruction.json`, and record with `prepare_subject.py --anatomy snail --rerecord`. FreeSurfer writes the user, host and time into its headers, so checksums change and every SNAIL asset must be rebuilt.

## FreeSurfer 8.2 on macOS arm64

[`scripts/freesurfer/`](https://github.com/JoshuaDuq/neuroatlas/tree/main/scripts/freesurfer) holds three workarounds: a sliced 3D convolution in place of torch's 90 GB im2col path, two earlier memory releases in SuperSynth, and a stand-in for an unused OpenCV import. Only the convolution changes numbers: it sums the same products in another order. `check_conv3d_slices.py` bounds the difference below $10^{-5}$ of the largest output; the SNAIL SynthStrip run measured $6.19 \times 10^{-7}$. Whether that moves any label is unknown, because unpatched SuperSynth needs about 90 GB.
