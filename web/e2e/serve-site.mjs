// Serves the site the way GitHub Pages does until the cutover: the Svelte preview (`npm run
// build:preview` in web/, into web/dist/) at /neuroatlas/next/, and the published models and
// diffusion data (the repository's public/) at /neuroatlas/, where the live site serves them.
// Not `vite preview`, which sets different headers and answers unknown paths with index.html.
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const published = fileURLToPath(new URL('../../public/', import.meta.url));
const preview = fileURLToPath(new URL('../dist/', import.meta.url));
const base = '/neuroatlas/';
const previewBase = `${base}next/`;
const port = Number(process.env.PORT ?? 4173);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.glb': 'model/gltf-binary',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  // Pages sends .gz as a file, not as an encoded response.
  '.gz': 'application/gzip',
};

async function fileFor(pathname) {
  const [site, root] = pathname.startsWith(previewBase)
    ? [preview, previewBase]
    : [published, base];
  const path = resolve(site, decodeURIComponent(pathname.slice(root.length)));
  if (path !== site.slice(0, -1) && !path.startsWith(site)) return null;
  const info = await stat(path).catch(() => null);
  if (info?.isDirectory()) return fileFor(`${pathname.replace(/\/?$/, '/')}index.html`);
  return info?.isFile() ? { path, size: info.size } : null;
}

createServer(async (request, response) => {
  const { pathname } = new URL(request.url, 'http://localhost');
  if (pathname === base.slice(0, -1) || pathname === `${base}next`) {
    response.writeHead(301, { location: `${pathname}/` }).end();
    return;
  }
  const file = pathname.startsWith(base) ? await fileFor(pathname) : null;
  if (!file) {
    response.writeHead(404).end();
    return;
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405).end();
    return;
  }
  response.writeHead(200, {
    'content-type': types[extname(file.path)] ?? 'application/octet-stream',
    'content-length': file.size,
    'cache-control': 'max-age=600',
  });
  if (request.method === 'HEAD') response.end();
  else createReadStream(file.path).pipe(response);
}).listen(port, '127.0.0.1', () =>
  console.log(`Serving ${preview} at http://127.0.0.1:${port}${previewBase}`),
);
