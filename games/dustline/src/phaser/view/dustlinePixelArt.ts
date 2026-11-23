import Phaser from "phaser";
import { pixelTheme as p } from "../../game/config/theme";
import type { Rect, SupplyDrop } from "../../game/content/levelTypes";
import type { WeaponKind } from "../../game/content/weaponCatalog";
import type { BreakableObstacleKind, TankFaction } from "../../game/simulation/battle/types";

/** World pixels per art pixel for terrain. A 64px grid cell is 16x16 art pixels. */
export const artPixel = 4;
/** Tanks are painted a little finer, for more detail on the units. */
export const tankArtPixel = 3;
/** Shells and muzzle blasts are finer still. */
export const shotArtPixel = 2;
const tileArt = 16;

type ColorAt = (x: number, y: number) => number | null;

/**
 * Paints a texture at art resolution, then scales it up with no smoothing so every
 * art pixel is a crisp pixelSize x pixelSize block. Built once per key and reused
 * across scene restarts.
 */
function paintTexture(
  scene: Phaser.Scene,
  key: string,
  artWidth: number,
  artHeight: number,
  colorAt: ColorAt,
  pixelSize = artPixel,
): string {
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

  const texture = scene.textures.createCanvas(key, artWidth * pixelSize, artHeight * pixelSize);
  if (!texture) {
    throw new Error(`Dustline could not create texture ${key}.`);
  }
  const context = texture.getContext();
  context.imageSmoothingEnabled = false;
  context.drawImage(source, 0, 0, artWidth * pixelSize, artHeight * pixelSize);
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

/**
 * plain, or the tougher look: a gold crate (pays out) or a steel-banded brick.
 * Supply crates use their drop as the variant so each shows its power-up.
 */
export type ObstacleVariant = "plain" | "special" | SupplyDrop;

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

  if (kind === "spawner") {
    return paintTexture(scene, key, artWidth, artHeight, (x, y) => spawnerColor(x, y, artWidth, artHeight, stage));
  }
  if (kind === "supplyCrate") {
    const drop: SupplyDrop = variant === "plain" || variant === "special" ? "repair" : variant;
    return paintTexture(scene, key, artWidth, artHeight, (x, y) =>
      supplyCrateColor(crateColor(x, y, artWidth, artHeight, stage), x, y, artWidth, artHeight, drop),
    );
  }
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

/** 6x6 power-up emblems, shared by supply crates and the matching pickups. */
const supplyEmblems: Record<SupplyDrop, readonly string[]> = {
  repair: ["..XX..", "..XX..", "XXXXXX", "XXXXXX", "..XX..", "..XX.."],
  freeze: ["X.XX.X", ".XXXX.", "XX..XX", "XX..XX", ".XXXX.", "X.XX.X"],
  rapidFire: ["...XX.", "..XX..", ".XXXX.", "..XX..", ".XX...", ".X...."],
};

const supplyColors: Record<SupplyDrop, { emblem: number; band: number }> = {
  repair: { emblem: p.repairCross, band: p.repairCross },
  freeze: { emblem: p.freezeFace, band: p.freezeEdge },
  rapidFire: { emblem: p.boltFace, band: p.boltEdge },
};

/**
 * Supply crate: the wooden crate with a coloured band top and bottom and a dark
 * plate in the middle stamped with its power-up, so you know what's inside.
 */
function supplyCrateColor(
  color: number | null,
  x: number,
  y: number,
  width: number,
  height: number,
  drop: SupplyDrop,
): number | null {
  if (color === null) return null;
  const colors = supplyColors[drop];
  if ((y === 3 || y === height - 4) && x > 2 && x < width - 3) return colors.band;
  const plateX = x - Math.floor(width / 2) + 4;
  const plateY = y - Math.floor(height / 2) + 4;
  if (plateX < 0 || plateY < 0 || plateX > 7 || plateY > 7) return color;
  if (plateX === 0 || plateY === 0 || plateX === 7 || plateY === 7) return p.outline;
  const row = supplyEmblems[drop][plateY - 1];
  return row?.[plateX - 1] === "X" ? colors.emblem : p.supplyPlate;
}

/**
 * Enemy spawner: an armoured steel hatch ringed with hazard stripes and a hot
 * red core. Damage cracks the plate and dims the core.
 */
function spawnerColor(x: number, y: number, width: number, height: number, stage: number): number | null {
  const right = width - 1;
  const bottom = height - 1;
  if ((x === 0 || x === right) && (y === 0 || y === bottom)) return null;
  if (x === 0 || y === 0 || x === right || y === bottom) return p.outline;
  if (x <= 2 || y <= 2 || x >= right - 2 || y >= bottom - 2) {
    return Math.floor((x + y) / 2) % 2 === 0 ? p.hazardStripe : p.outline;
  }
  if (stage > 0 && hash(x, y, 71) < stage * 0.09) return p.spawnerCrack;

  const dx = x + 0.5 - width / 2;
  const dy = y + 0.5 - height / 2;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance < 2.2) return stage >= 3 ? p.spawnerCore : p.spawnerCoreLight;
  if (distance < 3.4) return stage >= 2 ? p.spawnerDark : p.spawnerCore;
  if (distance < 4.4) return p.outline;
  if ((x === 4 || x === right - 4) && (y === 4 || y === bottom - 4)) return p.steelRivet;
  if (x === 3 || y === 3) return p.spawnerLight;
  if (x === right - 3 || y === bottom - 3) return p.spawnerDark;
  return p.spawnerFace;
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

/** Tank art is measured in tank art pixels (tankArtPixel world px each). */
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
  /** Enemy tanks glow pink/gold on their lasers and rebound coils; the player cyan/violet. */
  faction: TankFaction;
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
 * long = spine line, fortress = gold trim and skirts. Every hull gets road-wheel
 * hubs in the treads, corner bolts, an engine grille and exhausts at the back,
 * and headlights at the front.
 */
export function ensureHullTextures(scene: Phaser.Scene, palette: TankArtPalette): string[] {
  const { width, length, treadWidth: tread, hullStyle, accent } = palette;
  const light = shade(palette.hull, 0.28);
  const dark = shade(palette.hull, -0.35);
  const hasSkirts = hullStyle === "armoured" || hullStyle === "fortress";
  const centerX = (width - 1) / 2;
  const hubX = Math.floor((tread - 1) / 2);

  return Array.from({ length: treadFrames }, (_, frame) =>
    paintTexture(
      scene,
      `dlHull-${palette.name}-${frame}`,
      width,
      length,
      (x, y) => {
        const inLeftTread = x < tread;
        const inRightTread = x >= width - tread;

        if (inLeftTread || inRightTread) {
          const localX = inLeftTread ? x : x - (width - tread);
          if ((y === 0 || y === length - 1) && (localX === 0 || localX === tread - 1)) return null;
          if (localX === 0 || localX === tread - 1 || y === 0 || y === length - 1) return p.outline;
          // Armour skirts hide the middle of the tread behind bolted plates.
          if (hasSkirts && y > 2 && y < length - 3) {
            if ((y - 3) % 6 === 5) return p.outline;
            if ((y - 3) % 6 === 2 && localX === hubX) return p.bolt;
            if (hullStyle === "fortress" && localX === (inLeftTread ? 1 : tread - 2)) return accent;
            return (y - 3) % 6 === 0 ? light : palette.hull;
          }
          // Road-wheel hubs stay put while the links roll past them.
          if (localX === hubX && y % 4 === 2 && y > 1 && y < length - 2) return p.treadLight;
          return (y + frame) % treadFrames === 0 ? p.treadDark : localX === 1 ? p.treadLight : p.treadMid;
        }

        const bodyTop = hullStyle === "light" ? 1 : 2;
        const bodyBottom = length - 3;
        const left = tread;
        const right = width - tread - 1;

        // Twin exhaust stubs poke out of the back of the hull.
        if (y === bodyTop - 1 && (x === left + 2 || x === right - 2)) return p.exhaust;
        if (y < bodyTop || y > bodyBottom) return null;
        if (y === bodyTop || y === bodyBottom || x === left || x === right) return p.outline;
        // Headlights at the front corners.
        if (y === bodyBottom - 1 && (x === left + 2 || x === right - 2)) return p.headlight;
        if (hullStyle === "fortress" && (y === bodyTop + 1 || y === bodyBottom - 1 || x === left + 1 || x === right - 1)) {
          return accent;
        }
        // Corner bolts.
        if ((y === bodyTop + 2 || y === bodyBottom - 3) && (x === left + 2 || x === right - 2)) return p.bolt;
        if (y === bodyTop + 1 || x === left + 1) return light;
        if (y === bodyBottom - 1 || x === right - 1) return dark;

        const middle = Math.round((bodyTop + bodyBottom) / 2);
        if (hullStyle === "standard" && (y === middle - 3 || y === middle - 2)) return accent;
        if (hullStyle === "light") {
          // Arrow chevron pointing forward (+y).
          const arrowY = bodyBottom - 5 - Math.round(Math.abs(x - centerX));
          if (y === arrowY || y === arrowY + 1) return accent;
        }
        if (hullStyle === "long" && Math.abs(x - centerX) < 1 && y > bodyTop + 3 && y < bodyBottom - 3) return accent;
        if (hullStyle === "armoured" && (x === left + 3 || x === right - 3) && y > bodyTop + 3 && y < bodyBottom - 3) {
          return accent;
        }
        // Engine grille at the back, armoured lip at the front.
        if ((y === bodyTop + 3 || y === bodyTop + 4) && x > left + 3 && x < right - 3) {
          return (x + y) % 2 === 0 ? dark : shade(palette.hull, -0.15);
        }
        if (y === bodyBottom - 2) return shade(palette.hull, -0.15);
        return palette.hull;
      },
      tankArtPixel,
    ),
  );
}

export interface TurretTexture {
  key: string;
  originX: number;
  originY: number;
}

/** How each cannon's barrel is shaped, so you can tell what a tank carries. */
const barrelLengthFactor: Record<WeaponKind, number> = {
  cannon: 1,
  autocannon: 1.05,
  scattergun: 0.88,
  ricochet: 1,
  laser: 1.2,
  missile: 0.8,
};

/**
 * Dome or square turret with one to three barrels pointing down (+y). The pivot
 * sits at the turret centre. The barrel shows the cannon:
 * cannon = muzzle brake, autocannon = ribbed cooling jacket, scattergun = short
 * flared bore, ricochet = glowing coils and an orb tip, laser = thin barrel with
 * cooling fins and a lit lens.
 */
export function ensureTurretTexture(scene: Phaser.Scene, palette: TankArtPalette, weapon: WeaponKind): TurretTexture {
  const radius = palette.domeRadius;
  const width = radius * 2 + 4;
  const centerX = width / 2;
  const centerY = radius + 1;
  const barrelLength = Math.round(palette.barrelLength * barrelLengthFactor[weapon]);
  const height = centerY + barrelLength + 1;
  const light = shade(palette.turret, 0.35);
  const dark = shade(palette.turret, -0.32);
  const spacing = Math.max(3, Math.round(radius * 0.6));
  const barrelOffsets =
    palette.barrelCount === 1 ? [0] : palette.barrelCount === 2 ? [-spacing / 2, spacing / 2] : [-spacing, 0, spacing];
  const enemy = palette.faction === "enemy";
  const glow =
    weapon === "laser"
      ? enemy ? p.laserEnemyGlow : p.laserGlow
      : enemy ? p.ricochetEnemyGlow : p.ricochetGlow;
  const glowCore = weapon === "laser" ? (enemy ? p.laserEnemyCore : p.laserCore) : p.ricochetCore;

  /** Barrel half-width and colour at distance t (1..barrelLength) out from the pivot, |dx| from its axis. */
  const barrelAt = (t: number, dx: number): number | null => {
    const fromTip = barrelLength - t;
    switch (weapon) {
      case "autocannon": {
        const jacket = t > radius - 1 && t < radius + barrelLength * 0.5;
        const halfWidth = jacket ? 2 : 1;
        if (dx >= halfWidth) return null;
        if (jacket) return t % 2 === 0 ? dark : palette.turret;
        if (fromTip === 0) return light;
        return dx < 0.6 ? light : palette.turret;
      }
      case "scattergun": {
        const halfWidth = fromTip <= 1 ? 3 : 2;
        if (dx >= halfWidth) return null;
        if (fromTip <= 1 && dx < 1) return p.outline;
        if (t === Math.round(radius + (barrelLength - radius) / 2)) return palette.accent;
        return dx < 0.6 ? light : dx > halfWidth - 1 ? dark : palette.turret;
      }
      case "ricochet": {
        if (fromTip <= 2) {
          const orbDistance = Math.hypot(dx, fromTip - 1);
          if (orbDistance > 2.2) return null;
          return orbDistance < 1 ? glowCore : glow;
        }
        const coil = t > radius && (t - radius) % 3 === 0;
        const halfWidth = coil ? 2 : 1;
        if (dx >= halfWidth) return null;
        if (coil) return glow;
        return dx < 0.6 ? light : palette.turret;
      }
      case "laser": {
        const fin = t === Math.round(barrelLength * 0.5) || t === Math.round(barrelLength * 0.65);
        if (fin) return dx < 3 ? dark : null;
        if (fromTip <= 1) {
          if (dx >= 1.5) return null;
          return fromTip === 0 && dx < 0.6 ? glowCore : glow;
        }
        if (dx >= 1) return null;
        return dx < 0.6 ? light : palette.turret;
      }
      case "missile": {
        // Boxy launcher pod with two dark tube mouths at the end.
        const halfWidth = 3;
        if (dx >= halfWidth) return null;
        if (fromTip <= 1) return dx > 0.6 && dx < 2.4 ? p.outline : dark;
        if (t === Math.round(radius + 1)) return palette.accent;
        return dx < 0.6 ? light : dx > halfWidth - 1 ? dark : palette.turret;
      }
      case "cannon":
      default: {
        const brake = fromTip <= 2;
        const halfWidth = brake ? 2 : 1;
        if (dx >= halfWidth) return null;
        if (brake && fromTip === 1) return dark;
        return dx < 0.6 && !brake ? light : palette.turret;
      }
    }
  };

  const key = paintTexture(
    scene,
    `dlTurret-${palette.name}-${weapon}`,
    width,
    height,
    (x, y) => {
      const dx = x + 0.5 - centerX;
      const dy = y + 0.5 - centerY;

      if (palette.turretStyle === "square") {
        const edge = Math.max(Math.abs(dx), Math.abs(dy));
        if (edge <= radius - 0.5) {
          if (Math.abs(dx) < 1 && Math.abs(dy + radius * 0.35) < 1) return palette.accent;
          if ((Math.abs(dx) === radius - 1.5 || Math.abs(dx) === radius - 2.5) && Math.abs(dy) === radius - 1.5) return p.bolt;
          if (dy < -radius + 1.5 || dx < -radius + 1.5) return light;
          if (dy > radius - 1.5 || dx > radius - 1.5) return dark;
          return palette.turret;
        }
        if (edge <= radius + 0.5) return p.outline;
      } else {
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= radius - 0.6) {
          // Commander's hatch, set back from the barrel.
          const hatch = Math.hypot(dx, dy + radius * 0.4);
          if (hatch < 0.9) return light;
          if (hatch < 1.8) return dark;
          if (dx + dy < -radius * 0.6) return light;
          if (dx + dy > radius * 0.7) return dark;
          return palette.turret;
        }
        if (distance <= radius + 0.4) return p.outline;
      }

      if (y <= centerY || y >= height) return null;
      const t = y - centerY;
      let nearBarrel = false;
      for (const offset of barrelOffsets) {
        const barrelX = Math.abs(dx - offset);
        const color = barrelAt(t, barrelX);
        if (color !== null) return y === height - 1 && weapon === "cannon" ? p.outline : color;
        if (barrelAt(t, Math.max(0, barrelX - 1)) !== null || (t < barrelLength && barrelAt(t + 1, barrelX) !== null)) {
          nearBarrel = true;
        }
      }
      return nearBarrel ? p.outline : null;
    },
    tankArtPixel,
  );

  return { key, originX: centerX / width, originY: centerY / height };
}

