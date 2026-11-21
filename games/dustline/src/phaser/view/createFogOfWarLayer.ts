import Phaser from "phaser";
import { worldTheme } from "../../game/config/theme";
import {
  battleVisibilityTileState,
  type BattleVisibilitySnapshot,
} from "../../game/simulation/battle/types";

const FOG_DEPTH = 50;
const FOG_COLOR = 0x000000;

export interface FogOfWarLayer {
  sync(snapshot: BattleVisibilitySnapshot): void;
  destroy(): void;
}

export function createFogOfWarLayer(scene: Phaser.Scene): FogOfWarLayer {
  const graphics = scene.add.graphics();
  graphics.setDepth(FOG_DEPTH);

  let lastVersion = -1;

  return {
    sync(snapshot) {
      if (snapshot.version === lastVersion) {
        return;
      }

      lastVersion = snapshot.version;
      graphics.clear();
      drawFogTiles(graphics, snapshot, battleVisibilityTileState.unexplored, worldTheme.fogUnexploredAlpha);
      drawFogTiles(graphics, snapshot, battleVisibilityTileState.explored, worldTheme.fogExploredAlpha);
      drawFogTiles(graphics, snapshot, battleVisibilityTileState.visible, worldTheme.fogVisibleAlpha);
    },
    destroy() {
      graphics.destroy();
    },
  };
}

function drawFogTiles(
  graphics: Phaser.GameObjects.Graphics,
  snapshot: BattleVisibilitySnapshot,
  tileState: number,
  alpha: number,
): void {
  if (alpha <= 0) {
    return;
  }

  graphics.fillStyle(FOG_COLOR, alpha);

  for (let row = 0; row < snapshot.rows; row += 1) {
    for (let column = 0; column < snapshot.columns; column += 1) {
      const index = row * snapshot.columns + column;

      if (snapshot.tileStates[index] !== tileState) {
        continue;
      }

      graphics.fillRect(
        column * snapshot.tileSize,
        row * snapshot.tileSize,
        snapshot.tileSize,
        snapshot.tileSize,
      );
    }
  }
}
