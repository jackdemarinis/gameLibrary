import Phaser from "phaser";
import { pixelTheme as p } from "../../game/config/theme";
import type { Rect } from "../../game/content/levelTypes";
import type { BreakableObstacleKind } from "../../game/simulation/battle/types";

/** World pixels per art pixel. A 64px grid cell is 16x16 art pixels. */
export const artPixel = 4;
const tileArt = 16;

type ColorAt = (x: number, y: number) => number | null;

/**
 * Paints a texture at art resolution, then scales it up with no smoothing so every
 * art pixel is a crisp 4x4 block. Built once per key and reused across scene restarts.
 */
function paintTexture(scene: Phaser.Scene, key: string, artWidth: number, artHeight: number, colorAt: ColorAt): string {
  if (scene.textures.exists(key)) {
    return key;
  }

  const source = document.createElement("canvas");
  source.width = artWidth;
  source.height = artHeight;
  const sourceContext = source.getContext("2d");
  if (!sourceContext) {
    throw new Error("Dustline could not paint its pixel art.");
  }

  const image = sourceContext.createImageData(artWidth, artHeight);
  for (let y = 0; y < artHeight; y += 1) {
    for (let x = 0; x < artWidth; x += 1) {
      const color = colorAt(x, y);
      if (color === null) {
        continue;
      }
      const offset = (y * artWidth + x) * 4;
      image.data[offset] = (color >> 16) & 0xff;
      image.data[offset + 1] = (color >> 8) & 0xff;
      image.data[offset + 2] = color & 0xff;
      image.data[offset + 3] = 0xff;
    }
  }
  sourceContext.putImageData(image, 0, 0);

  const texture = scene.textures.createCanvas(key, artWidth * artPixel, artHeight * artPixel);
  if (!texture) {
    throw new Error(`Dustline could not create texture ${key}.`);
  }
  const context = texture.getContext();
  context.imageSmoothingEnabled = false;
  context.drawImage(source, 0, 0, artWidth * artPixel, artHeight * artPixel);
  texture.refresh();
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return key;
}

/** Deterministic 0..1 noise so the same level always paints the same way. */
function hash(x: number, y: number, seed: number): number {
  let value = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2147483647);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

function toArtRect(rect: Rect): Rect {
  return {
    x: Math.round(rect.x / artPixel),
    y: Math.round(rect.y / artPixel),
    width: Math.max(1, Math.round(rect.width / artPixel)),
    height: Math.max(1, Math.round(rect.height / artPixel)),
  };
}

interface BlockColors {
  face: number;
  light: number;
  shade: number;
  gap: number;
  rivet: number | null;
}

const steelBlock: BlockColors = { face: p.steelFace, light: p.steelLight, shade: p.steelShade, gap: p.steelGap, rivet: p.steelRivet };
const stoneBlock: BlockColors = { face: p.stoneFace, light: p.stoneLight, shade: p.stoneShade, gap: p.stoneGap, rivet: null };

/** One bevelled square plate per 64px grid cell, so every wall reads as grid squares. */
function plateColor(x: number, y: number, colors: BlockColors, seed: number): number {
  const localX = x % tileArt;
  const localY = y % tileArt;
  const last = tileArt - 1;

  if (localX === last || localY === last) return colors.gap;
  if (localX === 0 || localY === 0) return colors.light;
  if (localX === last - 1 || localY === last - 1) return colors.shade;
  if (colors.rivet !== null && (localX === 2 || localX === last - 3) && (localY === 2 || localY === last - 3)) {
    return colors.rivet;
  }
  if (colors.rivet === null && (localX === 7 || localY === 7) && hash(Math.floor(x / tileArt), Math.floor(y / tileArt), seed) < 0.5) {
    // Stone blocks get a mortar line through some of them so the edge varies.
    return colors.shade;
  }
  return hash(x, y, seed) < 0.07 ? colors.shade : colors.face;
}

/**
 * Bakes the ground and every indestructible wall into one texture, since none of it
 * ever changes during a battle. Walls cast a 2px pixel shadow down-right.
 */
