import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages serves the site from /dream-setup/, so production builds need that
// base path for asset URLs. Dev stays at / so localhost URLs are clean. `vite preview`
// runs as command 'serve', so it needs the isPreview check to serve the build correctly.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/dream-setup/' : '/',
  plugins: [react()],
}))
