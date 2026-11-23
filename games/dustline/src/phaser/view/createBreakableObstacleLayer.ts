import Phaser from "phaser";
import type { BreakableObstacleSnapshot } from "../../game/simulation/battle/types";
import { worldTheme } from "../../game/config/theme";
import { reinforcedBrickHealth } from "../../game/content/tileMap";
import { drawPixelHealthBar } from "./drawTank";
import { damageStage, ensureObstacleTexture, type ObstacleVariant } from "./dustlinePixelArt";

export interface BreakableObstacleLayer {
  sync(obstacles: readonly BreakableObstacleSnapshot[]): void;
  destroy(): void;
}

interface ObstacleSprite {
  image: Phaser.GameObjects.Image;
  /** Spawners only: shown once they have taken damage. */
  healthBar: Phaser.GameObjects.Graphics | null;
}

/**
 * Brick walls, crates, supply crates and spawners as pixel-art images; damage
 * swaps to a more broken texture.
 */
export function createBreakableObstacleLayer(scene: Phaser.Scene): BreakableObstacleLayer {
  const sprites = new Map<string, ObstacleSprite>();

  return {
    sync(obstacles) {
      const activeIds = new Set(obstacles.map((obstacle) => obstacle.id));

      sprites.forEach((sprite, id) => {
        if (activeIds.has(id)) {
          return;
        }

        sprite.image.destroy();
        sprite.healthBar?.destroy();
        sprites.delete(id);
      });

      obstacles.forEach((obstacle) => {
        const stage = damageStage(obstacle.health, obstacle.maxHealth);
        const key = ensureObstacleTexture(
          scene,
          obstacle.kind,
          obstacle.width,
          obstacle.height,
          stage,
          obstacleVariant(obstacle),
        );
        let sprite = sprites.get(obstacle.id);

        if (!sprite) {
          const image = scene.add.image(obstacle.x, obstacle.y, key).setOrigin(0).setDepth(1);
          const healthBar = obstacle.kind === "spawner" ? scene.add.graphics().setDepth(5) : null;
          sprite = { image, healthBar };
          sprites.set(obstacle.id, sprite);
        } else if (sprite.image.texture.key !== key) {
          sprite.image.setTexture(key);
        }

        sprite.image.setPosition(obstacle.x, obstacle.y);
        sprite.image.setDisplaySize(obstacle.width, obstacle.height);

        if (sprite.healthBar) {
          if (obstacle.health < obstacle.maxHealth) {
            sprite.healthBar.setPosition(obstacle.x + obstacle.width / 2, obstacle.y - 14);
            drawPixelHealthBar(sprite.healthBar, obstacle.health / obstacle.maxHealth, worldTheme.enemyHealthBarFill);
          } else {
            sprite.healthBar.clear();
          }
        }
      });
    },
    destroy() {
      sprites.forEach((sprite) => {
        sprite.image.destroy();
        sprite.healthBar?.destroy();
      });
      sprites.clear();
    },
  };
}

function obstacleVariant(obstacle: BreakableObstacleSnapshot): ObstacleVariant {
  switch (obstacle.kind) {
    case "supplyCrate":
      return obstacle.drop ?? "repair";
    case "crate":
      return obstacle.rewardCredits > 0 ? "special" : "plain";
    case "weakWall":
      return obstacle.maxHealth >= reinforcedBrickHealth ? "special" : "plain";
    case "spawner":
    default:
      return "plain";
  }
}
