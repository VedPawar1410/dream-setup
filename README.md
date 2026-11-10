# Roomlet

A cozy 3D sandbox for designing your dream room and desk setup, right in the browser:
shape the room, place and recolour furniture, change the weather, sit at your desk and take photos.
(Formerly *Dream Setup*.)

**Play:** https://vedpawar1410.github.io/dream-setup/ (works on desktop and phones; installable as an app)

| | Before the revive (Oct 2026) | Now (Nov 2026) |
|---|---|---|
| Accounts, cloud saves, share links | **Down** (Supabase project paused) | Up, kept awake by a scheduled job |
| Decorating on a phone | Two panels covered the room | One foldable bottom sheet, room stays in view |
| Worst first-time stutter (4x slower CPU) | 350 ms | 34 ms |
| Lighthouse accessibility / SEO | 98 / 90 | 100 / 100 |
| Automated tests | 0 | 19, run before every deploy |

<details>
<summary><b>How to use it</b> (controls and features)</summary>

### Controls
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

</details>

## How it works

```
                       ┌──────────────── browser (GitHub Pages, static) ─────────────────┐
  keyboard / mouse /   │                                                                  │
  touch  ───────────▶  │  HUD (React)  ──actions──▶  Zustand stores  ◀──reads──  3D scene  │
                       │  panels, sheet              roomStore: RoomDoc            (React   │
                       │  tabs, dock                 uiStore: mode, selection      Three    │
                       │       ▲                     settingsStore                 Fiber)   │
                       │       └──── renders from ───────┘   │                              │
                       │                                     ▼                              │
                       │                  persistence/migrate.ts  (every room passes here)  │
                       │                     │                     │                        │
                       │              IndexedDB (guests)    Supabase client (signed in)     │
                       └─────────────────────────────────────────────┼──────────────────────┘
                                                                     ▼
                                    Supabase: Postgres + row-level security, auth, model storage
                                    ▲  pinged twice a week by .github/workflows/keep-awake.yml
```

**Why these choices**
- **The room is one plain document** (`RoomDoc` in `src/store/roomStore.ts`). The scene and the HUD both render from it, so saving is `JSON.stringify`, undo is a stack of snapshots, and a bug can be reproduced by pasting a document.
- **React Three Fiber, not hand-written three.js:** the app is UI-heavy (catalog, inspector, colour pickers, saves), and keeping DOM and scene in sync by hand gets messy. Per-frame work goes through refs and `useFrame`, never React state.
- **Every room goes through `migrate()`** (saves, imports, share links), which fills in missing fields, clamps sizes and drops anything malformed. It's the most tested file.
- **Static frontend + Supabase:** no server to run. Data safety comes from row-level security in Postgres (`supabase/migrations/`), not from hiding the public key.
- **Design tokens:** every UI colour is defined once in the `:root` block of `src/index.css`. Colours used at several opacities are stored as RGB channels (`rgb(var(--accent-rgb) / 0.22)`), so changing one line re-themes every tint, glow and border.

## Results

Numbers from this session (10 Nov 2026) on a MacBook Air (Apple silicon), Chrome, production build.
Frame times were recorded with `requestAnimationFrame` while performing each action, with Chrome's CPU throttled 4x.

**Before vs. after**

| What | Before | After | How it was measured |
|---|---|---|---|
| Supabase project | `INACTIVE`, hostname gone | `ACTIVE_HEALTHY`; keep-alive job green | Supabase API + manual workflow run |
| First switch to Blueprint | 166 ms frame | 33–34 ms | rAF frame times, 2 fresh loads |
| First open of My rooms | 350 ms frame | 34 ms | same |
| First switch to Decorate | 84 ms frame | 51 ms | same |
| Weather changes, repeat mode switches | 18 ms | 18 ms (already smooth) | same |
| Phone (375x812), Decorate | catalog 45% + inspector 38% open at once | one sheet; room framed above it | DOM layout + screenshots |
| Photo mode on entering | whole room blurred | centre sharp, far walls soft | screenshots |
| Lighthouse (desktop) | A11y 98, BP 100, SEO 90 | 100, 100, 100 | Lighthouse in Chrome DevTools |
| Hard-coded colours in CSS rules | 33 distinct hex + 119 raw `rgb()` | 15 deliberate literals, 0 raw `rgb()`, 26 tokens | grep |
| Tests | none | 19 (Vitest) | `npm test` |

