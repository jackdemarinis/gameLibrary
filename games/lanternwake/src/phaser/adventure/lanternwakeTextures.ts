import Phaser from "phaser";
import { adventureSprites, pixelHash, type PixelSprite } from "../../game/adventure/adventureSprites";
import { characterSprites } from "../../game/adventure/characterFrames";
import { adventureTheme as t } from "../../game/config/adventureTheme";

export const lanternwakeTextureKeys = {
  grass: "lwGrassTile",
  path: "lwPathTile",
  shrine: "lwShrineTile",
  gate: "lwGateTile",
  cobble: "lwCobbleTile",
  light: "lwLight",
} as const;

const tileScale = 3;

/** Builds every Lanternwake texture once per game; later scene restarts reuse them. */
export function ensureLanternwakeTextures(scene: Phaser.Scene): void {
  adventureSprites.forEach((sprite) => buildSprite(scene, sprite));
  characterSprites.forEach((sprite) => buildSprite(scene, sprite));

  buildTile(scene, lanternwakeTextureKeys.grass, 32, 32, (x, y) => {
    const roll = pixelHash(x, y, 11);
    if (roll < 0.012) return t.flowerGold;
    if (roll < 0.022) return t.flowerRose;
    if (roll < 0.14) return t.grassDark;
    if (roll < 0.26) return t.grassLight;
    return t.grassMid;
  });

  buildTile(scene, lanternwakeTextureKeys.path, 32, 16, (x, y) => {
    // Grass fringe on the top and bottom edges, packed dirt between.
    const edgeRoll = pixelHash(x, 0, 23);
    if (y === 0 || y === 15 || (y === 1 && edgeRoll < 0.5) || (y === 14 && edgeRoll > 0.5)) {
      return t.grassDark;
    }
    const roll = pixelHash(x, y, 29);
    if (roll < 0.06) return t.stoneMid;
    if (roll < 0.2) return t.dirtDark;
    if (roll < 0.32) return t.dirtLight;
    return t.dirtMid;
  });

  buildTile(scene, lanternwakeTextureKeys.shrine, 32, 32, (x, y) =>
    brick(x, y, 31, { mortar: t.shrineMortar, face: t.shrineBrickMid, light: t.shrineBrickLight, fleck: t.shrineMoss }),
  );

  buildTile(scene, lanternwakeTextureKeys.gate, 8, 32, (x, y) =>
    brick(x, y, 37, { mortar: t.stoneDark, face: t.stoneMid, light: t.stoneLight, fleck: t.shrineMoss }),
  );

  // Rounded cobbles in offset rows, 6x4 art pixels each, with dark grout between.
  buildTile(scene, lanternwakeTextureKeys.cobble, 12, 16, (x, y) => {
    const row = Math.floor(y / 4);
    const shiftedX = (x + (row % 2) * 3) % 6;
    const localY = y % 4;
    if (localY === 3 || shiftedX === 5) {
      return t.cobbleDark;
    }
    const corner = (shiftedX === 0 || shiftedX === 4) && (localY === 0 || localY === 2);
    if (corner) {
      return t.cobbleMid;
    }
    return localY === 0 ? t.cobbleLight : pixelHash(x, y, 53) < 0.15 ? t.cobbleMid : t.cobbleLight;
  });

  buildLight(scene);
}

function buildSprite(scene: Phaser.Scene, sprite: PixelSprite): void {
  if (scene.textures.exists(sprite.key)) {
    return;
  }
  const { rows, scale, palette } = sprite;
  const graphics = scene.make.graphics({}, false);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      const color = palette[row[x]];
      if (color !== undefined) {
        graphics.fillStyle(color, 1);
        graphics.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  });
  graphics.generateTexture(sprite.key, rows[0].length * scale, rows.length * scale);
  graphics.destroy();
}

function buildTile(scene: Phaser.Scene, key: string, width: number, height: number, colorAt: (x: number, y: number) => number): void {
  if (scene.textures.exists(key)) {
    return;
  }
  const graphics = scene.make.graphics({}, false);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      graphics.fillStyle(colorAt(x, y), 1);
      graphics.fillRect(x * tileScale, y * tileScale, tileScale, tileScale);
    }
  }
  graphics.generateTexture(key, width * tileScale, height * tileScale);
  graphics.destroy();
}

interface BrickColors {
  mortar: number;
  face: number;
  light: number;
  fleck: number;
}

/** Running-bond bricks, 8x4 art pixels, every other course offset by half a brick. */
function brick(x: number, y: number, seed: number, colors: BrickColors): number {
  const course = Math.floor(y / 4);
  const shiftedX = x + (course % 2) * 4;
  if (y % 4 === 3 || shiftedX % 8 === 7) {
    return colors.mortar;
  }
  if (y % 4 === 0 || shiftedX % 8 === 0) {
    return colors.light;
  }
  return pixelHash(x, y, seed) < 0.08 ? colors.fleck : colors.face;
}

/** Soft white radial falloff, used to cut light holes in the night overlay. */
function buildLight(scene: Phaser.Scene): void {
  const key = lanternwakeTextureKeys.light;
  if (scene.textures.exists(key)) {
    return;
  }
  const size = 256;
  const canvas = scene.textures.createCanvas(key, size, size);
  if (!canvas) {
    throw new Error("Lanternwake could not create its light texture.");
  }
  const context = canvas.getContext();
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(0.55, "rgba(255, 255, 255, 0.75)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  canvas.refresh();
}

/** Renders a sprite map to a PNG data URL for DOM use (HUD icons), at the sprite's own scale. */
export function spriteDataUrl(sprite: PixelSprite): string {
  const { rows, scale, palette } = sprite;
  const canvas = document.createElement("canvas");
  canvas.width = rows[0].length * scale;
  canvas.height = rows.length * scale;
  const context = canvas.getContext("2d");
  if (!context) {
    return "";
  }
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      const color = palette[row[x]];
      if (color !== undefined) {
        context.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
        context.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  });
  return canvas.toDataURL("image/png");
}
