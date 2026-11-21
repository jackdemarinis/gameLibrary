// Procedural Mediterranean town houses and café furniture. Everything is
// built in local space (front face at z = 0 looking +z) and fed to a Batcher,
// so a whole street costs a few dozen draw calls.

import * as THREE from "three";
import { worldTheme, type CourtPalette } from "../../config/theme";
import { wiiMaterial } from "../materials";
import { awningTexture, grimeStripTexture, plasterTexture, roofTexture, seeded, signTexture, woodTexture } from "../textures";
import type { Batcher } from "./shared";

// One shared material per colour so the batcher merges across buildings.
const materialCache = new Map<string, THREE.Material>();
function shared(key: string, build: () => THREE.Material): THREE.Material {
  let material = materialCache.get(key);
  if (!material) {
    material = build();
    materialCache.set(key, material);
  }
  return material;
}

export function townMaterials(palette: CourtPalette) {
  return {
    wall: (color: number) => shared(`wall:${color}`, () => wiiMaterial(color, { map: plasterTexture(), sheen: 0.04 })),
    shutter: (color: number) => shared(`shutter:${color}`, () => wiiMaterial(color, { map: woodTexture(), sheen: 0.2 })),
    stone: shared(`stone:${palette.stone}`, () => wiiMaterial(palette.stone, { map: plasterTexture(), sheen: 0.05 })),
    stoneDark: shared(`stoneDark:${palette.stoneDark}`, () => wiiMaterial(palette.stoneDark, { map: plasterTexture(), sheen: 0.05 })),
    roof: shared(`roof:${palette.roof}`, () => wiiMaterial(palette.roof, { map: roofTexture(), sheen: 0.1 })),
    glass: shared("glass", () => wiiMaterial(worldTheme.windowGlass, { sheen: 1 })),
    recess: shared("recess", () => wiiMaterial(worldTheme.windowDark, { sheen: 0 })),
    iron: shared(`iron:${palette.ironwork}`, () => wiiMaterial(palette.ironwork, { sheen: 0.45 })),
    door: shared("door", () => wiiMaterial(worldTheme.door, { map: woodTexture(), sheen: 0.25 })),
    grime: shared("grime", () => new THREE.MeshBasicMaterial({ map: grimeStripTexture(), transparent: true, depthWrite: false })),
    flowerPot: shared("flowerPot", () => wiiMaterial(worldTheme.terracotta, { sheen: 0.1 })),
    geranium: shared("geranium", () => wiiMaterial(worldTheme.geranium, { sheen: 0.2 })),
    leaf: shared(`leaf:${palette.leaves}`, () => wiiMaterial(palette.leaves, { sheen: 0.1 })),
    awning: (color: number) => shared(`awning:${color}`, () => wiiMaterial(0xffffff, { map: awningTexture(color), side: THREE.DoubleSide, sheen: 0.05 })),
    sign: (text: string, color: number) =>
      shared(`sign:${text}:${color}`, () => wiiMaterial(0xffffff, { map: signTexture(text, color, worldTheme.signInk), sheen: 0.15 })),
  };
}

function box(material: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, tile?: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  if (tile) mesh.userData.tile = tile;
  return mesh;
}

export interface BuildingOptions {
  width: number;
  depth: number;
  storeys: number;
  wall: number;
  shutter: number;
  seed: number;
  shop?: { sign: string; awning: number } | null;
  balcony?: boolean;
}

export const storeyHeight = 3.1;