interface ShotColors {
  body: number;
  light: number;
  dim: number;
}

function shotColors(kind: WeaponKind, faction: TankFaction): ShotColors {
  const enemy = faction === "enemy";
  if (kind === "laser") {
    return enemy
      ? { body: p.laserEnemyGlow, light: p.laserEnemyCore, dim: shade(p.laserEnemyGlow, -0.4) }
      : { body: p.laserGlow, light: p.laserCore, dim: shade(p.laserGlow, -0.4) };
  }
  if (kind === "missile") {
    return { body: p.missileBody, light: p.missileLight, dim: p.missileDim };
  }
  if (kind === "ricochet") {
    return enemy
      ? { body: p.ricochetEnemyGlow, light: p.ricochetCore, dim: shade(p.ricochetEnemyGlow, -0.4) }
      : { body: p.ricochetGlow, light: p.ricochetCore, dim: shade(p.ricochetGlow, -0.4) };
  }
  return enemy
    ? { body: p.shotEnemy, light: p.shotEnemyLight, dim: p.shotEnemyDim }
    : { body: p.shotPlayer, light: p.shotPlayerLight, dim: p.shotPlayerDim };
}

/**
 * Shell sprites, drawn as pixel grids pointing along +x (rotate them to the
 * direction of travel). o = ink outline, s = smoke, d/b/l = dim/body/light
 * colour for the faction and cannon, w = white-hot. Rows are padded to the
 * widest one.
 */
