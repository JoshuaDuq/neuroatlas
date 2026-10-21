# Install

NeuroAtlas has two parts that install separately. The web viewer needs Node.js. The Python pipeline builds the anatomy assets and needs [uv](https://docs.astral.sh/uv/). The compiled assets for the published anatomies are already in `public/models/`, so the pipeline is needed only to build or rebuild an anatomy.

## Requirements

| Part | Needs |
| :--- | :--- |
| Web viewer | Node.js with npm (CI uses Node 20) and a browser with WebGL 2 |
| Python pipeline | uv. Python 3.12 or 3.13 (`requires-python` is `>=3.12,<3.14`); uv installs one if none is present |
| NextBrain segmentation | FreeSurfer 8.2, and about 20 minutes of CPU time per brain. Workarounds needed on macOS arm64 live in `scripts/freesurfer/`. |

## Web viewer

```bash
npm ci
npm run dev
```

Vite serves the viewer on port 5173 by default. The viewer is built with the base path `/neuroatlas/`, so the address Vite prints ends in `/neuroatlas/`, for example `http://127.0.0.1:5173/neuroatlas/`.

- `npm run build` writes the static site to `dist/`.
- `npm run preview` serves that build locally.
- `npm test` runs the JavaScript test suite with Node's built-in test runner.

## Python pipeline

```bash
uv sync --locked
```

`--locked` installs exactly the versions recorded in `uv.lock` and fails if the lock file is out of date. The default groups include `dev` (pytest and ruff), so `uv run pytest` works after this step.

Pipeline commands are run through `uv run`, for example `uv run python -m brain_model.build --anatomy bert`. The [build guide](guides/building.md) lists each step.

## Documentation

To build this site locally:

```bash
uv sync --locked --group docs
uv run sphinx-build -W -b html docs docs/_build/html
```

Open `docs/_build/html/index.html` in a browser. `-W` turns every warning into an error, as the CI check does. The build output is ignored by git.
