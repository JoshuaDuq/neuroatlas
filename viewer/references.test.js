import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

/**
 * A constructor that was used but never imported is valid syntax, so the
 * bundler builds it and only the handler that reaches it throws. Reset threw
 * `Vector3 is not defined` this way: app.js imported Box3 alone, and nothing
 * exercised the line until the button was pressed.
 */
const GLOBALS = new Set([
  'AbortController', 'AggregateError', 'Array', 'ArrayBuffer', 'Audio', 'BigInt',
  'BigInt64Array', 'BigUint64Array', 'Blob', 'Boolean', 'BroadcastChannel',
  'CompressionStream', 'CustomEvent', 'DOMParser', 'DataView', 'Date',
  'DecompressionStream', 'Error', 'EvalError', 'Event', 'EventTarget', 'File',
  'FileReader', 'FinalizationRegistry', 'Float32Array', 'Float64Array', 'FormData',
  'Function', 'Headers', 'Image', 'ImageData', 'Int16Array', 'Int32Array',
  'Int8Array', 'IntersectionObserver', 'Map', 'MutationObserver', 'Notification',
  'Number', 'Object', 'OffscreenCanvas', 'Option', 'Path2D', 'Promise', 'Proxy',
  'Range', 'RangeError', 'ReadableStream', 'ReferenceError', 'Reflect', 'RegExp',
  'Request', 'ResizeObserver', 'Response', 'Set', 'SharedArrayBuffer', 'String',
  'Symbol', 'SyntaxError', 'TextDecoder', 'TextEncoder', 'TransformStream',
  'TypeError', 'URIError', 'URL', 'URLSearchParams', 'Uint16Array', 'Uint32Array',
  'Uint8Array', 'Uint8ClampedArray', 'WeakMap', 'WeakRef', 'WeakSet', 'WebSocket',
  'Worker', 'WritableStream',
]);

function declared(source) {
  const names = new Set();
  for (const match of source.matchAll(/import\s+([\s\S]+?)\s+from\s*['"]/g)) {
    for (const name of match[1].matchAll(/([A-Za-z_$][\w$]*)(?:\s*,|\s*}|\s*$)/g)) {
      names.add(name[1]);
    }
    for (const alias of match[1].matchAll(/\bas\s+([A-Za-z_$][\w$]*)/g)) names.add(alias[1]);
  }
  for (const match of source.matchAll(/\b(?:class|function)\s+([A-Za-z_$][\w$]*)/g)) {
    names.add(match[1]);
  }
  for (const match of source.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) {
    names.add(match[1]);
  }
  // Destructured bindings, including the dynamic imports the model unpacks in a
  // callback parameter. Only plain binding lists count: anything holding a
  // statement is a function body, whose contents bind nothing.
  for (const match of source.matchAll(/\{([^{}();]*)\}\s*[=,)\]]/g)) {
    const parts = match[1].split(',').map(part => part.trim()).filter(Boolean);
    if (!parts.length || !parts.every(part => /^\.{0,3}[A-Za-z_$][\w$]*(\s*:\s*[A-Za-z_$][\w$]*)?$/.test(part))) {
      continue;
    }
    for (const part of parts) names.add(part.split(':').pop().trim().replace(/^\.{3}/, ''));
  }
  return names;
}

test('every constructor a viewer module uses is imported or declared there', async () => {
  const viewer = new URL('./', import.meta.url);
  const files = (await readdir(viewer, { recursive: true }))
    .filter(file => file.endsWith('.js') && !file.endsWith('.test.js'));

  const offences = [];
  for (const file of files) {
    const source = await readFile(new URL(file, viewer), 'utf8');
    const names = declared(source);
    for (const match of source.matchAll(/\bnew\s+([A-Z][\w$]*)\s*\(/g)) {
      const name = match[1];
      if (!names.has(name) && !GLOBALS.has(name)) {
        const line = source.slice(0, match.index).split('\n').length;
        offences.push(`${file}:${line}: new ${name}() is neither imported nor declared`);
      }
    }
  }
  assert.deepEqual(offences, []);
});
