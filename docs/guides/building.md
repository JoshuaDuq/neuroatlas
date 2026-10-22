# Building an anatomy

The pipeline turns one FreeSurfer reconstruction into the binary assets the viewer loads. Each step reads its declared source files, checks them against recorded SHA-256 hashes, and writes into `public/models/<anatomy>/`.

## Choose the anatomy

[`config/model.yaml`](https://github.com/JoshuaDuq/neuroatlas/blob/main/config/model.yaml) sets the default `anatomy:`. Each build command accepts `--anatomy` to choose another declared anatomy for that run. The declared anatomies are described on the [anatomies](../concepts/anatomies.md) page.

## Run the pipeline

The commands below build `bert`. Substitute `snail` or `aomic` for other anatomies.

```bash
uv sync --locked
uv run python scripts/prepare_subject.py --anatomy bert
uv run python scripts/segment_nextbrain.py --anatomy bert --record
uv run python -m brain_model.build --anatomy bert
uv run python -m brain_model.validate --anatomy bert
npm run build
```

| Step | Command | What it does | Writes |
| :--- | :--- | :--- | :--- |
| 1. Prepare the subject | `scripts/prepare_subject.py` | Unpacks the declared archive, downloads the declared files, or, for `snail`, records the local reconstruction after checking every output against the checksums its `reconstruction.json` lists. Then projects the HCP-MMP and, when the anatomy declares `networks`, the Schaefer annotations from `fsaverage`. It refuses to change a checksum already in [`data/sources.json`](https://github.com/JoshuaDuq/neuroatlas/blob/main/data/sources.json) unless `--rerecord` is passed. For `aomic` the first run records each file's checksum. | `data/<anatomy>/` |
| 2. Segment NextBrain | `scripts/segment_nextbrain.py` | Runs FreeSurfer 8.2's SuperSynth and then the NextBrain Bayesian segmentation on each hemisphere of `orig.mgz`, at 0.4 mm. It joins the two hemispheres on one grid. `--record` adds the results to `data/sources.json`. | `data/nextbrain-<anatomy>/` |
| 3. Build | `brain_model.build` | Exports the cortical atlases, the subcortical and learning solids, the cut-only NextBrain and white-matter labels, the volumes, the spinal cord, and the manifest. Adds the comparison assets when they are enabled. Updates the anatomy index. | `public/models/<anatomy>/`, `anatomies.json` |
| 4. Validate | `brain_model.validate` | Reads the written outputs back and checks them against the sources, then writes the report. See [Validation](../validation.md). | `validation.json` |
| 5. Viewer | `npm run build` | Bundles the viewer into `dist/`. | `dist/` |

Step 2 takes about 20 minutes of CPU per brain. FreeSurfer needs a lot of memory, so run it alone rather than beside other heavy jobs.

Each anatomy declares the optional layers it publishes under `layers:` in [`config/model.yaml`](https://github.com/JoshuaDuq/neuroatlas/blob/main/config/model.yaml): `networks`, `nextbrain`, `white_matter` and `spinal_cord`. The build and the validator fail when a declared layer's input is missing, and publish no layer that is not declared. A missing NextBrain volume therefore stops the build rather than producing an anatomy without its fine level. The build does not delete files it no longer writes, and the validator fails while `public/models/<anatomy>/` holds a file no metadata names, so remove a dropped layer's file by hand. On a development machine a build takes about two and a half minutes and 3.1 GB of memory per anatomy. `fsaverage` declares `nextbrain`, and its volume is kept locally and not committed, so `fsaverage` builds only where that volume exists.

The sources of `snail`, `bert` and `aomic` are committed, so steps 3 and 4 and the test suite run on a fresh clone. Step 1 needs the `bert` archive in `data/cache/`, the network for `aomic`, and, for `snail`, the local reconstruction tree that only partly ships.

Without `--record`, the script writes the volume and its lookup table and asks you to re-run with `--record` before they are registered in `data/sources.json`.

The neuropsychological domains read committed per-area scores, so the build needs no meta-analysis tools. To re-derive the scores after changing a domain's term in `config/neuropsych-domains.yaml`, run the script below. It downloads Neurosynth version 7 into `data/cache/neurosynth/`, computes each term's consistency map, and takes about five minutes a term:

```bash
uv run --with nimare==0.22.1 --with nilearn==0.13.1 python scripts/derive_domain_scores.py
```

## Outputs

Each anatomy publishes one directory with the following:

- glTF 2.0 meshes: cortex for each atlas, the subcortical and learning levels, the NextBrain nuclei, the tissue envelopes, and, where the anatomy declares it, the spinal cord.
- Binary label volumes (`.volume`) and their JSON sidecars: `volumes.json` and `tissue-labels.json`.
- `manifest.json`, the scene descriptor. It lists the regions, the colours, the detail levels, the provenance and a `limitations` list.
- `validation.json`, the report written by step 4.
- For SNAIL with comparison enabled, `atlas-comparison.json` and `atlas-overlaps.glb`.

The table of assets, with their formats and roles, is in [Architecture](../concepts/architecture.md#binary-assets).

## Configuration

- [`config/model.yaml`](https://github.com/JoshuaDuq/neuroatlas/blob/main/config/model.yaml) declares each anatomy's source, its structures and its NextBrain directory. It also holds the display smoothing bound, the appearance and the atlas list.
- [`config/learning-anatomy.yaml`](https://github.com/JoshuaDuq/neuroatlas/blob/main/config/learning-anatomy.yaml) defines the teaching solids as unions of source labels. The count is 82 for `bert` and 79 for `snail`, where [`config/model.yaml`](https://github.com/JoshuaDuq/neuroatlas/blob/main/config/model.yaml) omits the coarse callosal unit.
- [`data/sources.json`](https://github.com/JoshuaDuq/neuroatlas/blob/main/data/sources.json) records each source file with its SHA-256 hash, plus the FreeSurfer build and model checksums used for NextBrain. Each build verifies the recorded files before reading them, so a build reads exactly the bytes it recorded.

## Optional scripts

These are not part of the standard build.

- `scripts/extract_spinal_cord.py` reads the Z-Anatomy scene once and writes the checksummed array [`data/z-anatomy/spinal-cord.npz`](https://github.com/JoshuaDuq/neuroatlas/blob/main/data/z-anatomy/spinal-cord.npz) that the build uses. Its `--record` flag adds the result to `data/sources.json`.
- `scripts/prepare_diffusion.py`, `scripts/prepare_diffusion_outline.py` and `scripts/prepare_diffusion_space.py` produce the SNAIL tract reference. See [Diffusion and tracts](tracts.md#reproducing-the-assets).
- `scripts/blender_scene.py` assembles an editable, source-scale Blender scene from the exports and renders a preview. It writes `Brain-Atlas.blend` and `brain-preview.png` to [`deliverables/`](https://github.com/JoshuaDuq/neuroatlas/tree/main/deliverables). Git ignores both files.
- `scripts/benchmark-picking.mjs` and `scripts/benchmark-diffusion.mjs` measure picking and tract geometry in Node.
- `scripts/published-version.mjs` records every file under `public/models/` and `public/diffusion/` with its SHA-256 and byte size, and for a `.gz` file the SHA-256 and size of its contents. `vite.config.js` reads it on every build and hands the records to the viewer in place of `viewer/model/published-files.js`, so each request carries its own file's version. The head script and the service worker get the versions alone.

## Re-running the SNAIL reconstruction

`data/snail/reconstruction.json` records the commands that produced the SNAIL reconstruction. They ran with `-sd data`. recon-all's `BA_exvivo` step deletes any `fsaverage` in the subjects directory that lacks `lh.entorhinal_exvivo.thresh.label` and links FreeSurfer's own copy in its place, so it removed the committed `data/fsaverage` tree, which had to be restored from git. Run them against a scratch subjects directory instead, from the repository root:

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

In the scratch directory that link is harmless, and nothing in `data/` is touched. When it finishes, copy the outputs `scripts/prepare_subject.py` lists in `SUBJECT_FILES` and `scripts/recon-all.done` into `data/snail/`. Then write a new `data/snail/reconstruction.json` for that run. `prepare_subject.py` reads its `status`, `input_sha256`, `freesurfer_build`, `output_sha256` (one entry per required output, nothing more) and `completion_marker_sha256`, and the build reads its `limitations`. Then record the run with `uv run python scripts/prepare_subject.py --anatomy snail --rerecord`.

The new outputs will not match the old checksums: FreeSurfer writes the user, the host, the time and the command line into the headers of its volumes and surfaces. Every SNAIL asset must then be rebuilt and validated, and its published figures change.

## FreeSurfer 8.2 workarounds

Running FreeSurfer 8.2 on macOS arm64 needed three local workarounds, kept in [`scripts/freesurfer/`](https://github.com/JoshuaDuq/neuroatlas/tree/main/scripts/freesurfer):

- A sliced 3D convolution replaces torch's 90 GB im2col path.
- Two earlier memory releases in SuperSynth.
- A stand-in for an unused OpenCV import.

The memory releases change only when memory is freed, and the OpenCV stand-in raises if any part of it is used. The sliced convolution computes the same products as torch's `conv3d` but sums them in a different order, so its results differ in floating-point rounding. `scripts/freesurfer/check_conv3d_slices.py` holds that difference below $10^{-5}$ of the largest output on its test cases, and the SNAIL SynthStrip run measured a worst relative difference of $6.19 \times 10^{-7}$. Whether that rounding moves any label or surface vertex is not known: no unpatched run exists to compare with, because unpatched SuperSynth needs about 90 GB of memory. Each workaround's justification is recorded in `data/sources.json`, together with the FreeSurfer build, the model and atlas checksums, and the crop.
