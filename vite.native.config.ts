import { resolve } from 'node:path';
import { defineConfig } from 'vite';

/** Prebid native `rendererUrl` bundle — defines `window.renderAd` (separate from video UMD). */
export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/native-renderer.entry.js'),
      name: 'RediAdsNativeBundle',
      formats: ['iife'],
      fileName: () => 'rediads-native-renderer.js',
    },
    rollupOptions: {
      output: {
        extend: true,
        entryFileNames: 'rediads-native-renderer.js',
      },
    },
    sourcemap: true,
    minify: 'esbuild',
  },
});
