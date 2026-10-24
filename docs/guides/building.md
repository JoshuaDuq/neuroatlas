# Building an anatomy

The pipeline turns one FreeSurfer reconstruction into the files the viewer loads. Every source file is checked against its SHA-256 in [`data/sources.json`](https://github.com/JoshuaDuq/neuroatlas/blob/main/data/sources.json) before it is read.

```bash
uv run python scripts/prepare_subject.py --anatomy cdmd
uv run python scripts/segment_nextbrain.py --anatomy cdmd --record
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
npm run build
```

| Step | Does | Writes |
| :--- | :--- | :--- |
| `prepare_subject.py` | Records the declared reconstruction against its `reconstruction.json`, then projects HCP-MMP (and Schaefer, where declared) from `fsaverage`. Refuses to change a recorded checksum without `--rerecord`. | `data/<anatomy>/` |
| `segment_nextbrain.py` | Runs FreeSurfer 8.2 SuperSynth and NextBrain on each hemisphere at 0.4 mm and joins them. `--record` registers the result. About 20 minutes of CPU; run it alone. | `data/nextbrain-<anatomy>/` |
| `brain_model.build` | Exports atlases, solids, label volumes, cord and manifest, and updates the anatomy index. | `public/models/<anatomy>/` |
| `brain_model.validate` | Reads the outputs back against the sources. See [Validation](../validation.md). | `validation.json` |
| `npm run build` | Bundles the viewer. | `dist/` |

The sources of `snail` and `cdmd` are committed, so build, validate and the tests run on a fresh clone. A build takes about two and a half minutes and 3.1 GB per anatomy.

## Configuration

- [`config/model.yaml`](https://github.com/JoshuaDuq/neuroatlas/blob/main/config/model.yaml) declares each anatomy, its optional `layers:` (`networks`, `nextbrain`, `white_matter`, `spinal_cord`), smoothing bound and appearance. Build and validation fail when a declared layer's input is missing, and publish nothing undeclared. The build does not delete files it no longer writes; remove them by hand.
- [`config/learning-anatomy.yaml`](https://github.com/JoshuaDuq/neuroatlas/blob/main/config/learning-anatomy.yaml) defines the teaching solids as unions of source labels.
- The neuropsychological functions read committed scores. After changing a term in `config/neuropsych-domains.yaml`, re-derive them (Neurosynth 7 is downloaded to `data/cache/`; about five minutes a term):

  ```bash
  uv run --with nimare==0.22.1 --with nilearn==0.13.1 python scripts/derive_domain_scores.py
  ```

- To add only the atlas-comparison files to an existing build of an anatomy that enables them:

  ```bash
  uv run python -m brain_model.layers.comparison --anatomy cdmd
  ```

## Other scripts

- `extract_spinal_cord.py` writes the checksummed Z-Anatomy cord array the build reads.
- `prepare_diffusion.py` packages SNAIL's published tracts, `prepare_diffusion_cdmd.py` the tracts `cdmd_pilot.py` tracked for CDMD, and `prepare_diffusion_space.py` and `prepare_diffusion_outline.py --anatomy <id>` write each catalog's surface transform and outline; see [Diffusion and tracts](tracts.md#data).
- `blender_scene.py` assembles a Blender scene from the exports into `deliverables/`.
- `published-version.mjs` records every published file's SHA-256 and size; Vite hands it to the viewer so each request carries its own version.

## Reconstructing an anatomy

`scripts/reconstruct_subject.py` runs an anatomy's declared `reconstruction` with FreeSurfer 8.2: recon-all's import and motion correction, SynthStrip under the sliced-convolution runtime, then `recon-all -all`. It keeps the recon-all tree in `data/cache/freesurfer-subjects`, because recon-all's `BA_exvivo` step replaces any `fsaverage` in its subjects directory and would delete the committed `data/fsaverage`. It copies the pinned outputs into `data/<anatomy>/` and writes `reconstruction.json`; record them with `prepare_subject.py`.

```bash
FS_LICENSE=$HOME/.freesurfer/license.txt uv run python scripts/reconstruct_subject.py --anatomy cdmd
uv run python scripts/prepare_subject.py --anatomy cdmd
```

FreeSurfer writes the user, host and time into its headers, so a rerun changes every checksum and every asset of that anatomy must be rebuilt. SNAIL's `data/snail/reconstruction.json` records the same three commands, run by hand before this script existed.

## FreeSurfer 8.2 on macOS arm64

[`scripts/freesurfer/`](https://github.com/JoshuaDuq/neuroatlas/tree/main/scripts/freesurfer) holds three workarounds: a sliced 3D convolution in place of torch's 90 GB im2col path, two earlier memory releases in SuperSynth, and a stand-in for an unused OpenCV import. Only the convolution changes numbers: it sums the same products in another order, and only for convolutions whose im2col buffer would reach 1 GiB. Smaller ones run in torch itself, because sliced, torch's conv2d returns about $-3 \times 10^{-7}$ where conv3d returns exactly zero, and NextBrain's bias field fit took the log of such a sum on CDMD. `check_conv3d_slices.py` bounds the difference below $10^{-5}$ of the largest output; the SNAIL SynthStrip run measured $6.19 \times 10^{-7}$. Whether that moves any label is unknown, because unpatched SuperSynth needs about 90 GB.
