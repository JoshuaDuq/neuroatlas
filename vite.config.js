import { existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  base: '/neuroatlas/',
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        // Three.js and the BVH index change far less often than the viewer.
        // Splitting them keeps a chrome-only deploy from re-downloading 1 MB.
        manualChunks(id) {
          if (id.includes('node_modules/three/')) return 'three';
          if (id.includes('three-mesh-bvh')) return 'bvh';
        },
      },
    },
  },
  plugins: [
    {
      // Byte-equivalent merge of two layers the viewer already loads separately.
      // Shipping it next to them is 28 MB nobody fetches.
      name: 'omit-unused-anatomical-merge',
      closeBundle() {
        const file = resolve(root, 'dist/models/brain-anatomical.glb');
        if (existsSync(file)) unlinkSync(file);
      },
    },
  ],
});