const shotSprites: Record<WeaponKind, string[]> = {
  // Brass-banded shell with a hot nose and a puff of smoke behind.
  cannon: [
    "......ooooooooo...",
    "s..oodbbbbbblllo..",
    ".ssddobbbbbbllllwo",
    ".ssddobbbbbbllllwo",
    "s..oodbbbbbblllo..",
    "......ooooooooo...",
  ],
  // Long thin tracer streak.
  autocannon: [
    ".........oooooo.",
    "ddddbbbbbblllwwo",
    ".........oooooo.",
  ],
  // Round pellet with a highlight.
  scattergun: [
    ".ooo.",
    "oblwo",
    "obllo",
    "obblo",
    ".ooo.",
  ],
  // Glowing orb trailing sparks.
  ricochet: [
    "........ooo...",
    "......oblllo..",
    "d..b.obllwllo.",
    ".ddbbbllwwwlo.",
    "d..b.obllwllo.",
    "......oblllo..",
    "........ooo...",
  ],
  // Rocket: exhaust flame, finned tail, body and a red warhead (r).
  missile: [
    "......oo..........",
    ".....odbo.........",
    "ssfFoodbbbbbbbbbbrro.",
    "sFFwoddbllllllllrrro",
    "ssfFoodbbbbbbbbbbrro.",
    ".....odbo.........",
    "......oo..........",
  ],
  // Long bolt: white core, coloured glow, tapered ends.
  laser: [
    ".....bbbbbbbbbbbbbbb...",
    "...bblllllllllllllllbb.",
    "dbblwwwwwwwwwwwwwwwwwlb",
    "...bblllllllllllllllbb.",
    ".....bbbbbbbbbbbbbbb...",
  ],
};

