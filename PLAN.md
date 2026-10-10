# Dream Setup — Build Plan

A browser remake of **My Dream Setup** (Campfire Studio, 2023): a relaxed, goal-free sandbox for
designing your ideal room / desk setup. Built with **three.js** and **GSAP**.

---

## 1. Research summary — what the original does

| Area | Original game | Our version |
|---|---|---|
| Blueprint mode | Walls, windows, doors; rectangular room only; editable any time | Same, with smooth animated wall edits. Rectangle in v1, L-shapes later |
| Decorate mode | Categorised catalog, free (non-grid) placement, move/rotate/duplicate/delete, stacking moves together | Same + surface/wall/corner snapping and "keep placing" duplicates |
| Customisation | Full RGB recolor on every item, doors, windows, background; wallpapers & paints per wall or all walls | Same + floor materials (original had only one) |
| Atmosphere | 5 weather states: sunny, sunset, rain, snow, night; droplets on windows; RGB lighting; toggleable electronics | Same, with GSAP-tweened transitions between states |
| Camera | Isometric dollhouse; WASD/middle-mouse pan, scroll zoom, Q/E rotate (choppy) | Smooth damped orbit + **first-person "sit at desk" mode** |
| Saves | Autosave, 5 slots | Autosave, unlimited slots w/ thumbnails, JSON export/import |
| Extras | Lo-fi music, Steam Workshop, DLCs (Garage, Kitchen, Bathroom, Pets, Sim Racing, Shopping) | **Photo mode** in v1; music/DLC themes later |

**Reviewer complaints we'll deliberately fix:** choppy camera, no tutorial/hints, no snapping for wall
items, can't place items in corners, can't chain-duplicate, thin catalog in places, rigid room shape.