export function ensureBattlefieldTexture(
  scene: Phaser.Scene,
  levelId: string,
  worldWidth: number,
  worldHeight: number,
  walls: readonly Rect[],
): string {
  const key = `dlField-${levelId}`;
  const artWidth = Math.ceil(worldWidth / artPixel);
  const artHeight = Math.ceil(worldHeight / artPixel);
  const artWalls = walls.map(toArtRect);

  // The outer ring of cells is the arena border: dark stone. Inner walls are steel plates.
  const lastColumn = Math.ceil(artWidth / tileArt) - 1;
  const lastRow = Math.ceil(artHeight / tileArt) - 1;
  const isBorderCell = (x: number, y: number): boolean => {
    const column = Math.floor(x / tileArt);
    const row = Math.floor(y / tileArt);
    return column === 0 || row === 0 || column === lastColumn || row === lastRow;
  };
  const mask = new Int16Array(artWidth * artHeight).fill(-1);
  artWalls.forEach((wall, index) => {
    for (let y = Math.max(0, wall.y); y < Math.min(artHeight, wall.y + wall.height); y += 1) {
      for (let x = Math.max(0, wall.x); x < Math.min(artWidth, wall.x + wall.width); x += 1) {
        mask[y * artWidth + x] = index;
      }
    }
  });
  const wallAt = (x: number, y: number): number =>
    x < 0 || y < 0 || x >= artWidth || y >= artHeight ? -1 : mask[y * artWidth + x];

  const bounds = artWalls.length
    ? {
        left: Math.min(...artWalls.map((wall) => wall.x)),
        top: Math.min(...artWalls.map((wall) => wall.y)),
        right: Math.max(...artWalls.map((wall) => wall.x + wall.width)),
        bottom: Math.max(...artWalls.map((wall) => wall.y + wall.height)),
      }
    : { left: 0, top: 0, right: artWidth, bottom: artHeight };

  return paintTexture(scene, key, artWidth, artHeight, (x, y) => {
    const wallIndex = wallAt(x, y);
    if (wallIndex >= 0) {
      return isBorderCell(x, y) ? plateColor(x, y, stoneBlock, 11) : plateColor(x, y, steelBlock, 7);
    }

    if (x < bounds.left || y < bounds.top || x >= bounds.right || y >= bounds.bottom) {
      return (Math.floor(x / 2) + Math.floor(y / 2)) % 2 === 0 ? p.outOfBounds : p.outOfBoundsAlt;
    }

    if (wallAt(x - 1, y - 1) >= 0 || wallAt(x - 2, y - 2) >= 0 || wallAt(x - 1, y - 2) >= 0 || wallAt(x - 2, y - 1) >= 0) {
      return p.grassShadow;
    }

    const localX = x % tileArt;
    const localY = y % tileArt;
    if (localX === tileArt - 1 || localY === tileArt - 1) {
      return p.grassSeam;
    }

    const roll = hash(x, y, 3);
    if (roll < 0.0012) return p.flower;
    if (roll < 0.005) return p.pebble;
    if (roll < 0.05) return p.grassDark;
    if (roll < 0.08) return p.grassLight;
    const tileRoll = hash(Math.floor(x / tileArt), Math.floor(y / tileArt), 5);
    return tileRoll < 0.35 ? p.grassAlt : p.grass;
  });
}

/** 0 = intact .. 3 = nearly destroyed. */
export function damageStage(health: number, maxHealth: number): number {
  if (maxHealth <= 0) return 0;
  const lost = 1 - Math.max(0, health) / maxHealth;
  return Math.min(3, Math.ceil(lost * 3 - 0.001));
}

/** plain, or the tougher look: a gold crate (pays out) or a steel-banded brick. */
export type ObstacleVariant = "plain" | "special";