**Unchanged (measured once, at the start):** the room appears 1.9 s after opening the live site (2.3 s on throttled 4G with a 4x slower CPU); first load is about 670 KB over 24 requests; idle frame rate is 60 fps.

**Bundle (production build, gzip):** three.js 200 KB, other libraries 352 KB, app code 60 KB, CSS 7.5 KB; the Supabase client (55 KB) and QR code (7 KB) only load for features that need them.

## Project structure

```
index.html                 page shell + inline loading splash
public/                    models (Kenney CC0 .glb), sounds, music, icons, PWA manifest
src/
  main.tsx                 boot: splash, load your room (or a shared one), render
  App.tsx                  the <Canvas> and the HUD
  index.css                all UI styles; design tokens at the top
  anim/                    GSAP setup, camera intro, splash progress
  audio/                   sound effects (Web Audio) and the lo-fi player
  backend/                 Supabase: auth, cloud rooms, share links, uploaded items
  catalog/                 catalog data, model loading, code-built items, card thumbnails
  persistence/             IndexedDB saves, export/import, migrate() (+ tests)
  scene/                   everything 3D: room shell, items, lighting, weather, camera,
                           post-processing, photo mode, PhoneFraming, WarmUp
  store/                   Zustand stores, room geometry (layout.ts), placement rules (+ tests)
  ui/                      HUD panels: catalog, inspector, blueprint, rooms, share, photo bar,
                           SheetTabs (phone bottom sheet), settings, tour
supabase/migrations/       database schema and row-level security policies
.github/workflows/         deploy.yml (lint, test, build, Pages), keep-awake.yml
PLAN.md                    original research and v1/v2 build plan
CREDITS.md                 model, sound and music licences (all CC0)
```

## Run locally

```bash
npm ci
npm run dev       # http://localhost:5173
npm run lint      # oxlint
npm test          # Vitest
npm run build     # type-check + production build into dist/
npm run preview   # serve the build at http://localhost:4173/dream-setup/
```

Node 24 (same as CI). Without Supabase env vars the app uses the public project in `src/backend/config.ts`; set both values there to `''` to run guest-only.

## Deployment

- **Frontend:** GitHub Pages. Every push to `main` runs `.github/workflows/deploy.yml`: `npm ci` → `npm run lint` → `npm test` → `npm run build` → upload `dist/`. A failing test stops the deploy.
- **Backend:** Supabase free tier (project `dream-setup`, ap-south-1): Postgres with row-level security, auth, and a public `models` bucket for uploaded scans.
- **Keep-alive:** `.github/workflows/keep-awake.yml` makes one tiny read on Mondays and Thursdays so the free tier never pauses. If it fails, GitHub emails you.
- The site stays at `/dream-setup/`, and storage keys keep the `dream-setup:` prefix, so old share links, installed apps and saved rooms keep working after the rename.

## Limitations