Sources: [Steam page](https://store.steampowered.com/app/2200780/My_Dream_Setup/),
[Gameluster review](https://gameluster.com/review-my-dream-setup-room-to-grow/),
[Metacritic](https://www.metacritic.com/game/my-dream-setup/),
[itch.io](https://itch.io/blog/981502/my-dream-setup-game)

---

## 2. Architecture options

### A. Vanilla TypeScript + Vite + three.js
Hand-written scene graph and DOM UI.
- ✅ No abstraction between you and three.js; best for learning the raw API; smallest bundle
- ❌ The game is **UI-heavy** (catalog, color picker, toolbars, save slots, photo controls). Keeping
  hand-written DOM in sync with scene state is where vanilla projects turn into spaghetti.

### B. Vite + React + React Three Fiber (R3F) + drei + Zustand + GSAP — **recommended**
R3F *is* three.js (a React renderer for it; you can drop to raw `THREE.*` anywhere).
- ✅ The room becomes **one serialisable document** in a Zustand store; the 3D scene and the HUD both
  render from it. Save/load, autosave, thumbnails and (later) undo/redo fall out almost for free.
- ✅ drei gives battle-tested pieces: `useGLTF`, `Environment`, `ContactShadows`, `Bvh` (fast raycasts),
  `CameraControls`; `@react-three/postprocessing` for bloom/AO/DOF.
- ✅ Matches your default React/TS stack. GSAP integrates via `@gsap/react` (`useGSAP`).
- ⚠️ Pitfall: per-frame updates must go through refs + `useFrame`, **never** React state, or you
  re-render 60×/s. I'll keep that discipline and call it out as we go.

### C. Next.js + R3F
- ❌ SSR/routing add nothing to a single-canvas client game and make WebGL setup harder
  (`"use client"`, dynamic imports). **Deliberate deviation from the default stack.**

**Also deviating:** no FastAPI/Postgres. A single-player browser game needs no backend;
saves go in IndexedDB. A backend only becomes worth it for sharing rooms between people.

---

## 3. Core design (the "why")

### Room-as-document
```ts
type RoomDoc = {
  version: 1
  shell: { width: number; depth: number; height: number;
           walls: WallFinish[]; floor: FloorFinish; openings: Opening[] }  // doors/windows on walls
  items: PlacedItem[]          // { id, catalogId, pos, rotY, colors, parentId?, on? }
  atmosphere: { weather: 'sunny'|'sunset'|'rain'|'snow'|'night'; rgbMode: ... }
}
```
Everything visible derives from this plain object. That makes saving `JSON.stringify(doc)`;
undo a stack of snapshots; and bugs reproducible by pasting a doc. **Rule:** components read
the doc; only store actions write it.

### Placement system
Each catalog item declares a **mount type**: `floor | wall | surface | ceiling`.
1. Raycast pointer → hit floor / wall / an item's top surface (drei `Bvh` keeps this fast).
2. Position the ghost preview on that hit, clamped inside the room.
3. Collision via bounding boxes (`Box3`). The ghost tints red if blocked.
4. Dropping on a surface sets `parentId`, so moving a desk carries the monitor with it (the
   original game does the same).
5. Snapping: flush to walls, into corners, rotation in 15° steps (hold Shift for free rotation).

### Assets: hybrid
- **CC0 GLTF packs** for the main catalog: Kenney Furniture Kit, Quaternius, plus CC0-only models from
  Poly Pizza. Optimised with `gltf-transform` (meshopt + texture compression).
- **Built in code** for things that need behaviour: walls/openings, PC tower with glass and fans,
  monitors, LED strips, RGB keyboards, lamps.
- Recolor: each catalog entry names its recolorable material slots (`primary`, `accent`); the
  colour picker tints those materials only.
- One shared material palette and lighting keep the different packs looking consistent.

### Rendering and look
- `ACESFilmic`/`AgX` tone mapping, soft shadows, HDR `Environment` for reflections
- Post-processing: N8AO (ambient occlusion), selective **bloom** (RGB/screens/lamps only), vignette
- Window view: a gradient sky plus a simple outdoor backdrop that changes with the weather
- Rain/snow: GPU particles outside; a droplet shader on the window glass

### Where GSAP is used
| Moment | Animation |
|---|---|
| Boot | Title reveal (SplitText), camera swoops into the room |
| Place item | Drop in with a squash-and-settle ease, plus a shadow pulse |
| Delete item | Scale and fade out |
| Mode switch | Walls fade to wireframe for blueprint mode, catalog panel slides in, toolbar staggers in |
| Weather change | Light colour/intensity, sky colour, fog and window view tweened together over ~1.5s |
| Camera | Q/E rotate as eased 90° tweens; **dollhouse → first-person** flight path |
| Photo mode | UI collapses away, shutter flash, polaroid-style save preview |
| UI | Catalog Flip transitions between categories, hover lifts, toasts |

---

## 4. Project structure
```
src/
  main.tsx, App.tsx
  store/        roomStore.ts (RoomDoc + actions), uiStore.ts (mode, selection, camera)
  scene/        Experience.tsx, RoomShell.tsx, Openings.tsx, Items.tsx, Lighting.tsx,
                Weather.tsx, WindowView.tsx, PostFX.tsx, cameras/
  systems/      placement.ts, collision.ts, snapping.ts
  catalog/      catalog.ts (data), procedural/ (code-built items)
  ui/           HUD, Toolbar, CatalogPanel, ColorPicker, BlueprintTools, SaveSlots, PhotoMode
  anim/         GSAP timelines and easing presets
  persistence/  IndexedDB saves, autosave, thumbnails
public/models/  optimised .glb files
```

---

## 5. Phased build (each phase ends with something playable)

| # | Phase | Deliverable |
|---|---|---|
| 0 | Scaffold | Vite + React + TS + R3F + GSAP; lint; GitHub Pages deploy pipeline |
| 1 | Room and camera | Lit room shell, smooth dollhouse camera (pan/zoom/Q-E), post-processing, intro animation |
| 2 | Blueprint mode | Resize room, add/move/remove doors and windows on walls, with animated transitions |
| 3 | Catalog and placement | Catalog UI, ghost preview, floor/wall/surface mounting, collision, stacking, move/rotate/duplicate/delete |
| 4 | Customisation | Per-item RGB recolor, wall paints/wallpapers (per wall or all walls), floor materials |
| 5 | Atmosphere | 5 weather presets with GSAP transitions, window view, rain/snow, droplets, RGB lights, toggleable lamps and electronics |
| 6 | Saves | IndexedDB slots, autosave, thumbnails, JSON export/import |
| 7 | First-person and photo mode | Fly-in to desk view; photo mode with DOF, filters and PNG export |
| 8 | Polish | Onboarding hints, sound effects, performance pass (quality presets), deploy |

**Later (not v1):** undo/redo, working monitor screens and fan animation, lo-fi music player,
L-shaped and multi-room layouts, themed packs (garage, kitchen, pets, sim racing).

---

## 5b. v2 roadmap (accounts, sharing, living desk)

Decided with Ved: Supabase for accounts/data/files (frontend stays on Pages), view-only share links + QR,
phone-scan upload for your own objects, bundled royalty-free lo-fi music.

| # | Phase | Deliverable |
|---|---|---|
| 2.1 | Editing upgrades | Loading %, cute synthesised drop sounds + squash landing, undo/redo, resizable items |
| 2.2 | Accounts | Supabase auth, cloud saves (IndexedDB stays as offline cache), local → account migration, installable PWA |
| 2.3 | Sharing | Revocable view-only links (`?s=token`) via a security-definer function, QR codes, viewer mode + "make a copy" |
| 2.4 | Living desk | Animated monitor screens, spinning fans, lo-fi player with visualiser |
| 2.5 | Themed packs | Garage, kitchen, pets, sim racing |
| 2.6 | Your own objects | Upload GLB scans (desktop or phone via QR), set real size, "My items" |
| 2.7 | L-shaped & multi-room | Footprint as rectangles, wall ids, partitions, migration of every saved room |

## 6. Risks and tradeoffs
- **Mixed asset styles:** packs from different authors can clash. *Mitigation:* use Kenney as the
  primary style, shared material overrides, and one lighting setup.
- **GPU cost on laptops:** AO, bloom and soft shadows add up. *Mitigation:* Low/High quality toggle,
  and `PerformanceMonitor` lowers DPR automatically.
- **Free placement is the hardest system.** Corner cases include rotated bounding boxes, stacking chains,
  and items on top of items on walls. Getting phase 3 right matters most.
- **Recoloring textured GLTFs:** tinting a textured material multiplies colours. Some models will need
  material edits in the optimisation step.
- **Asset licences:** use only CC0 models (Poly Pizza mixes CC0 and CC-BY), recorded in `CREDITS.md`.
- **Scope creep:** the original has 2,000+ items. Aim for about 60–100 good items in v1.