export function ensureObstacleTexture(
  scene: Phaser.Scene,
  kind: BreakableObstacleKind,
  worldWidth: number,
  worldHeight: number,
  stage: number,
  variant: ObstacleVariant = "plain",
): string {
  const artWidth = Math.max(4, Math.round(worldWidth / artPixel));
  const artHeight = Math.max(4, Math.round(worldHeight / artPixel));
  const key = `dl-${kind}-${variant}-${artWidth}x${artHeight}-${stage}`;

  if (kind === "crate") {
    return paintTexture(scene, key, artWidth, artHeight, (x, y) => {
      const color = crateColor(x, y, artWidth, artHeight, stage);
      return variant === "special" ? goldCrateColor(color, x, y, artWidth, artHeight) : color;
    });
  }
  return paintTexture(scene, key, artWidth, artHeight, (x, y) => {
    // Reinforced brick: two steel bands with rivets across the courses.
    if (variant === "special" && (y === 3 || y === artHeight - 4) && x > 0 && x < artWidth - 1) {
      return x % 4 === 1 ? p.reinforcedBandLight : p.reinforcedBand;
    }
    return brickColor(x, y, artWidth, artHeight, stage);
  });
}

/** Gold crate: the same crate recoloured gold, with a coin stamp in the middle. */
function goldCrateColor(color: number | null, x: number, y: number, width: number, height: number): number | null {
  if (color === null) return null;
  const dx = x + 0.5 - width / 2;
  const dy = y + 0.5 - height / 2;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance < 3.2) return Math.abs(dx) < 0.6 ? p.goldDark : p.goldLight;
  if (distance < 4.2) return p.goldDark;
  const swap: Record<number, number> = {
    [p.woodFace]: p.goldFace,
    [p.woodLight]: p.goldLight,
    [p.woodDark]: p.goldDark,
  };
  return swap[color] ?? color;
}

/** Running-bond bricks (8x4 art px). Damage knocks whole bricks out. */
function brickColor(x: number, y: number, width: number, height: number, stage: number): number {
  if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
    return p.brickMortar;
  }
  const course = Math.floor(y / 4);
  const shiftedX = x + (course % 2) * 4;
  const brickIndex = Math.floor(shiftedX / 8);
  const broken = stage > 0 && hash(brickIndex, course, 41) < stage * 0.2;

  if (y % 4 === 3 || shiftedX % 8 === 7) {
    return broken ? p.brickHole : p.brickMortar;
  }
  if (broken) {
    return hash(x, y, 43) < 0.25 ? p.brickMortar : p.brickHole;
  }
  if (y % 4 === 0 || shiftedX % 8 === 0) {
    return p.brickLight;
  }
  return hash(x, y, 47) < 0.08 ? p.brickMortar : p.brickFace;
}

/** Wooden crate: dark frame, horizontal planks, one diagonal brace, metal corners. */
function crateColor(x: number, y: number, width: number, height: number, stage: number): number | null {
  const right = width - 1;
  const bottom = height - 1;
  const isCorner = (x < 3 || x > right - 3) && (y < 3 || y > bottom - 3);

  if ((x === 0 || x === right) && (y === 0 || y === bottom)) return null;
  if (x === 0 || y === 0 || x === right || y === bottom) return p.woodEdge;
  if (isCorner) return x + y < 4 || (x > right - 3 && y < 3) ? p.steelLight : p.metalCorner;
  if (x === 1 || y === 1) return p.woodLight;
  if (x === right - 1 || y === bottom - 1 || x === 2 || y === 2 || x === right - 2 || y === bottom - 2) return p.woodDark;

  // Diagonal brace, two art px thick, scaled to non-square crates.
  const braceY = Math.round((x / right) * bottom);
  if (Math.abs(y - braceY) <= 1) {
    if (stage >= 2 && hash(x, y, 53) < 0.35) return p.woodEdge;
    return y - braceY === -1 ? p.woodLight : p.woodFace;
  }

  if ((y - 3) % 4 === 3) return p.woodDark;
  if (stage > 0 && hash(x, y, 59) < stage * 0.07) return p.woodEdge;
  return hash(x, y, 61) < 0.1 ? p.woodLight : p.woodFace;
}

export type HullStyle = "standard" | "light" | "armoured" | "long" | "fortress";
export type TurretStyle = "dome" | "square";

export interface TankArtPalette {
  name: string;
  hull: number;
  turret: number;
  /** Marking colour: stripes, chevrons, trim. */
  accent: number;
  /** Hull width and length in art px (length runs along the barrel). */
  width: number;
  length: number;
  treadWidth: number;
  hullStyle: HullStyle;
  turretStyle: TurretStyle;
  domeRadius: number;
  barrelLength: number;
  barrelCount: 1 | 2 | 3;
}

