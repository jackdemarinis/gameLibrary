import { gameConfig } from "../config/gameConfig";
import type { BattleLevelData } from "./levelTypes";

const crateSize = { width: gameConfig.gridSize, height: gameConfig.gridSize };

// Scrap heaps and crate clutter with fast flankers in the side alleys. The east
// yard is sealed by a weak barricade; the narrow corner gaps are the slow way in.
export const scrapyardMazeLevel: BattleLevelData = {
  id: "scrapyard-maze",
  name: "Scrapyard Maze",
  briefing: "Thread the scrap heaps, watch the alleys for flankers, and break into the sealed east yard.",
  playerSpawn: { x: 240, y: 540 },
  enemySpawns: [
    {
      id: "scrap-flanker-1",
      x: 720,
      y: 200,
      archetype: "flanker",
      patrol: [
        { x: 720, y: 200 },
        { x: 900, y: 220 },
      ],
    },
    {
      id: "scrap-flanker-2",
      x: 720,
      y: 860,
      archetype: "flanker",
      patrol: [
        { x: 720, y: 860 },
        { x: 900, y: 860 },
      ],
    },
    {
      id: "scrap-chaser-1",
      x: 1200,
      y: 400,
      archetype: "chaser",
      patrol: [
        { x: 1200, y: 400 },
        { x: 1200, y: 640 },
      ],
    },
    { id: "scrap-heavy-1", x: 1480, y: 300, archetype: "heavy" },
    { id: "scrap-chaser-2", x: 1480, y: 540, archetype: "chaser" },
    { id: "scrap-heavy-2", x: 1480, y: 760, archetype: "heavy" },
  ],
  indestructibleWalls: [
    { x: 96, y: 96, width: 1568, height: 48 },
    { x: 96, y: 936, width: 1568, height: 48 },
    { x: 96, y: 96, width: 48, height: 888 },
    { x: 1616, y: 96, width: 48, height: 888 },
    { x: 400, y: 144, width: 48, height: 256 },
    { x: 400, y: 680, width: 48, height: 256 },
    { x: 640, y: 304, width: 224, height: 48 },
    { x: 640, y: 728, width: 224, height: 48 },
    { x: 960, y: 144, width: 48, height: 208 },
    { x: 960, y: 728, width: 48, height: 208 },
    { x: 1056, y: 448, width: 96, height: 96 },
    // East yard fence.
    { x: 1312, y: 256, width: 48, height: 192 },
    { x: 1312, y: 632, width: 48, height: 192 },
  ],
  weakWalls: [{ id: "scrap-yard-gate", x: 1312, y: 448, width: 48, height: 184, maxHealth: 85 }],
  crates: [
    { id: "scrap-crate-1", x: 520, y: 400, ...crateSize, maxHealth: 34 },
    { id: "scrap-crate-2", x: 520, y: 620, ...crateSize, maxHealth: 34 },
    { id: "scrap-crate-3", x: 560, y: 200, ...crateSize, maxHealth: 34 },
    { id: "scrap-crate-4", x: 760, y: 520, ...crateSize, maxHealth: 34 },
    { id: "scrap-crate-5", x: 824, y: 520, ...crateSize, maxHealth: 34 },
    { id: "scrap-crate-6", x: 1180, y: 290, ...crateSize, maxHealth: 34 },
    { id: "scrap-crate-7", x: 1180, y: 700, ...crateSize, maxHealth: 34 },
    { id: "scrap-crate-8", x: 1120, y: 840, ...crateSize, maxHealth: 34 },
    { id: "scrap-crate-9", x: 1540, y: 180, ...crateSize, maxHealth: 34, rewardCredits: 90 },
  ],
  pickups: [{ id: "scrap-cache", kind: "coin", x: 1560, y: 880, value: 130 }],
};
