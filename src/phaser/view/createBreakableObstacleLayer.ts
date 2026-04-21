import Phaser from "phaser";
import { worldTheme } from "../../game/config/theme";
import type { BreakableObstacleSnapshot } from "../../game/simulation/battle/types";

export interface BreakableObstacleLayer {
  sync(obstacles: readonly BreakableObstacleSnapshot[]): void;
  destroy(): void;
}

export function createBreakableObstacleLayer(scene: Phaser.Scene): BreakableObstacleLayer {
  const sprites = new Map<string, Phaser.GameObjects.Graphics>();
  const signatures = new Map<string, string>();

  return {
    sync(obstacles) {
      const activeIds = new Set(obstacles.map((obstacle) => obstacle.id));

      sprites.forEach((sprite, id) => {
        if (activeIds.has(id)) {
          return;
        }

        sprite.destroy();
        sprites.delete(id);
        signatures.delete(id);
      });

      obstacles.forEach((obstacle) => {
        const signature = [
          obstacle.kind,
          obstacle.x,
          obstacle.y,
          obstacle.width,
          obstacle.height,
          obstacle.health,
          obstacle.maxHealth,
        ].join(":");
        let sprite = sprites.get(obstacle.id);

        if (!sprite) {
          sprite = scene.add.graphics();
          sprite.setDepth(1);
          sprites.set(obstacle.id, sprite);
        }

        if (signatures.get(obstacle.id) === signature) {
          return;
        }

        signatures.set(obstacle.id, signature);
        redrawObstacle(sprite, obstacle);
      });
    },
    destroy() {
      sprites.forEach((sprite) => sprite.destroy());
      sprites.clear();
      signatures.clear();
    },
  };
}

function redrawObstacle(
  graphics: Phaser.GameObjects.Graphics,
  obstacle: BreakableObstacleSnapshot,
): void {
  graphics.clear();

  if (obstacle.kind === "crate") {
    graphics.fillStyle(worldTheme.crateFill, 0.95);
    graphics.lineStyle(4, worldTheme.crateStroke, 1);
    graphics.fillRoundedRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height, 8);
    graphics.strokeRoundedRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height, 8);
    graphics.lineBetween(obstacle.x + 10, obstacle.y + 10, obstacle.x + obstacle.width - 10, obstacle.y + obstacle.height - 10);
    graphics.lineBetween(obstacle.x + obstacle.width - 10, obstacle.y + 10, obstacle.x + 10, obstacle.y + obstacle.height - 10);
    return;
  }

  graphics.fillStyle(worldTheme.weakWallFill, 0.96);
  graphics.lineStyle(4, worldTheme.weakWallStroke, 1);
  graphics.fillRoundedRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height, 8);
  graphics.strokeRoundedRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height, 8);

  if (obstacle.width >= obstacle.height) {
    const segmentWidth = obstacle.width / 3;

    for (let index = 1; index < 3; index += 1) {
      const x = obstacle.x + segmentWidth * index;
      graphics.lineBetween(x, obstacle.y + 8, x, obstacle.y + obstacle.height - 8);
    }
  } else {
    const segmentHeight = obstacle.height / 3;

    for (let index = 1; index < 3; index += 1) {
      const y = obstacle.y + segmentHeight * index;
      graphics.lineBetween(obstacle.x + 8, y, obstacle.x + obstacle.width - 8, y);
    }
  }

  if (obstacle.health < obstacle.maxHealth) {
    graphics.lineStyle(3, 0xe6d8bb, 0.9);
    graphics.lineBetween(
      obstacle.x + 10,
      obstacle.y + obstacle.height * 0.35,
      obstacle.x + obstacle.width - 12,
      obstacle.y + obstacle.height * 0.68,
    );
    graphics.lineBetween(
      obstacle.x + obstacle.width * 0.38,
      obstacle.y + 10,
      obstacle.x + obstacle.width * 0.52,
      obstacle.y + obstacle.height - 10,
    );
  }
}
