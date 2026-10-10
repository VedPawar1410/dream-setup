export type Mount = 'floor' | 'surface' | 'wall' | 'ceiling'
export type Category = 'desk' | 'seating' | 'tables' | 'beds' | 'storage' | 'lighting' | 'decor' | 'plants' | 'kitchen' | 'garage' | 'pets' | 'racing' | 'mine'
export type ProceduralId =
  | 'pcTower'
  | 'monitorWide'
  | 'deskMat'
  | 'wallShelf'
  | 'posterSunset'
  | 'posterOcean'
  | 'posterShapes'
  | 'ledStrip'
  // Themed packs (packs.ts)
  | 'workbench'
  | 'pegboard'
  | 'toolbox'
  | 'simRig'
  | 'tripleMonitor'
  | 'catTree'
  | 'dogBed'
  | 'petBowls'
  | 'aquarium'

export type CatalogItem = {
  id: string
  name: string
  category: Category
  /** Where it can go. 'surface' items sit on the floor *or* on top of other items. */
  mount: Mount
  /** Other items can be placed on top of it. */
  surface?: boolean
  /** Flat things (rugs) that never block other items. */
  flat?: boolean
  /** Lamps: a real light at this fraction of the item's height. */
  light?: { y: number; intensity: number; distance: number }
  /** Electronics whose glowing parts switch off with the power. */
  glows?: boolean
  /**
   * Has a live screen. `rect` adds one to models without a separate screen part:
   * width, height, centre height and front depth as fractions of the model's size.
   */
  screen?: { aspect: number; rect?: { w: number; h: number; y: number; z: number } }
  /** The whole model spins (radians/s) while switched on: ceiling fans. */
  spin?: number
  /** Clicking it in view mode plays or pauses the lo-fi player. */
  music?: boolean
  model:
    | { kind: 'glb'; file: string; scale: number; yaw: number }
    | { kind: 'procedural'; build: ProceduralId }
    // Your own uploads: a GLB at a URL, scaled so it stands `height` metres tall
    | { kind: 'url'; url: string; height: number }
}

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'desk', label: 'Desk & Tech' },
  { id: 'seating', label: 'Seating' },
  { id: 'tables', label: 'Tables' },
  { id: 'beds', label: 'Bedroom' },
  { id: 'storage', label: 'Storage' },
  { id: 'lighting', label: 'Lighting' },
  { id: 'decor', label: 'Decor' },
  { id: 'plants', label: 'Plants' },
  // Themed packs
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'garage', label: 'Garage' },
  { id: 'pets', label: 'Pets' },
  { id: 'racing', label: 'Sim Racing' },
  { id: 'mine', label: 'My items' },
]

// Kenney's furniture is modelled at roughly half scale: ×1.9 puts a desk top at a real 73 cm.
const K = 1.9

type Opts = Pick<CatalogItem, 'surface' | 'flat' | 'light' | 'glows' | 'screen' | 'spin' | 'music'> & { scale?: number; yaw?: number; file?: string }

function kenney(id: string, name: string, category: Category, mount: Mount, o: Opts = {}): CatalogItem {
  const { scale, yaw, file, ...rest } = o
  return { id, name, category, mount, ...rest, model: { kind: 'glb', file: file ?? `kenney/${id}.glb`, scale: scale ?? K, yaw: yaw ?? 0 } }
}

function made(id: ProceduralId, name: string, category: Category, mount: Mount, o: Opts = {}): CatalogItem {
  return { id, name, category, mount, ...o, model: { kind: 'procedural', build: id } }
}

const top = { surface: true }
const glows = { glows: true }
const floorLamp = { light: { y: 0.88, intensity: 3, distance: 4.5 } }
const tableLamp = { light: { y: 0.75, intensity: 1.6, distance: 2.8 } }

