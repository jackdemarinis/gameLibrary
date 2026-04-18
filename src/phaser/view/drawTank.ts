import Phaser from "phaser";

export interface TankPalette {
  hull: number;
  turret: number;
  shadowAlpha: number;
  scale: number;
}

export interface TankSprite {
  container: Phaser.GameObjects.Container;
  turret: Phaser.GameObjects.Graphics;
}

export function createTankSprite(
  scene: Phaser.Scene,
  x: number,
  y: number,
  palette: TankPalette,
): TankSprite {
  const shadow = scene.add.graphics();
  shadow.fillStyle(0x000000, palette.shadowAlpha);
  shadow.fillEllipse(0, 0, 86, 64);
  shadow.setPosition(4, 7);

  const hull = scene.add.graphics();
  hull.fillStyle(0x1f261c, 1);
  hull.fillRoundedRect(-42, -34, 18, 68, 8);
  hull.fillRoundedRect(24, -34, 18, 68, 8);
  hull.fillStyle(palette.hull, 1);
  hull.lineStyle(4, 0x23301f, 0.95);
  hull.fillRoundedRect(-30, -26, 60, 52, 18);
  hull.strokeRoundedRect(-30, -26, 60, 52, 18);
  hull.fillStyle(0xc4ce94, 0.22);
  hull.fillEllipse(0, -8, 28, 14);

  const turret = scene.add.graphics();
  turret.fillStyle(palette.turret, 1);
  turret.lineStyle(4, 0x28321f, 0.95);
  turret.fillCircle(0, 0, 16);
  turret.strokeCircle(0, 0, 16);
  turret.fillRoundedRect(-5, -12, 14, 62, 7);
  turret.strokeRoundedRect(-5, -12, 14, 62, 7);
  turret.setPosition(0, -10);

  const container = scene.add.container(x, y, [shadow, hull, turret]);
  container.setScale(palette.scale);

  return {
    container,
    turret,
  };
}
