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
| 1. Prepare the subject | `scripts/prepare_subject.py` | Unpacks the declared archive, or downloads the declared files, and verifies every checksum against [`data/sources.json`](https://github.com/JoshuaDuq/neuroatlas/blob/main/data/sources.json). For `aomic` the first run records each file's checksum. | `data/<anatomy>/` |
| 2. Segment NextBrain | `scripts/segment_nextbrain.py` | Runs FreeSurfer 8.2's SuperSynth and then the NextBrain Bayesian segmentation on each hemisphere of `orig.mgz`, at 0.4 mm. It joins the two hemispheres on one grid. `--record` adds the results to `data/sources.json`. | `data/nextbrain-<anatomy>/` |
| 3. Build | `brain_model.build` | Exports the cortical atlases, the subcortical and learning solids, the cut-only NextBrain and white-matter labels, the volumes, the spinal cord, and the manifest. Adds the comparison assets when they are enabled. Updates the anatomy index. | `public/models/<anatomy>/`, `anatomies.json` |
| 4. Validate | `brain_model.validate` | Reads the written outputs back and checks them against the sources, then writes the report. See [Validation](../validation.md). | `validation.json` |
| 5. Viewer | `npm run build` | Bundles the viewer into `dist/`. | `dist/` |

Step 2 takes about 20 minutes of CPU per brain. FreeSurfer needs a lot of memory, so run it alone rather than beside other heavy jobs. The NextBrain step is optional: when its volume is absent, the build publishes only the layers that do not need it.

Without `--record`, the script writes the volume and its lookup table and asks you to re-run with `--record` before they are registered in `data/sources.json`.

## Outputs

Each anatomy publishes one directory with the following:

- glTF 2.0 meshes: cortex for each atlas, the subcortical and learning levels, the NextBrain nuclei, the tissue envelopes, and the spinal cord.
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
- `scripts/published-version.mjs` hashes `public/` to stamp the model version used by the viewer's requests and its service worker. `vite.config.js` calls it on every build.

## FreeSurfer 8.2 workarounds

Running FreeSurfer 8.2 on macOS arm64 needed three local workarounds, kept in [`scripts/freesurfer/`](https://github.com/JoshuaDuq/neuroatlas/tree/main/scripts/freesurfer):

- A sliced 3D convolution replaces torch's 90 GB im2col path.
- Two earlier memory releases in SuperSynth.
- A stand-in for an unused OpenCV import.

None of them changes a computed value. Each one's justification is recorded in `data/sources.json`, together with the FreeSurfer build, the model and atlas checksums, and the crop.
