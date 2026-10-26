# K4 deviation: the head prefetch hands the index over only after the brain's files have started

Chunk K4 (#131; `src/boot/prefetch.js` is F3's head script). Pinned by `parity/F3.test.ts` ("hands
the index to the app only once the brain it names has started", "still hands over an index that does
not parse, for the app to report", "still hands over an index that parses but names no brain, for
the app to report").

- **Legacy** (`index.html:62-67`, read through `viewer/app.js:103` and
  `viewer/model/asset-cache.js:87-88`): with no `anatomy` in the link, the head script put the
  `anatomies.json` response on `__planumAssets` at once, and only then parsed it and started the
  default brain's manifest, atlas and detail files. The app could take the index, read the default
  and ask for the manifest before `warm()` had started it, so the manifest was fetched twice.
- **New** (`src/boot/prefetch.js`): the `anatomies.json` entry resolves to the same response, but only
  after `warm()` has started the brain's files. An index that does not parse, or that parses but
  names no brain, still hands the response over unchanged, so the app reports it as it did before.
- **Standard**: one request per asset, the contract of `core/assets/asset-cache.ts` ("One in-flight
  request per URL … so a second fetch of the same 25 MB file never opens"), which the head script
  broke for the manifest.
