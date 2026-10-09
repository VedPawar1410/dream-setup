# Dream Setup

A cozy browser sandbox for designing your dream room and desk setup, inspired by
[My Dream Setup](https://store.steampowered.com/app/2200780/My_Dream_Setup/).
Built with [three.js](https://threejs.org) and [GSAP](https://gsap.com).

**Status:** Phase 5 (atmosphere) complete. See [PLAN.md](PLAN.md). Model credits are in [CREDITS.md](CREDITS.md).
**Play:** https://vedpawar1410.github.io/dream-setup/

## Controls
| Input | Action |
|---|---|
| Drag | Orbit |
| Right-drag / middle-drag | Pan |
| Scroll | Zoom |
| W A S D / arrow keys | Move around the room |
| Q / E | Turn 90° to the next corner view |
| R | Reset view (in decorate mode: rotate the selected item) |
| 1 / 2 / 3 | View / Decorate / Blueprint |
| C | Toggle decorate mode |
| B | Toggle blueprint mode |

**Decorate mode**
| Input | Action |
|---|---|
| Catalog card, then click | Place an item (floor, on top of furniture, on a wall or the ceiling, depending on the item) |
| Shift + click | Place and keep the same item in hand |
| R / Shift+R | Rotate 45° (the item in hand or the selected one) |
| Click an item | Select it |
| Drag an item | Move it, along with everything sitting on it |
| Cmd/Ctrl + D | Duplicate the selected item |
| Delete / Backspace | Remove the selected item (and what's on it) |
| Esc | Cancel placing → deselect → back to view mode |

**Customising (decorate mode, right panel)**
- Select an item to recolour each of its parts (wood, fabric, metal, RGB lighting…), or reset it.
- With nothing selected, the Room panel styles the **walls** (paint, stripes, floral, brick, panels, tiles) and the **floor** (planks, parquet, tiles, carpet, concrete) in any colour.
- Paint all walls at once, pick one with N/E/S/W, or just click a wall in the room.

**Atmosphere (top-right)**
- Five moods (sunny, sunset, rain, snow, night) blend smoothly into each other: light, sky, the view through the windows, and rain or snow falling around the room.
- Click a lamp, monitor, PC or LED strip in **View** mode to switch it on or off (or use the selection bar in Decorate). Lamps really light the room, which matters most at night.
- **RGB** sends every RGB part through the rainbow.

**Blueprint mode**
| Input | Action |
|---|---|
| Drag the round handles | Resize the room (10 cm snapping; hold Shift for free) |
| Panel → Window / Door, then click a wall | Add an opening |
| Click an opening | Select it (edit width, height and sill in the panel) |
| Drag an opening | Move it along a wall or onto another wall |
| Delete / Backspace | Remove the selected opening |
| Esc | Cancel placing → deselect → leave blueprint mode |

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
