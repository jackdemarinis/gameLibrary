import { gameConfig } from "../config/gameConfig";

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BattlefieldPreview {
  playerSpawn: Point;
  enemySpawns: Point[];
  walls: Rect[];
  crates: Rect[];
}

export const foundationOutpost: BattlefieldPreview = {
  playerSpawn: { x: 268, y: 560 },
  enemySpawns: [
    { x: 1180, y: 408 },
    { x: 1384, y: 770 },
  ],
  walls: [
    { x: 96, y: 144, width: 1100, height: 48 },
    { x: 96, y: 144, width: 48, height: 780 },
    { x: 96, y: 876, width: 1420, height: 48 },
    { x: 1468, y: 144, width: 48, height: 780 },
    { x: 448, y: 192, width: 48, height: 264 },
    { x: 448, y: 612, width: 48, height: 264 },
    { x: 786, y: 330, width: 48, height: 594 },
    { x: 1130, y: 144, width: 48, height: 330 },
    { x: 1130, y: 636, width: 48, height: 288 },
  ],
  crates: [
    { x: 298, y: 312, width: gameConfig.gridSize, height: gameConfig.gridSize },
    { x: 298, y: 396, width: gameConfig.gridSize, height: gameConfig.gridSize },
    { x: 616, y: 232, width: gameConfig.gridSize, height: gameConfig.gridSize },
    { x: 616, y: 776, width: gameConfig.gridSize, height: gameConfig.gridSize },
    { x: 1244, y: 542, width: gameConfig.gridSize, height: gameConfig.gridSize },
  ],
};
