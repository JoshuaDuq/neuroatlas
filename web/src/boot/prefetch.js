window.__planumAssets = window.__planumAssets || {};
(function () {
  var params = new URLSearchParams(location.hash.replace(/^#/, ''));
  var atlas = params.get('atlas') === 'hcp-mmp' ? 'cortex-hcp-mmp.glb' : 'cortex-destrieux.glb';
  var detail =
    { aseg: 'structures.glb', nextbrain: 'nextbrain.glb', learning: 'learning.glb' }[
      params.get('detail')
    ] || 'learning.glb';
  // The published root (build/site.ts ASSET_BASE), so a missing trailing slash
  // on the page URL cannot send 25 MB at the site root.
  var root = __ASSET_BASE__;
  // Each file's own content version, written in by the build (build/published-files.ts).
  // Keyed by the plain URL, fetched with that version, as `fetchPublished` does.
  var versions = __PUBLISHED_VERSIONS__;
  function start(file) {
    var url = new URL(root + file, location.origin).href;
    if (!window.__planumAssets[url]) {
      window.__planumAssets[url] = fetch(url + '?v=' + versions[file], {
        cache: 'no-cache',
        priority: 'high',
      });
    }
    return window.__planumAssets[url];
  }
  // Each brain publishes its own directory, so which one must be known
  // before anything of it is worth fetching. A link may name it; if not,
  // the index does, and it is small enough to wait for.
  function warm(brain) {
    ['manifest.json', atlas, detail].forEach(function (file) {
      start('models/' + brain + '/' + file);
    });
  }
  var named = params.get('anatomy');
  var index = start('models/anatomies.json');
  if (named) warm(named);
  else
    index
      .then(function (response) {
        return response.clone().json();
      })
      .then(function (published) {
        warm(published.default);
      })
      .catch(function () {});
})();
