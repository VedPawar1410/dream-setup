# Dream Setup

A cozy browser sandbox for designing your dream room and desk setup, inspired by
[My Dream Setup](https://store.steampowered.com/app/2200780/My_Dream_Setup/).
Built with [three.js](https://threejs.org) and [GSAP](https://gsap.com).

**Status:** Phase 0 (scaffold) complete. See [PLAN.md](PLAN.md).

## Run locally
```bash
npm install
npm run dev      # http://localhost:5173
npm run lint     # oxlint
npm run build    # type-check + production build into dist/
```

Stack: Vite · React 19 · TypeScript · React Three Fiber + drei · GSAP · Zustand · IndexedDB (idb).
Pushes to `main` deploy to GitHub Pages via `.github/workflows/deploy.yml`.

## Features (planned)
- Blueprint mode: shape the room, place doors and windows
- Free placement of furniture, PC gear, plants and decor, with stacking and snapping
- Full RGB recoloring, wall paints and wallpapers, floor materials
- Five weather moods (sunny, sunset, rain, snow, night) with animated transitions and RGB lighting
- Dollhouse camera, plus a first-person view from your desk
- Photo mode with PNG export
- Autosave and save slots in the browser
