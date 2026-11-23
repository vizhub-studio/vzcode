import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/ws': {
        target: 'ws://localhost:3030',
        ws: true,
      },
      '/auth': {
        target: 'http://localhost:3030',
      },
      '/workspace-conflicts': {
        target: 'http://localhost:3030',
      },
      '/ai-assist': {
        target: 'http://localhost:3030',
      },
      '/ai-copilot': {
        target: 'http://localhost:3030',
      },
      '/livekit-token': {
        target: 'http://localhost:3030',
      },
      '/ai-chat-message': {
        target: 'http://localhost:3030',
      },
      '/ai-chat-undo': {
        target: 'http://localhost:3030',
      },
    },
    watch: {
      ignored: ['**/test/sampleDirectories/**'],
    },
  },

  // Required to have Vite properly handle these CommonJS imports
  optimizeDeps: {
    include: [
      'sharedb-client-browser/dist/sharedb-client-umd.cjs',
      'sharedb-client-browser/dist/ot-json1-presence-umd.cjs',
    ],
    exclude: [
      // Exclude Rollup v4 from being bundled,
      // because it messes up the WASM part of the build.
      '@rollup/browser',
    ],
    // Don't scan test sample directories for dependencies
    entries: ['src/**/*.{js,ts,jsx,tsx}', 'index.html'],
  },

  // Fix CSS warnings
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
      },
    },
  },
});