export function buildHouse(palette: CourtPalette, options: BuildingOptions): THREE.Group {
  const random = seeded(options.seed);
  const m = townMaterials(palette);
  const house = new THREE.Group();
  const { width, depth, storeys } = options;
  const height = storeys * storeyHeight + 0.4;
  const wall = m.wall(options.wall);
  const shutter = m.shutter(options.shutter);

  house.add(box(wall, width, height, depth, 0, height / 2, -depth / 2, 3));
  // Stone plinth, string courses between storeys and a deep cornice.
  house.add(box(m.stoneDark, width + 0.02, 0.55, 0.1, 0, 0.275, 0.03, 1.5));
  for (let storey = 1; storey < storeys; storey++) {
    house.add(box(m.stone, width + 0.02, 0.12, 0.1, 0, storey * storeyHeight + 0.1, 0.04, 1.5));
  }
  house.add(box(m.stone, width + 0.24, 0.26, 0.36, 0, height - 0.05, 0.08, 1.5));
  // Grime decal along the base.
  const grime = new THREE.Mesh(new THREE.PlaneGeometry(width, 1.2), m.grime);
  grime.position.set(0, 1.1, 0.085);
  grime.castShadow = false;
  house.add(grime);

  // Pitched roof with the ridge along the street, plus a chimney.
  const roofPitch = 0.42;
  const halfDepth = depth / 2 + 0.3;
  const slope = halfDepth / Math.cos(roofPitch);
  for (const side of [-1, 1]) {
    const plane = box(m.roof, width + 0.4, 0.1, slope, 0, height + Math.tan(roofPitch) * halfDepth * 0.5, -depth / 2 + side * halfDepth * 0.5, 1.6);
    plane.rotation.x = side * roofPitch;
    house.add(plane);
  }
  const gable = new THREE.Shape();
  gable.moveTo(-depth / 2, 0);
  gable.lineTo(depth / 2, 0);
  gable.lineTo(0, Math.tan(roofPitch) * depth * 0.5);
  gable.closePath();
  for (const side of [-1, 1]) {
    const end = new THREE.Mesh(new THREE.ShapeGeometry(gable), wall);
    end.rotation.y = side * Math.PI / 2;
    end.position.set((side * width) / 2, height, -depth / 2);
    end.userData.tile = 3;
    house.add(end);
  }
  if (random() < 0.7) house.add(box(m.stone, 0.5, 1.3, 0.5, (random() - 0.5) * width * 0.6, height + 1.0, -depth * 0.6, 1));

  // Upper-storey windows with shutters, sills and the odd flower box.
  const columns = Math.max(1, Math.floor(width / 1.7));
  const spacing = width / columns;
  for (let storey = 1; storey < storeys; storey++) {
    const y = storey * storeyHeight + 1.25;
    for (let column = 0; column < columns; column++) {
      const x = -width / 2 + spacing * (column + 0.5);
      addWindow(house, m, shutter, x, y, random);
      if (random() < 0.35) addFlowerBox(house, m, x, y - 0.82, random);
    }
    if (options.balcony && storey === 1) {
      const span = Math.min(width - 0.6, spacing * Math.min(2, columns) + 0.3);
      addBalcony(house, m, 0, storey * storeyHeight + 0.3, span);
    }
  }

  // Ground floor: shop front with awning and sign, or a door and a window.
  if (options.shop) {
    house.add(box(m.recess, width * 0.7, 2.2, 0.1, 0, 1.55, -0.02));
    house.add(box(m.glass, width * 0.7 - 0.2, 1.8, 0.04, 0, 1.6, 0.04));
    for (const x of [-width * 0.35, width * 0.35, 0]) house.add(box(m.door, 0.1, 2.3, 0.12, x, 1.55, 0.06));
    house.add(box(m.sign(options.shop.sign, worldTheme.signBoard), width * 0.72, 0.5, 0.08, 0, 2.95, 0.08));
    const awning = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.78, 1.5), m.awning(options.shop.awning));
    awning.position.set(0, 2.45, 0.7);
    awning.rotation.x = -1.05;
    awning.castShadow = true;
    house.add(awning);
    const valance = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.78, 0.22), m.awning(options.shop.awning));
    valance.position.set(0, 2.0, 1.33);
    valance.castShadow = true;
    house.add(valance);
  } else {
    const doorX = (random() - 0.5) * width * 0.4;
    house.add(box(m.stone, 1.4, 2.6, 0.12, doorX, 1.3, 0.02, 1));
    house.add(box(m.door, 1.1, 2.3, 0.1, doorX, 1.15, 0.06));
    house.add(box(m.iron, 0.05, 0.05, 0.08, doorX + 0.4, 1.1, 0.13));
    if (width > 3.2) addWindow(house, m, shutter, doorX + (doorX > 0 ? -1.7 : 1.7), 1.5, random);
  }

  // Drainpipe down one corner.
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, height, 6), m.iron);
  pipe.position.set(width / 2 - 0.12, height / 2, 0.1);
  pipe.castShadow = true;
  house.add(pipe);
  return house;
}

function addWindow(house: THREE.Group, m: ReturnType<typeof townMaterials>, shutter: THREE.Material, x: number, y: number, random: () => number): void {
  const w = 0.9;
  const h = 1.45;
  house.add(box(m.recess, w, h, 0.06, x, y, 0.0));
  house.add(box(m.glass, w - 0.16, h - 0.16, 0.02, x, y, 0.035));
  house.add(box(m.stone, w + 0.04, 0.05, 0.04, x, y, 0.05));
  house.add(box(m.stone, 0.05, h, 0.04, x, y, 0.05));
  // Stone surround and sill.
  house.add(box(m.stone, w + 0.3, 0.14, 0.08, x, y + h / 2 + 0.07, 0.04, 1));
  house.add(box(m.stone, w + 0.36, 0.1, 0.22, x, y - h / 2 - 0.05, 0.1, 1));
  const state = random();
  if (state < 0.25) {
    // Closed louvred shutters.
    for (const side of [-1, 1]) house.add(box(shutter, w / 2, h, 0.05, x + side * (w / 4), y, 0.06));
  } else {
    // Open shutters folded back against the wall, slightly ajar.
    for (const side of [-1, 1]) {
      const leaf = box(shutter, w / 2, h, 0.05, x + side * (w * 0.75 + 0.04), y, 0.08);
      leaf.rotation.y = -side * random() * 0.35;
      house.add(leaf);
    }
  }
}