/** Shell sprite for a cannon, pointing along +x (rotate it to the direction of travel). */
export function ensureProjectileTexture(scene: Phaser.Scene, kind: WeaponKind, faction: TankFaction): string {
  const c = shotColors(kind, faction);
  const rows = shotSprites[kind];
  const width = Math.max(...rows.map((row) => row.length));
  const colors: Record<string, number> = {
    o: p.outline,
    s: p.flashSmoke,
    d: c.dim,
    b: c.body,
    l: c.light,
    w: p.white,
    r: faction === "enemy" ? p.missileEnemyWarhead : p.missileWarhead,
    f: p.flashMid,
    F: p.flashHot,
  };

  return paintTexture(
    scene,
    `dlShot2-${kind}-${faction}`,
    width,
    rows.length,
    (x, y) => colors[rows[y][x] ?? "."] ?? null,
    shotArtPixel,
  );
}

interface BlastSpec {
  width: number;
  height: number;
  core: number;
  /** angle (0 = straight out of the barrel), length (share of width), thickness in art px. */
  rays: { angle: number; length: number; thickness: number }[];
  colors: [number, number, number, number];
}

function blastSpec(weapon: WeaponKind, faction: TankFaction): BlastSpec {
  const fire: [number, number, number, number] = [p.flashCore, p.flashHot, p.flashMid, p.flashEdge];
  const enemy = faction === "enemy";
  switch (weapon) {
    case "autocannon":
      return {
        width: 9, height: 7, core: 1.6, colors: fire,
        rays: [{ angle: 0, length: 1, thickness: 1.4 }, { angle: 0.7, length: 0.45, thickness: 0.8 }, { angle: -0.7, length: 0.45, thickness: 0.8 }],
      };
    case "scattergun":
      return {
        width: 15, height: 15, core: 2.6, colors: fire,
        rays: [-0.75, -0.4, 0, 0.4, 0.75].map((angle) => ({ angle, length: angle === 0 ? 1 : 0.8, thickness: 1.8 })),
      };
    case "ricochet":
      return {
        width: 15, height: 15, core: 3.4,
        colors: [p.ricochetCore, enemy ? p.ricochetEnemyGlow : p.ricochetGlow, shade(enemy ? p.ricochetEnemyGlow : p.ricochetGlow, -0.3), p.outline],
        rays: [0, 1.05, -1.05, 2.1, -2.1, Math.PI].map((angle) => ({ angle, length: 1, thickness: 1.3 })),
      };
    case "laser":
      return {
        width: 15, height: 15, core: 2.6,
        colors: enemy
          ? [p.laserEnemyCore, p.laserEnemyGlow, shade(p.laserEnemyGlow, -0.3), p.outline]
          : [p.laserCore, p.laserGlow, shade(p.laserGlow, -0.3), p.outline],
        rays: [0, Math.PI / 2, -Math.PI / 2, Math.PI].map((angle) => ({ angle, length: angle === 0 ? 1 : 0.6, thickness: 1.1 })),
      };
    case "missile":
      return {
        width: 13, height: 13, core: 3, colors: fire,
        rays: [0, 2.4, -2.4, Math.PI].map((angle) => ({ angle, length: angle === 0 ? 0.7 : 1, thickness: 1.6 })),
      };
    case "cannon":
    default:
      return {
        width: 13, height: 11, core: 2.4, colors: fire,
        rays: [
          { angle: 0, length: 1, thickness: 2.2 },
          { angle: 0.6, length: 0.55, thickness: 1.3 },
          { angle: -0.6, length: 0.55, thickness: 1.3 },
          { angle: 1.4, length: 0.3, thickness: 1 },
          { angle: -1.4, length: 0.3, thickness: 1 },
        ],
      };
  }
}

