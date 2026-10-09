export type Mount = 'floor' | 'surface' | 'wall' | 'ceiling'
export type Category = 'desk' | 'seating' | 'tables' | 'beds' | 'storage' | 'lighting' | 'decor' | 'plants'
export type ProceduralId = 'pcTower' | 'monitorWide' | 'deskMat' | 'wallShelf' | 'posterSunset' | 'posterOcean' | 'posterShapes' | 'ledStrip'

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
  model: { kind: 'glb'; file: string; scale: number; yaw: number } | { kind: 'procedural'; build: ProceduralId }
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
]

// Kenney's furniture is modelled at roughly half scale: ×1.9 puts a desk top at a real 73 cm.
const K = 1.9

type Opts = Pick<CatalogItem, 'surface' | 'flat' | 'light' | 'glows'> & { scale?: number; yaw?: number }

function kenney(id: string, name: string, category: Category, mount: Mount, o: Opts = {}): CatalogItem {
  return { id, name, category, mount, surface: o.surface, flat: o.flat, light: o.light, glows: o.glows, model: { kind: 'glb', file: `kenney/${id}.glb`, scale: o.scale ?? K, yaw: o.yaw ?? 0 } }
}

function made(id: ProceduralId, name: string, category: Category, mount: Mount, o: Opts = {}): CatalogItem {
  return { id, name, category, mount, surface: o.surface, flat: o.flat, light: o.light, glows: o.glows, model: { kind: 'procedural', build: id } }
}

const top = { surface: true }
const glows = { glows: true }
const floorLamp = { light: { y: 0.88, intensity: 3, distance: 4.5 } }
const tableLamp = { light: { y: 0.75, intensity: 1.6, distance: 2.8 } }

export const CATALOG: CatalogItem[] = [
  // Desk & tech
  kenney('desk', 'Desk', 'desk', 'floor', top),
  kenney('deskCorner', 'Corner Desk', 'desk', 'floor', top),
  made('monitorWide', 'Ultrawide Monitor', 'desk', 'surface', glows),
  kenney('computerScreen', 'Monitor', 'desk', 'surface'),
  kenney('computerKeyboard', 'Keyboard', 'desk', 'surface'),
  kenney('computerMouse', 'Mouse', 'desk', 'surface'),
  made('pcTower', 'Gaming PC', 'desk', 'surface', glows),
  made('deskMat', 'Desk Mat', 'desk', 'surface', top),
  kenney('laptop', 'Laptop', 'desk', 'surface'),
  kenney('speakerSmall', 'Desk Speaker', 'desk', 'surface'),
  kenney('speaker', 'Tower Speaker', 'desk', 'floor'),
  kenney('radio', 'Radio', 'desk', 'surface'),
  kenney('televisionModern', 'TV', 'desk', 'surface'),
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
  kenney('ceilingFan', 'Ceiling Fan', 'lighting', 'ceiling', { scale: 2.4, light: { y: 0, intensity: 2.5, distance: 5 } }),

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
]

export const catalogById = new Map(CATALOG.map((item) => [item.id, item]))
