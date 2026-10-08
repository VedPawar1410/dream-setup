import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages serves the site from /dream-setup/, so production builds need that
// base path for asset URLs. Dev stays at / so localhost URLs are clean.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/dream-setup/' : '/',
  plugins: [react()],
}))
