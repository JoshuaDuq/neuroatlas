# NeuroAtlas

[![WebGL 2](https://img.shields.io/badge/WebGL-2.0-blue.svg)](https://www.khronos.org/registry/webgl/specs/latest/2.0/)
[![Three.js](https://img.shields.io/badge/Three.js-r186-black.svg)](https://threejs.org/)
[![Python 3.12](https://img.shields.io/badge/Python-3.12-3776AB.svg?logo=python&logoColor=white)](https://www.python.org/)
[![glTF 2.0](https://img.shields.io/badge/glTF-2.0-green.svg)](https://www.khronos.org/gltf/)

NeuroAtlas is a source-faithful, selectable 3D brain model for neuroscience teaching and anatomical research. It is built from individual FreeSurfer reconstructions at native resolution, and the browser viewer combines solid tissue cuts, categorical 3D label sampling, registered T1 relief, parcellation layers and linked MRI reference sections.

- **Viewer:** [joshuaduq.github.io/neuroatlas](https://joshuaduq.github.io/neuroatlas/)
- **Documentation:** [joshuaduq.github.io/neuroatlas/docs](https://joshuaduq.github.io/neuroatlas/docs/)

## Quickstart

### Viewer

```bash
npm ci
npm run dev
```

Open the address Vite prints. It ends in `/neuroatlas/`, for example `http://127.0.0.1:5173/neuroatlas/`.

### Build pipeline

```bash
uv sync --locked
uv run python scripts/prepare_subject.py --anatomy bert
uv run python scripts/segment_nextbrain.py --anatomy bert --record
uv run python -m brain_model.build --anatomy bert
uv run python -m brain_model.validate --anatomy bert
```

The NextBrain step needs FreeSurfer 8.2 and takes about 20 minutes on a CPU. See the [installation](https://joshuaduq.github.io/neuroatlas/docs/install.html) and [build](https://joshuaduq.github.io/neuroatlas/docs/guides/building.html) guides for requirements and the outputs of each step.

## Anatomies

The viewer publishes three individual reconstructions. The default is `snail`.

- **`snail`**: SNAIL subject 1, reconstructed with FreeSurfer 8.2 from the reference MRI used by the bundled tractography.
- **`bert`**: FreeSurfer's canonical single-subject example.
- **`aomic`**: AOMIC-PIOP1 `sub-0022`.

## Scientific caveat

Each anatomy is one person's brain, not a template, and is **not clinically normative**. The MRI and FreeSurfer segmentations are 1 mm; NextBrain labels are estimated on a 0.4 mm grid from that same scan. See the [validation and limits](https://joshuaduq.github.io/neuroatlas/docs/validation.html) page.

## Licensing

- **Code** (pipeline and viewer): MIT.
- **`bert` and `fsaverage` assets:** FreeSurfer Software License.
- **`aomic` `sub-0022` assets:** CC0 1.0 (public domain).
- **SNAIL tract reference:** CC0 1.0.
- **HCP-MMP1.0 annotation:** HCP Open Access Data Use Terms.
- **CAB-NP network assignments (`cab-np.json`):** CAB-NP License (Rutgers University and Yale University), non-commercial use only, kept as an isolated file beside its licence and original label key.
- **Spinal cord (`spinal-cord.glb`):** derived from Z-Anatomy, CC BY-SA 4.0, kept as an isolated file.

The full terms and citations are on the [references](https://joshuaduq.github.io/neuroatlas/docs/reference/references.html) page.
