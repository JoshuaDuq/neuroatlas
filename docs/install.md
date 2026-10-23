# Install

The viewer and the pipeline install separately. The published anatomies are already compiled in `public/models/`, so the pipeline is needed only to build or rebuild one.

| Part | Needs |
| :--- | :--- |
| Viewer | Node.js with npm (CI uses Node 24); a browser with WebGL 2 |
| Pipeline | [uv](https://docs.astral.sh/uv/); Python 3.12 or 3.13, which uv installs if missing |
| NextBrain segmentation | FreeSurfer 8.2; about 20 minutes of CPU per brain |

## Viewer

```bash
npm ci
npm run dev
```

Vite serves the viewer at `http://127.0.0.1:5173/neuroatlas/`. `npm run build` writes the static site to `dist/`, `npm run preview` serves it, and `npm test` runs the JavaScript tests.

## Pipeline

```bash
uv sync --locked
uv run pytest
```

`--locked` installs exactly what `uv.lock` records. The tests read the committed sources of `snail`, `bert` and `aomic`. Run pipeline commands through `uv run`; the [build guide](guides/building.md) lists them.

CI runs `uv run pytest`, `npm test` and `python -m brain_model.validate` for each published anatomy on every pull request and before each deployment.

## Documentation

```bash
uv sync --locked --group docs
uv run sphinx-build -W -b html docs docs/_build/html
```

`-W` turns warnings into errors, as CI does.