- **Real-device checks still open:** tapping items with a finger, dragging furniture and the selection glow were not verified on a real phone (the test browser can't drive picking in the 3D scene). Weak GPUs weren't tested; "Auto" quality lowers resolution when the frame rate drops.
- **First Decorate still has one ~51 ms frame** (React building the catalog cards).
- **Free-tier limits:** about 1 GB of file storage, so roughly 40 uploaded scans at the 25 MB cap. GitHub disables the keep-alive schedule after 60 days without commits (it emails first).
- **Shared-room link previews are generic** (app icon and title), because a static site can't render a picture of each room.
- **Some colours live outside the tokens:** the splash (`index.html`) and 3D colours (`scene/dimensions.ts`, `scene/atmosphere.ts`) keep their own copies.
- **Only the room-loading and geometry code is tested;** the placement solver needs a 3D scene and isn't covered.

## Learning log: mistakes and what I learned

Built in layers; each records what went wrong and the lesson.

### Layer 1 - Research and v1 (8-9 Oct 2026, Claude Code)

*What I built:* a researched plan (PLAN.md), then phases 0-8 in two days: room shell and camera, blueprint mode, catalog and free placement, recolouring, weather, saves, first-person and photo mode, sound and a tour.

| # | Mistake | What actually happened | Lesson |
|---|---|---|---|
| 1.1 | **Framed as a remake of a commercial game** | PLAN.md opened with "A browser remake of My Dream Setup", and the name was nearly identical | Build in a genre, not a copy: give a project its own name and look from day one |
| 1.2 | **Colours typed by hand everywhere** | 6 CSS variables, but 33 distinct hex values and 119 raw `rgb()` calls; three different "danger" pinks (`#ff9aa9`, `#ffb3bf`, `#ff9db5`); `#7c5cd6` in CSS vs `#7d5bd6` in the share card | Define design tokens before the second screen; drift is invisible until you count it |
| 1.3 | **Phone layout only shrank the desktop panels** | Six `max-width: 640px` rules resized panels, but catalog (45%) and inspector (38%) were open at once and covered the room | Mobile needs its own layout decisions, and a real phone-size check before calling a phase done |
| 1.4 | **Used a library option whose meaning had changed** | `focalLength={0.03}` on the depth-of-field effect is now an alias for `focusRange` in metres: a 3 cm sharp zone, so photo mode opened blurry | When options are renamed, the old name can keep working with a new meaning; types won't catch it, screenshots will |

### Layer 2 - v2: accounts, sharing and content (10 Oct 2026, Claude Code)

*What I built:* resizing and undo/redo, Supabase accounts and cloud saves, view-only share links with QR codes, live screens and a lo-fi player, four themed packs, uploading your own scans, and L-shaped / two-room layouts, in one day.

| # | Mistake | What actually happened | Lesson |
|---|---|---|---|
| 2.1 | **Didn't plan for the free tier pausing** | A month later the project was `INACTIVE` and its hostname no longer resolved: sign-in, cloud saves and share links were down on the live site while guests saw nothing wrong | Know your platform's idle rules; add a keep-alive and a check that alerts you |
| 2.2 | **No tests while shipping a feature a day** | CI only linted and built; commit `a5244c8` had to "Restore toaster model removed by mistake" | Put tests on the code that can lose user data (save migration) before adding more features |
| 2.3 | **One-off costs landed on interactions** | The first switch to Blueprint froze for 166 ms (4x CPU) while three.js compiled shaders for hidden meshes | Smoothness is about the worst frame; move one-off work to idle time |

### Layer 3 - The revive (Nov 2026)

*What I did:* audited the live app, measured a baseline, and fixed it in eight small PRs, each deployed and checked before the next.

| # | Decision | Why |
|---|---|---|
| 3.1 | Restored Supabase and added a twice-weekly keep-alive job that fails loudly | Fixes 2.1; stays on the free tier |
| 3.2 | Moved every colour into tokens first, with **no visual change**, proven by a script that resolved every token and compared all 2,259 rule lines with the original | Refactor and restyle as separate steps, so if something broke I'd know which one did it (fixes 1.2) |
| 3.3 | Renamed to **Roomlet** with a warm "Sunroom" palette, but kept storage keys and the URL | The user-facing name can change; changing internal keys would have wiped everyone's saved rooms (fixes 1.1) |
| 3.4 | Phones get one foldable bottom sheet, a touch placing bar (there's no Esc on a phone), and a camera view offset so the room sits above the sheet | Fixes 1.3; the view offset moves the image, not the camera, so taps still line up |
| 3.5 | `focusRange={2.5}` metres for depth of field | Fixes 1.4 |
| 3.6 | Warm up shaders with `gl.compileAsync()` after the intro and render thumbnails in idle time | Fixes 2.3: worst first-time frames 166/350 ms → 34 ms |
| 3.7 | Vitest 5.0.5 (picked over 5.1.0, which was 8 days old) with 19 tests, checked by breaking the code on purpose | Fixes 2.2; a test that never fails proves nothing |
| 3.8 | Dropped the planned "thumbnail placeholder" fix | It already existed; the "blank card" in the audit was the shimmer, so I checked before building |

*Known gaps I chose not to fix:* real-phone checks of tapping, dragging and the selection glow; the one remaining ~51 ms frame on first Decorate; generic link previews; tests for the placement solver; 19 different corner radii not yet merged into a scale.

### Key takeaways

1. **Measure before fixing.** The "smoothness" problem turned out to be three one-off freezes, not a slow app.
2. **The live site can break without a code change.** A free-tier pause took accounts down for weeks; monitoring matters as much as code.
3. **Tokens turn a redesign into a one-line change.** The full re-theme touched about 15 values.
4. **Separate refactors from visual changes**, and prove the refactor changed nothing.
5. **User-facing names and internal keys are different things.** Rename the first, keep the second.

## Roadmap, ideas and to-dos

Everything planned or noticed but not built yet. New ideas go here first.

### Next feature: Designs (v3)
Put your own designs on things: a laptop lid, a TV or monitor, a tabletop, rugs and floor mats.
- **Approach chosen: design slots.** Each item defines flat areas that can carry a design. You pick from a small built-in pack of CC0 designs or upload your own image. Reuses the existing screen-wallpaper code; simple and predictable.
- **Later: search designs online** through a Creative Commons image library such as Openverse. Needs licence and credit display, and some images will fail to load because of cross-site browser restrictions.
- **Considered, not chosen: free-placed stickers** (drei `<Decal>`, click anywhere on any object). Flexible but fiddly on curved surfaces.
- **Plan for storage:** compress uploaded images, since the free tier has about 1 GB in total.
- **Build it as its own planned phase**, on top of the tokens and phone layout from the revive.

### To-dos and open checks
- [ ] On a real phone: tap an item (the Item tab should open and the selection bar appear), drag furniture, judge the selection glow (calmer is one number in `scene/looks.ts`).
- [ ] Sign in on the live site, open Share, and check the QR card is warm-coloured and still scans.
- [ ] Supabase dashboard → Authentication → Emails: change "Dream Setup" to "Roomlet" in the email templates.
- [ ] If GitHub emails that "Keep Supabase awake" was disabled (60 days without commits), re-enable it in the Actions tab.
- [ ] Delete the merged branches: `git push origin --delete <branch>` and `git branch -d <branch>` (`-d` refuses to delete anything unmerged).

### Smaller improvements
- [ ] Merge the 19 different corner radii into a small radius scale, and put animation durations into motion tokens.
- [ ] Touch-friendly tour text (the first-visit tour still talks about keys and dragging with a mouse).
- [ ] Remove the last ~51 ms frame on the first Decorate (spread the card build over a few frames).
- [ ] Give code-built items Sunroom default colours (the poster, LED strip and monitor wallpaper still start purple).
- [ ] Keep the splash and 3D colours (`index.html`, `scene/dimensions.ts`, `scene/atmosphere.ts`) in step with the CSS tokens, or generate them from one source.
- [ ] Tests for the placement solver (needs a small three.js scene in the test).
- [ ] Check on a weak-GPU device; consider lazy-loading post-processing to shrink the 352 KB library chunk.
- [ ] Per-room link previews (needs something server-side to render an image of each room).
- [ ] `THREE.Clock` deprecation warning comes from React Three Fiber; goes away with an upstream update.

### Ideas parking lot
- **AI room layout: "describe your room in words → Claude lays out the furniture".** You type something like "a cozy study with a big desk by the window and a reading corner", and Claude places the furniture.
  - *How:* the Claude API with tool calls (for example `place_item`, `set_wall_finish`, `set_weather`) that map onto the existing store actions. Every proposed room goes through `migrate()` and the placement rules (`isValid`, `rectsOverlap`, `onFloor`), so a bad suggestion is rejected or corrected instead of breaking the scene. Errors go back to Claude so it can fix its own layout.
  - *Catch to plan for:* the site is static, so the API key can't live in the browser. It needs a small server-side piece, such as a Supabase Edge Function, plus a per-user rate limit, because each request costs money.
  - *Why it's worth it:* it would make Roomlet show AI and agent skills (tool use, validating model output against real rules), not only frontend work.
- More ideas will come as the project grows; add them here before planning them.
