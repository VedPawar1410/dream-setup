import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages serves the site from /dream-setup/, so production builds need that
// base path for asset URLs. Dev stays at / so localhost URLs are clean. `vite preview`
// runs as command 'serve', so it needs the isPreview check to serve the build correctly.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/dream-setup/' : '/',
  plugins: [react()],
  build: {
    // Libraries go in their own files, apart from the app code. They change rarely, so
    // after a game update the browser re-downloads only the small app chunk and keeps
    // three.js (the biggest piece) from its cache. three alone is ~700 kB minified,
    // hence the raised warning limit.
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // Accounts code is imported lazily; its own chunk keeps it out of guests' downloads
            { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/, priority: 3 },
            { name: 'qrcode', test: /node_modules[\\/]qrcode-generator[\\/]/, priority: 3 },
            { name: 'three', test: /node_modules[\\/]three[\\/]/, priority: 2 },
            { name: 'vendor', test: /node_modules[\\/]/, priority: 1 },
          ],
        },
      },
    },
  },
}))
