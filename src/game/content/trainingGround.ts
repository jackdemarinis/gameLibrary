import { gameConfig } from "../config/gameConfig";
import type { BattleLevelData } from "./levelTypes";

export const trainingGroundLevel: BattleLevelData = {
  id: "training-yard",
  name: "Training Yard",
  playerSpawn: { x: 680, y: 540 },
  enemySpawns: [{ id: "enemy-scout-1", x: 1380, y: 540 }],
  walls: [
    { x: 96, y: 96, width: 1568, height: 48 },
    { x: 96, y: 936, width: 1568, height: 48 },
    { x: 96, y: 96, width: 48, height: 888 },
    { x: 1616, y: 96, width: 48, height: 888 },
    { x: 544, y: 224, width: 48, height: 224 },
    { x: 544, y: 632, width: 48, height: 224 },
    { x: 944, y: 352, width: 256, height: 48 },
    { x: 1056, y: 688, width: 256, height: 48 },
  ],
  crates: [
    { x: 736, y: 480, width: gameConfig.gridSize, height: gameConfig.gridSize },
    { x: 820, y: 480, width: gameConfig.gridSize, height: gameConfig.gridSize },
    { x: 1280, y: 288, width: gameConfig.gridSize, height: gameConfig.gridSize },
  ],
};
