# Install

## Viewer

You need Node.js with npm (CI uses Node 24) and a browser with WebGL 2. Published model and tract assets are included in the repository; you do not need the Python pipeline to run the viewer.

```bash
cd web
npm ci
npm run dev
```

Open the address printed by Vite, normally `http://127.0.0.1:5173/`. Run `npm run build` to build the static site in `web/dist/`, or `npm test` for the unit tests.

## Python pipeline

Install [uv](https://docs.astral.sh/uv/). The project requires Python 3.12 or 3.13; uv can install it if needed.

```bash
uv sync --locked
uv run pytest
```

The committed CDMD sources can be built directly. Regenerating segmentations or diffusion data has additional requirements; see [Building an anatomy](guides/building.md).

## Documentation

From the repository root:

```bash
uv sync --locked --group docs
uv run sphinx-build -W -b html docs docs/_build/html
```

Open `docs/_build/html/index.html`. The `-W` option makes warnings fail the build, as in CI.