export const CATALOG: CatalogItem[] = [
  // Desk & tech
  kenney('desk', 'Desk', 'desk', 'floor', top),
  kenney('deskCorner', 'Corner Desk', 'desk', 'floor', top),
  made('monitorWide', 'Ultrawide Monitor', 'desk', 'surface', { glows: true, screen: { aspect: 2.4 } }),
  kenney('computerScreen', 'Monitor', 'desk', 'surface', { glows: true, screen: { aspect: 16 / 9, rect: { w: 0.88, h: 0.56, y: 0.7, z: 0.5 } } }),
  kenney('computerKeyboard', 'Keyboard', 'desk', 'surface'),
  kenney('computerMouse', 'Mouse', 'desk', 'surface'),
  made('pcTower', 'Gaming PC', 'desk', 'surface', glows),
  made('deskMat', 'Desk Mat', 'desk', 'surface', top),
  kenney('laptop', 'Laptop', 'desk', 'surface'),
  kenney('speakerSmall', 'Desk Speaker', 'desk', 'surface'),
  kenney('speaker', 'Tower Speaker', 'desk', 'floor'),
  kenney('radio', 'Radio', 'desk', 'surface', { music: true }),
  kenney('televisionModern', 'TV', 'desk', 'surface', { glows: true, screen: { aspect: 16 / 9, rect: { w: 0.9, h: 0.7, y: 0.6, z: 0.5 } } }),
  kenney('televisionVintage', 'Retro TV', 'desk', 'surface'),

  // Seating
  kenney('chairDesk', 'Office Chair', 'seating', 'floor'),
  kenney('chair', 'Wooden Chair', 'seating', 'floor'),
  kenney('chairCushion', 'Cushioned Chair', 'seating', 'floor'),
  kenney('chairModernCushion', 'Modern Chair', 'seating', 'floor'),
  kenney('chairRounded', 'Round Chair', 'seating', 'floor'),
  kenney('loungeChair', 'Armchair', 'seating', 'floor'),
  kenney('loungeChairRelax', 'Recliner', 'seating', 'floor'),
  kenney('loungeDesignChair', 'Designer Chair', 'seating', 'floor'),
  kenney('loungeSofa', 'Sofa', 'seating', 'floor'),
  kenney('loungeSofaLong', 'Long Sofa', 'seating', 'floor'),
  kenney('loungeSofaCorner', 'Corner Sofa', 'seating', 'floor'),
  kenney('loungeDesignSofa', 'Designer Sofa', 'seating', 'floor'),
  kenney('loungeSofaOttoman', 'Ottoman', 'seating', 'floor', top),
  kenney('stoolBar', 'Bar Stool', 'seating', 'floor'),
  kenney('benchCushion', 'Bench', 'seating', 'floor', top),

  // Tables
  kenney('table', 'Dining Table', 'tables', 'floor', top),
  kenney('tableRound', 'Round Table', 'tables', 'floor', top),
  kenney('tableGlass', 'Glass Table', 'tables', 'floor', top),
  kenney('tableCoffee', 'Coffee Table', 'tables', 'floor', top),
  kenney('tableCoffeeGlass', 'Glass Coffee Table', 'tables', 'floor', top),
  kenney('sideTable', 'Side Table', 'tables', 'floor', top),
  kenney('sideTableDrawers', 'Nightstand', 'tables', 'floor', top),

  // Bedroom
  kenney('bedSingle', 'Single Bed', 'beds', 'floor', { scale: 1.2 }),
  kenney('bedDouble', 'Double Bed', 'beds', 'floor', { scale: 1.2 }),
  kenney('bedBunk', 'Bunk Bed', 'beds', 'floor', { scale: 1.2 }),
  kenney('cabinetBed', 'Bed Cabinet', 'beds', 'floor', top),
  kenney('cabinetBedDrawer', 'Dresser', 'beds', 'floor', top),
  kenney('cabinetBedDrawerTable', 'Bedside Drawers', 'beds', 'floor', top),

  // Storage
  kenney('bookcaseOpen', 'Bookcase', 'storage', 'floor', top),
  kenney('bookcaseOpenLow', 'Low Bookcase', 'storage', 'floor', top),
  kenney('bookcaseClosed', 'Cabinet', 'storage', 'floor', top),
  kenney('bookcaseClosedDoors', 'Closed Cabinet', 'storage', 'floor', top),
  kenney('bookcaseClosedWide', 'Wide Cabinet', 'storage', 'floor', top),
  kenney('cabinetTelevision', 'TV Stand', 'storage', 'floor', top),
  kenney('cabinetTelevisionDoors', 'Media Cabinet', 'storage', 'floor', top),
  made('wallShelf', 'Wall Shelf', 'storage', 'wall', top),
  kenney('coatRackStanding', 'Coat Rack', 'storage', 'floor'),
  kenney('cardboardBoxClosed', 'Box', 'storage', 'surface', top),
  kenney('cardboardBoxOpen', 'Open Box', 'storage', 'surface'),
  kenney('trashcan', 'Bin', 'storage', 'floor'),

  // Lighting
  kenney('lampRoundFloor', 'Floor Lamp', 'lighting', 'floor', floorLamp),
  kenney('lampSquareFloor', 'Square Floor Lamp', 'lighting', 'floor', floorLamp),
  kenney('lampRoundTable', 'Table Lamp', 'lighting', 'surface', tableLamp),
  kenney('lampSquareTable', 'Square Table Lamp', 'lighting', 'surface', tableLamp),
  kenney('lampWall', 'Wall Lamp', 'lighting', 'wall', { light: { y: 0.5, intensity: 1.6, distance: 3 } }),
  made('ledStrip', 'LED Strip', 'lighting', 'wall', glows),
  kenney('lampSquareCeiling', 'Ceiling Light', 'lighting', 'ceiling', { light: { y: 0, intensity: 3.5, distance: 6 } }),
  kenney('ceilingFan', 'Ceiling Fan', 'lighting', 'ceiling', { scale: 2.4, light: { y: 0, intensity: 2.5, distance: 5 }, spin: 2.6 }),

  // Decor
  kenney('rugRectangle', 'Rug', 'decor', 'floor', { flat: true, scale: 1.3 }),
  kenney('rugRound', 'Round Rug', 'decor', 'floor', { flat: true, scale: 1.3 }),
  kenney('rugRounded', 'Rounded Rug', 'decor', 'floor', { flat: true, scale: 1.3 }),
  kenney('rugSquare', 'Square Rug', 'decor', 'floor', { flat: true, scale: 1.3 }),
  kenney('rugDoormat', 'Doormat', 'decor', 'floor', { flat: true }),
  made('posterSunset', 'Sunset Poster', 'decor', 'wall'),
  made('posterOcean', 'Wave Poster', 'decor', 'wall'),
  made('posterShapes', 'Bauhaus Poster', 'decor', 'wall'),
  kenney('books', 'Books', 'decor', 'surface'),
  kenney('bear', 'Teddy Bear', 'decor', 'surface'),

  // Plants
  kenney('pottedPlant', 'Potted Plant', 'plants', 'floor'),
  kenney('plantSmall1', 'Small Plant', 'plants', 'surface'),
  kenney('plantSmall2', 'Succulent', 'plants', 'surface'),
  kenney('plantSmall3', 'Cactus', 'plants', 'surface'),

  // ----- Themed packs -----

  // Kitchen (Kenney Furniture Kit)
  kenney('kitchenFridge', 'Fridge', 'kitchen', 'floor'),
  kenney('kitchenFridgeLarge', 'Double Fridge', 'kitchen', 'floor'),
  kenney('kitchenStove', 'Stove', 'kitchen', 'floor', { surface: true }),
  kenney('kitchenSink', 'Sink Unit', 'kitchen', 'floor', { surface: true }),
  kenney('kitchenCabinet', 'Base Cabinet', 'kitchen', 'floor', { surface: true }),
  kenney('kitchenCabinetDrawer', 'Drawer Cabinet', 'kitchen', 'floor', { surface: true }),
  kenney('kitchenBar', 'Kitchen Island', 'kitchen', 'floor', { surface: true }),
  kenney('kitchenCabinetUpper', 'Wall Cabinet', 'kitchen', 'wall'),
  kenney('kitchenCabinetUpperDouble', 'Double Wall Cabinet', 'kitchen', 'wall'),
  kenney('hoodModern', 'Cooker Hood', 'kitchen', 'wall'),
  kenney('kitchenMicrowave', 'Microwave', 'kitchen', 'surface'),
  kenney('kitchenCoffeeMachine', 'Coffee Machine', 'kitchen', 'surface'),
  kenney('kitchenBlender', 'Blender', 'kitchen', 'surface'),
  kenney('toaster', 'Toaster', 'kitchen', 'surface'),
  kenney('washer', 'Washing Machine', 'kitchen', 'floor', { surface: true }),
  kenney('dryer', 'Dryer', 'kitchen', 'floor', { surface: true }),
  kenney('stoolBarSquare', 'Square Bar Stool', 'kitchen', 'floor'),

  // Garage (workbench, tools: code-built; vehicles and tyre: Kenney Car Kit)
  made('workbench', 'Workbench', 'garage', 'floor', { surface: true }),
  made('pegboard', 'Tool Wall', 'garage', 'wall'),
  made('toolbox', 'Toolbox', 'garage', 'surface'),
  kenney('tyre', 'Tyre', 'garage', 'surface', { file: 'kenney-cars/debris-tire.glb', scale: 1.1 }),
  kenney('goKart', 'Go-Kart', 'garage', 'floor', { file: 'kenney-cars/kart-oobi.glb', scale: 1.1 }),
  kenney('sportsCar', 'Sports Car', 'garage', 'floor', { file: 'kenney-cars/sedan-sports.glb', scale: 1.4 }),

  // Sim racing (code-built)
  made('simRig', 'Racing Cockpit', 'racing', 'floor'),
  made('tripleMonitor', 'Triple Monitors', 'racing', 'floor', { glows: true, screen: { aspect: 16 / 9 } }),

  // Pets (animals: Kenney Cube Pets; pet gear: code-built). Animals sit on the floor or on furniture.
  kenney('petCat', 'Cat', 'pets', 'surface', { file: 'kenney-pets/animal-cat.glb', scale: 0.18 }),
  kenney('petDog', 'Dog', 'pets', 'surface', { file: 'kenney-pets/animal-dog.glb', scale: 0.27 }),
  kenney('petBunny', 'Bunny', 'pets', 'surface', { file: 'kenney-pets/animal-bunny.glb', scale: 0.14 }),
  kenney('petParrot', 'Parrot', 'pets', 'surface', { file: 'kenney-pets/animal-parrot.glb', scale: 0.19 }),
  kenney('petChick', 'Chick', 'pets', 'surface', { file: 'kenney-pets/animal-chick.glb', scale: 0.09 }),
  kenney('petPenguin', 'Penguin Plush', 'pets', 'surface', { file: 'kenney-pets/animal-penguin.glb', scale: 0.2 }),
  made('catTree', 'Cat Tree', 'pets', 'floor', { surface: true }),
  made('dogBed', 'Pet Bed', 'pets', 'floor', { surface: true }),
  made('petBowls', 'Food Bowls', 'pets', 'floor'),
  made('aquarium', 'Aquarium', 'pets', 'surface', { glows: true }),
]

export const catalogById = new Map(CATALOG.map((item) => [item.id, item]))

// ---------- Your own items ----------

/** What a room needs to show one of your uploads: kept inside the room, so shared and exported rooms carry it. */
export type CustomDef = { name: string; url: string; height: number; mount: 'floor' | 'surface' | 'wall' }

export const CUSTOM_PREFIX = 'custom:'
export const isCustomId = (id: string) => id.startsWith(CUSTOM_PREFIX)

/** Make an upload known to the catalog (idempotent), so it can render and be placed. */
export function registerCustom(catalogId: string, def: CustomDef): CatalogItem {
  const existing = catalogById.get(catalogId)
  if (existing) return existing
  const item: CatalogItem = { id: catalogId, name: def.name, category: 'mine', mount: def.mount, model: { kind: 'url', url: def.url, height: def.height } }
  catalogById.set(catalogId, item)
  return item
}

/** The definition to store in a room for a custom catalog entry. */
export function customDefOf(catalogId: string): CustomDef | undefined {
  const item = catalogById.get(catalogId)
  if (!item || item.model.kind !== 'url' || item.mount === 'ceiling') return undefined
  return { name: item.name, url: item.model.url, height: item.model.height, mount: item.mount }
}
