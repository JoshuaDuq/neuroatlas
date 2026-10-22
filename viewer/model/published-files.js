/**
 * Every published file's version, sha256 and decoded size, keyed by its path
 * from `public/`. The build (vite.config.js) replaces this module with the map;
 * without it (Node tests, an embedder's own bundler) `files` stays null and
 * requests go out unversioned and unverified.
 */
export default { base: '/', files: null };
