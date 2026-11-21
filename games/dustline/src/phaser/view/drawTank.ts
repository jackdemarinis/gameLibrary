import Phaser from "phaser";
import { pixelTheme } from "../../game/config/theme";
import {
  artPixel,
  ensureHullTextures,
  ensureTurretTexture,
  treadFrames,
  type TankArtPalette,
} from "./dustlinePixelArt";

export type { TankArtPalette };

export interface TankSprite {
  container: Phaser.GameObjects.Container;
  shadow: Phaser.GameObjects.Image;
  hull: Phaser.GameObjects.Image;
  turret: Phaser.GameObjects.Image;
  healthBar: Phaser.GameObjects.Graphics;
  hullKeys: string[];
  travel: number;
}

const treadStepWorld = 6;

export function createTankSprite(
  scene: Phaser.Scene,
  x: number,
  y: number,
  palette: TankArtPalette,
): TankSprite {
  const hullKeys = ensureHullTextures(scene, palette);
  const turretTexture = ensureTurretTexture(scene, palette);

  const shadow = scene.add.image(artPixel, artPixel * 1.5, hullKeys[0]).setTintFill(0x000000).setAlpha(0.32);
  const hull = scene.add.image(0, 0, hullKeys[0]);
  const turret = scene.add
    .image(0, 0, turretTexture.key)
    .setOrigin(turretTexture.originX, turretTexture.originY);
  const healthBar = scene.add.graphics();
  healthBar.setPosition(0, -palette.length * artPixel * 0.5 - 18);

  const container = scene.add.container(x, y, [shadow, hull, turret, healthBar]);
  container.setDepth(3);

  return { container, shadow, hull, turret, healthBar, hullKeys, travel: 0 };
}

/** Moves the tank, turns hull and turret, rolls the treads and kicks the turret back on recoil. */
export function syncTankPose(
  sprite: TankSprite,
  x: number,
  y: number,
  hullRotation: number,
  turretRotation: number,
  recoilOffset: number,
): void {
  const moved = Math.hypot(x - sprite.container.x, y - sprite.container.y);
  sprite.travel += moved;
  sprite.container.setPosition(x, y);

  sprite.hull.setRotation(hullRotation);
  sprite.shadow.setRotation(hullRotation);
  const frame = Math.floor(sprite.travel / treadStepWorld) % treadFrames;
  const key = sprite.hullKeys[frame];
  if (sprite.hull.texture.key !== key) {
    sprite.hull.setTexture(key);
    sprite.shadow.setTexture(key);
  }

  // Barrel points along (-sin r, cos r); recoil pushes the turret the other way.
  sprite.turret.setRotation(turretRotation);
  sprite.turret.setPosition(Math.sin(turretRotation) * recoilOffset, -Math.cos(turretRotation) * recoilOffset);
}

/** Chunky segmented bar: one segment per 8 world px, no rounding. */
export function drawPixelHealthBar(graphics: Phaser.GameObjects.Graphics, ratio: number, fill: number): void {
  const width = 56;
  const height = 8;
  const clamped = Math.max(0, Math.min(1, ratio));
  graphics.clear();
  graphics.fillStyle(pixelTheme.healthBack, 0.95);
  graphics.fillRect(-width / 2 - artPixel, -height / 2 - artPixel, width + artPixel * 2, height + artPixel * 2);

  const segments = width / 8;
  const filled = Math.ceil(clamped * segments);
  graphics.fillStyle(fill, 1);
  for (let index = 0; index < filled; index += 1) {
    graphics.fillRect(-width / 2 + index * 8, -height / 2, 8 - 2, height);
  }
}
