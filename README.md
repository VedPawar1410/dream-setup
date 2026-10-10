# Dream Setup

A cozy browser sandbox for designing your dream room and desk setup, inspired by
[My Dream Setup](https://store.steampowered.com/app/2200780/My_Dream_Setup/).
Built with [three.js](https://threejs.org) and [GSAP](https://gsap.com).

**Status:** v1 and v2 complete: editing upgrades, accounts and cloud saves, share links, the living desk, themed packs, your own scanned items, and L-shaped / two-room layouts. See [PLAN.md](PLAN.md) for the roadmap; model, sound and music credits are in [CREDITS.md](CREDITS.md).
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
| F | Sit at your desk (first person) |
| P | Photo mode |
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
| [ / ] | Shrink / grow the selected item by 10% |
| Cmd/Ctrl + Z, Shift + Cmd/Ctrl + Z | Undo / redo (also the arrow buttons in the dock) |
| Delete / Backspace | Remove the selected item (and what's on it) |
| Esc | Cancel placing → deselect → back to view mode |

**Customising (decorate mode, right panel)**
- Select an item to **resize** it (width, depth, height in cm; drag a label or type; unlock to stretch one side) and to recolour each of its parts (wood, fabric, metal, RGB lighting…). Things on top ride along; growing against a wall nudges it into the room.
- With nothing selected, the Room panel styles the **walls** (paint, stripes, floral, brick, panels, tiles) and the **floor** (planks, parquet, tiles, carpet, concrete) in any colour.
- Paint all walls at once, pick one with N/E/S/W, or just click a wall in the room.

**Living desk**
- Monitors and TVs are live: pick **Wallpaper, Clock, Code or Visualiser** per screen in the Inspector.
- PC fans and ceiling fans spin while switched on.
- **Lo-fi player** (music note, bottom-right): five CC0 tracks, play/skip/volume, a spinning record. Click a radio in your room to play or pause. RGB lights pulse with the bass, and the visualiser screen dances along.

**Themed packs** (new catalog tabs)
- **Kitchen:** fridges, stove, sink, cabinets, island, wall cabinets, hood, microwave, coffee machine, blender, toaster, washer and dryer.
- **Garage:** workbench, tool wall, toolbox, tyre, go-kart and a sports car.
- **Pets:** cat, dog, bunny, parrot, chick, penguin plush, cat tree, pet bed, food bowls and an aquarium with swimming fish.
- **Sim racing:** a racing cockpit (press **F** to sit in it if there's no desk chair) and triple monitors with live screens.

**Your own items** (signed in)
- Scan a real object with a free phone app (Polycam, Scaniverse, KIRI Engine), export **GLB** (under 25 MB).
- Decorate → **My items** → **Add your own**: upload it, check the preview, set its real height and where it goes, and place it.
- Or scan the QR in that panel to upload straight from your phone; it pops up on your computer instantly.
- Rooms carry the items they use, so shared and exported rooms show them too.

**Atmosphere (top-right)**
- Five moods (sunny, sunset, rain, snow, night) blend smoothly into each other: light, sky, the view through the windows, and rain or snow falling around the room.
- Click a lamp, monitor, PC or LED strip in **View** mode to switch it on or off (or use the selection bar in Decorate). Lamps really light the room, which matters most at night.
- **RGB** sends every RGB part through the rainbow.

**Saving (automatic)**
- **Sign in** (next to the room name) to keep your rooms in your account, on every device. Guests still save in this browser, and signing in offers to copy those rooms over.
- **Share** a room (signed in): My rooms → Share → Create share link. Anyone with the link or QR code can look around, sit at the desk and take photos, but can't change anything. "Save a copy" puts it in their own rooms. Stop sharing (or New link) kills old links.
- Install it as an app: Chrome/Edge show an install icon in the address bar; on a phone use "Add to Home Screen".
- Your room saves itself in this browser a moment after every change (IndexedDB; nothing leaves your machine).
- Click the room name under the title, or press **M**, for **My rooms**: open, rename (double-click), duplicate or delete rooms, start a new or empty room, and export/import a room as a `.dreamroom.json` file.

**Sit at your desk (F)**
- The camera flies down to the first chair it finds (your desk chair, if you have one) and you look around from eye height. Drag to turn your head; **Esc** or **F** stands you back up.

**Photo mode (P)**
- The HUD slides away and a photo bar appears: six filters (Natural, Warm, Cool, Mono, Vintage, Dreamy), a **Blur** slider for depth of field, and a shutter.
- Click anything in the scene to focus on it. The shutter flashes and shows a polaroid of the shot, which you can **Download** as a PNG.
- Works from the dollhouse view or while seated. **Done** or **Esc** leaves.

**Settings (gear, bottom-right)**
- **Sound** on or off. Every action has a sound, and rain and wind fade in with the weather.
- **Graphics**: Auto watches your frame rate and steps down if things get choppy; High renders at full retina resolution with ambient occlusion; Low is for older laptops.
- **Show the tour again** replays the four-step intro that appears on your first visit.
- The OS "reduce motion" setting shortens the camera intro and seat flights.

**Blueprint mode**
- **Shape:** Rectangle, **L-shape** (pick the cut-out corner, slide its width and depth) or **Two rooms** (a divider wall with a doorway; slide where it goes, add doors and windows to it like any wall). Furniture in the way stops a reshape instead of being moved for you.
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

Stack: Vite · React 19 · TypeScript · React Three Fiber + drei · GSAP · Zustand · IndexedDB (idb) · Supabase (auth + Postgres with row-level security; schema in `supabase/migrations/`).
Pushes to `main` deploy to GitHub Pages via `.github/workflows/deploy.yml`.

## Features
- Blueprint mode: shape the room, place doors and windows
- Free placement of furniture, PC gear, plants and decor, with stacking and snapping
- Full RGB recoloring, wall paints and wallpapers, floor materials
- Five weather moods (sunny, sunset, rain, snow, night) with animated transitions and RGB lighting
- Dollhouse camera, plus a first-person view from your desk
- Photo mode with filters, depth of field and PNG export
- Autosave and save slots in the browser, with export/import
- Sound effects and weather ambience, a first-visit tour, and adaptive graphics quality