function addFlowerBox(house: THREE.Group, m: ReturnType<typeof townMaterials>, x: number, y: number, random: () => number): void {
  house.add(box(m.flowerPot, 0.8, 0.2, 0.22, x, y, 0.22));
  for (let i = 0; i < 6; i++) {
    const bloom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08 + random() * 0.04, 0), random() < 0.6 ? m.geranium : m.leaf);
    bloom.position.set(x - 0.32 + i * 0.13, y + 0.16 + random() * 0.06, 0.22 + random() * 0.06);
    bloom.castShadow = true;
    house.add(bloom);
  }
}

function addBalcony(house: THREE.Group, m: ReturnType<typeof townMaterials>, x: number, y: number, span: number): void {
  house.add(box(m.stone, span, 0.14, 0.7, x, y, 0.35, 1));
  house.add(box(m.iron, span, 0.05, 0.05, x, y + 0.95, 0.68));
  house.add(box(m.iron, span, 0.04, 0.04, x, y + 0.15, 0.68));
  const bars = Math.floor(span / 0.13);
  for (let i = 0; i <= bars; i++) house.add(box(m.iron, 0.025, 0.8, 0.025, x - span / 2 + i * (span / bars), y + 0.55, 0.68));
  for (const side of [-1, 1]) house.add(box(m.iron, 0.04, 0.85, 0.66, x + (side * span) / 2, y + 0.55, 0.35));
}

// Bistro table with chairs and a parasol.
export function buildCafeTable(palette: CourtPalette, umbrellaColor: number, seed: number): THREE.Group {
  const random = seeded(seed);
  const m = townMaterials(palette);
  const table = new THREE.Group();
  const metal = m.iron;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.04, 16), shared("marble", () => wiiMaterial(worldTheme.marble, { sheen: 0.6 })));
  top.position.y = 0.74;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.72, 6), metal);
  post.position.y = 0.37;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.04, 12), metal);
  foot.position.y = 0.02;
  table.add(top, post, foot);
  // A glass and a carafe.
  const glassMaterial = shared("drink", () => wiiMaterial(worldTheme.drink, { sheen: 0.9, transparent: true }));
  const drink = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.12, 8), glassMaterial);
  drink.position.set(0.12, 0.82, 0.05);
  table.add(drink);
  const chairCount = 2 + Math.floor(random() * 2);
  const rattan = shared("rattan", () => wiiMaterial(worldTheme.rattan, { map: woodTexture(), sheen: 0.15 }));
  for (let i = 0; i < chairCount; i++) {
    const angle = (i / chairCount) * Math.PI * 2 + random() * 0.4;
    const chair = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.05, 12), rattan);
    seat.position.y = 0.46;
    const back = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 6, 12, Math.PI), rattan);
    back.position.set(0, 0.72, 0.18);
    chair.add(seat, back);
    for (const [lx, lz] of [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.46, 4), metal);
      leg.position.set(lx, 0.23, lz);
      chair.add(leg);
    }
    chair.position.set(Math.sin(angle) * 0.62, 0, Math.cos(angle) * 0.62);
    chair.rotation.y = angle;
    table.add(chair);
  }
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.4, 6), metal);
  pole.position.y = 1.2;
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.25, 0.45, 8, 1, true), shared(`parasol:${umbrellaColor}`, () => wiiMaterial(umbrellaColor, { side: THREE.DoubleSide, sheen: 0.1 })));
  canopy.position.y = 2.35;
  table.add(pole, canopy);
  table.traverse((child) => (child.castShadow = true));
  return table;
}

export function addHouseRow(
  batcher: Batcher,
  palette: CourtPalette,
  start: THREE.Vector3,
  direction: THREE.Vector3,
  length: number,
  rotationY: number,
  seed: number,
  shops: Array<{ sign: string; awning: number }>,
): void {
  const random = seeded(seed);
  let travelled = 0;
  let index = 0;
  let shopIndex = 0;
  while (travelled < length) {
    let width = 4 + Math.floor(random() * 3) * 0.9;
    // Don't overrun the row: squeeze the last house, or stop if too thin.
    if (travelled + width > length) width = length - travelled;
    if (width < 2.6) break;
    const storeys = 2 + Math.floor(random() * 2.4);
    const wantsShop = shopIndex < shops.length && random() < 0.55;
    const house = buildHouse(palette, {
      width,
      depth: 7,
      storeys,
      wall: palette.walls[Math.floor(random() * palette.walls.length)],
      shutter: palette.shutters[Math.floor(random() * palette.shutters.length)],
      seed: seed * 31 + index,
      shop: wantsShop ? shops[shopIndex++] : null,
      balcony: random() < 0.4,
    });
    const centre = start.clone().addScaledVector(direction, travelled + width / 2);
    batcher.addObject("town", house, centre, rotationY);
    travelled += width + 0.02;
    index++;
  }
}
