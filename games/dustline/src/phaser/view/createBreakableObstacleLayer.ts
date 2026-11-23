import Phaser from "phaser";
import type { BreakableObstacleSnapshot } from "../../game/simulation/battle/types";
import { reinforcedBrickHealth } from "../../game/content/tileMap";
import { damageStage, ensureObstacleTexture } from "./dustlinePixelArt";

export interface BreakableObstacleLayer {
  sync(obstacles: readonly BreakableObstacleSnapshot[]): void;
  destroy(): void;
}

/** Brick walls and crates as pixel-art images; damage swaps to a more broken texture. */
export function createBreakableObstacleLayer(scene: Phaser.Scene): BreakableObstacleLayer {
  const sprites = new Map<string, Phaser.GameObjects.Image>();

  return {
    sync(obstacles) {
      const activeIds = new Set(obstacles.map((obstacle) => obstacle.id));

      sprites.forEach((sprite, id) => {
        if (activeIds.has(id)) {
          return;
        }

        sprite.destroy();
        sprites.delete(id);
      });

      obstacles.forEach((obstacle) => {
        const stage = damageStage(obstacle.health, obstacle.maxHealth);
        const special =
          obstacle.kind === "crate" ? obstacle.rewardCredits > 0 : obstacle.maxHealth >= reinforcedBrickHealth;
        const key = ensureObstacleTexture(
          scene,
          obstacle.kind,
          obstacle.width,
          obstacle.height,
          stage,
          special ? "special" : "plain",
        );
        let sprite = sprites.get(obstacle.id);

        if (!sprite) {
          sprite = scene.add.image(obstacle.x, obstacle.y, key).setOrigin(0).setDepth(1);
          sprites.set(obstacle.id, sprite);
        } else if (sprite.texture.key !== key) {
          sprite.setTexture(key);
        }

        sprite.setPosition(obstacle.x, obstacle.y);
        sprite.setDisplaySize(obstacle.width, obstacle.height);
      });
    },
    destroy() {
      sprites.forEach((sprite) => sprite.destroy());
      sprites.clear();
    },
  };
}