export const treadFrames = 3;

function shade(color: number, amount: number): number {
  const mix = (channel: number): number => {
    const target = amount > 0 ? 255 : 0;
    return Math.round(channel + (target - channel) * Math.abs(amount));
  };
  return (mix((color >> 16) & 0xff) << 16) | (mix((color >> 8) & 0xff) << 8) | mix(color & 0xff);
}

/**
 * Hull points down (+y) to match the simulation's rotation convention. Each
 * hullStyle adds its own marking so the types read apart even in the fog:
 * standard = cross stripe, light = arrow chevron, armoured = side skirts,
 * long = spine line, fortress = gold trim and skirts.
 */
export function ensureHullTextures(scene: Phaser.Scene, palette: TankArtPalette): string[] {
  const { width, length, treadWidth: tread, hullStyle, accent } = palette;
  const light = shade(palette.hull, 0.28);
  const dark = shade(palette.hull, -0.35);
  const hasSkirts = hullStyle === "armoured" || hullStyle === "fortress";
  const centerX = (width - 1) / 2;

  return Array.from({ length: treadFrames }, (_, frame) =>
    paintTexture(scene, `dlHull-${palette.name}-${frame}`, width, length, (x, y) => {
      const inLeftTread = x < tread;
      const inRightTread = x >= width - tread;

      if (inLeftTread || inRightTread) {
        const localX = inLeftTread ? x : x - (width - tread);
        if ((y === 0 || y === length - 1) && (localX === 0 || localX === tread - 1)) return null;
        if (localX === 0 || localX === tread - 1 || y === 0 || y === length - 1) return p.outline;
        // Armour skirts hide the middle of the tread behind bolted plates.
        if (hasSkirts && y > 2 && y < length - 3) {
          if ((y - 3) % 5 === 4) return p.outline;
          if (hullStyle === "fortress" && localX === (inLeftTread ? 1 : tread - 2)) return accent;
          return (y - 3) % 5 === 0 ? light : palette.hull;
        }
        return (y + frame) % treadFrames === 0 ? p.treadDark : localX === 1 ? p.treadLight : p.treadMid;
      }

      const bodyTop = hullStyle === "light" ? 1 : 2;
      const bodyBottom = length - 3;
      if (y < bodyTop || y > bodyBottom) return null;
      if (y === bodyTop || y === bodyBottom || x === tread || x === width - tread - 1) return p.outline;
      if (hullStyle === "fortress" && (y === bodyTop + 1 || y === bodyBottom - 1 || x === tread + 1 || x === width - tread - 2)) {
        return accent;
      }
      if (y === bodyTop + 1 || x === tread + 1) return light;
      if (y === bodyBottom - 1 || x === width - tread - 2) return dark;

      const middle = Math.round((bodyTop + bodyBottom) / 2);
      if (hullStyle === "standard" && (y === middle - 3 || y === middle - 2)) return accent;
      if (hullStyle === "light") {
        // Arrow chevron pointing forward (+y).
        const arrowY = bodyBottom - 4 - Math.round(Math.abs(x - centerX));
        if (y === arrowY || y === arrowY + 1) return accent;
      }
      if (hullStyle === "long" && Math.abs(x - centerX) < 1 && y > bodyTop + 2 && y < bodyBottom - 2) return accent;
      // Engine grille at the back, armoured lip at the front.
      if (y === bodyTop + 3 && x % 2 === 0) return dark;
      if (y === bodyBottom - 2) return shade(palette.hull, -0.15);
      return palette.hull;
    }),
  );
}

export interface TurretTexture {
  key: string;
  originX: number;
  originY: number;
}

/**
 * Dome or square turret with one to three barrels pointing down (+y). The pivot
 * sits at the turret centre. Long barrels (lancer) get a muzzle brake.
 */