export const muzzleBlastFrames = 3;

/**
 * Muzzle blast: three frames (flare, full burst, fading smoke) drawn out of the
 * barrel along +x from the left-middle edge. Each cannon has its own shape.
 */
export function ensureMuzzleBlastTextures(scene: Phaser.Scene, weapon: WeaponKind, faction: TankFaction): string[] {
  const spec = blastSpec(weapon, faction);
  const originY = spec.height / 2;
  const scales = [0.6, 1, 0.85];

  return scales.map((scale, frame) =>
    paintTexture(
      scene,
      `dlBlast-${weapon}-${faction}-${frame}`,
      spec.width,
      spec.height,
      (x, y) => {
        // Round shapes (ricochet, laser) centre on the muzzle; cones start at it.
        const round = weapon === "ricochet" || weapon === "laser";
        const dx = x + 0.5 - (round ? spec.width / 2 : 0);
        const dy = y + 0.5 - originY;
        const distance = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);
        const reach = (round ? spec.width / 2 : spec.width) * scale;
        let heat = -1;

        if (distance < spec.core * scale) heat = distance / (spec.core * scale) * 0.3;
        for (const ray of spec.rays) {
          const length = ray.length * reach;
          let difference = Math.abs(angle - ray.angle);
          if (difference > Math.PI) difference = Math.PI * 2 - difference;
          const across = Math.sin(Math.min(difference, Math.PI / 2)) * distance;
          if (difference < Math.PI / 2 && distance < length && across < ray.thickness * (1 - distance / length) + 0.5) {
            const rayHeat = distance / length;
            heat = heat < 0 ? rayHeat : Math.min(heat, rayHeat);
          }
        }
        if (heat < 0) return null;
        // The last frame cools: the whole blast shifts down the palette and smoke breaks it up.
        const level = Math.min(3, Math.floor(heat * 3) + (frame === 2 ? 1 : 0));
        if (frame === 2 && hash(x, y, 91) < 0.3) return round ? null : p.flashSmoke;
        return spec.colors[level];
      },
      shotArtPixel,
    ),
  );
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

/** Freeze charge: an icy snowflake on a dark plate. */
export function ensureFreezeTexture(scene: Phaser.Scene): string {
  const size = 11;
  const flake = [
    "....X....",
    ".X..X..X.",
    "..X.X.X..",
    "...XXX...",
    "XXXXXXXXX",
    "...XXX...",
    "..X.X.X..",
    ".X..X..X.",
    "....X....",
  ];
  return paintTexture(scene, "dlFreeze", size, size, (x, y) => {
    if ((x === 0 || x === size - 1) && (y === 0 || y === size - 1)) return null;
    if (x === 0 || y === 0 || x === size - 1 || y === size - 1) return p.freezeEdge;
    const row = flake[y - 1];
    if (row && row[x - 1] === "X") return x === 5 || y === 5 ? p.freezeLight : p.freezeFace;
    return p.outline;
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