export function ensureTurretTexture(scene: Phaser.Scene, palette: TankArtPalette): TurretTexture {
  const radius = palette.domeRadius;
  const width = radius * 2 + 2;
  const centerX = width / 2;
  const centerY = radius + 1;
  const height = centerY + palette.barrelLength + 1;
  const light = shade(palette.turret, 0.35);
  const dark = shade(palette.turret, -0.32);
  const barrelOffsets = palette.barrelCount === 1 ? [0] : palette.barrelCount === 2 ? [-2, 2] : [-3, 0, 3];
  const longBarrel = palette.barrelLength >= 12;

  const key = paintTexture(scene, `dlTurret-${palette.name}`, width, height, (x, y) => {
    const dx = x + 0.5 - centerX;
    const dy = y + 0.5 - centerY;

    if (palette.turretStyle === "square") {
      const edge = Math.max(Math.abs(dx), Math.abs(dy));
      if (edge <= radius - 0.5) {
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return palette.accent;
        if (dy < -radius + 1.5 || dx < -radius + 1.5) return light;
        if (dy > radius - 1.5 || dx > radius - 1.5) return dark;
        return palette.turret;
      }
      if (edge <= radius + 0.5) return p.outline;
    } else {
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance <= radius - 0.6) {
        if (dx + dy < -radius * 0.6) return light;
        if (dx + dy > radius * 0.7) return dark;
        return palette.turret;
      }
      if (distance <= radius + 0.4) return p.outline;
    }

    if (y <= centerY || y >= height) return null;
    let outline = false;
    for (const offset of barrelOffsets) {
      const barrelX = Math.abs(dx - offset);
      const isMuzzle = palette.barrelCount === 1 && (y >= height - 3 || (longBarrel && y >= height - 6 && y <= height - 5));
      const halfWidth = isMuzzle ? 2 : 1;
      if (barrelX < halfWidth) {
        if (y === height - 1) return p.outline;
        return barrelX < 0.6 && !isMuzzle ? light : palette.turret;
      }
      if (barrelX < halfWidth + 1) outline = true;
    }
    return outline ? p.outline : null;
  });

  return { key, originX: centerX / width, originY: centerY / height };
}

export function ensureShotTexture(scene: Phaser.Scene, name: string, color: number): string {
  return paintTexture(scene, `dlShot-${name}`, 3, 3, (x, y) => {
    if (x === 1 && y === 1) return p.white;
    if (x === 1 || y === 1) return color;
    return null;
  });
}

export function ensureCoinTexture(scene: Phaser.Scene): string {
  const size = 9;
  return paintTexture(scene, "dlCoin", size, size, (x, y) => {
    const dx = x - 4;
    const dy = y - 4;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > 4.4) return null;
    if (distance > 3.5) return p.coinDark;
    if (x === 4 && y >= 2 && y <= 6) return p.coinDark;
    if (dx + dy < -2) return p.coinLight;
    return p.coinFace;
  });
}

/** Repair kit: white box with a green cross. */
export function ensureRepairTexture(scene: Phaser.Scene): string {
  const size = 11;
  return paintTexture(scene, "dlRepair", size, size, (x, y) => {
    if ((x === 0 || x === size - 1) && (y === 0 || y === size - 1)) return null;
    if (x === 0 || y === 0 || x === size - 1 || y === size - 1) return p.repairEdge;
    if ((x >= 4 && x <= 6 && y >= 2 && y <= 8) || (y >= 4 && y <= 6 && x >= 2 && x <= 8)) return p.repairCross;
    return y === 1 || x === 1 ? p.white : p.repairFace;
  });
}

/** Rapid-fire charge: an orange lightning bolt on a dark plate. */
export function ensureRapidFireTexture(scene: Phaser.Scene): string {
  const bolt = [
    "...XXXX..",
    "...XXX...",
    "..XXX....",
    "..XXXXX..",
    "....XXX..",
    "...XXX...",
    "...XX....",
    "..XX.....",
    "..X......",
  ];
  const size = 11;
  return paintTexture(scene, "dlRapidFire", size, size, (x, y) => {
    if ((x === 0 || x === size - 1) && (y === 0 || y === size - 1)) return null;
    if (x === 0 || y === 0 || x === size - 1 || y === size - 1) return p.boltEdge;
    const row = bolt[y - 1];
    if (row && row[x - 1] === "X") return row[x - 2] === "X" ? p.boltFace : p.boltLight;
    return p.outline;
  });
}
