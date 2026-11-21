import { gameConfig } from "../config/gameConfig";
import type { BattleLevelData } from "./levelTypes";

const crateSize = { width: gameConfig.gridSize, height: gameConfig.gridSize };

// Campaign finale: cross the open approach, then breach the citadel through the
// reinforced main gate or the thinner north postern. Three heavies hold the keep.
export const dustlineCitadelLevel: BattleLevelData = {
  id: "dustline-citadel",
  name: "Dustline Citadel",
  briefing: "Cross the approach, breach the citadel gate or the north postern, and break the garrison.",
  playerSpawn: { x: 240, y: 540 },
  enemySpawns: [
    {
      id: "citadel-chaser-1",
      x: 700,
      y: 200,
      archetype: "chaser",
      patrol: [
        { x: 700, y: 200 },
        { x: 1000, y: 180 },
      ],
    },
    {
      id: "citadel-chaser-2",
      x: 700,
      y: 880,
      archetype: "chaser",
      patrol: [
        { x: 700, y: 880 },
        { x: 1000, y: 890 },
      ],
    },
    { id: "citadel-flanker-1", x: 960, y: 540, archetype: "flanker" },
    { id: "citadel-heavy-1", x: 1200, y: 540, archetype: "heavy" },
    { id: "citadel-heavy-2", x: 1460, y: 360, archetype: "heavy" },
    { id: "citadel-heavy-3", x: 1460, y: 720, archetype: "heavy" },
    {
      id: "citadel-flanker-2",
      x: 1540,
      y: 540,
      archetype: "flanker",
      patrol: [
        { x: 1540, y: 540 },
        { x: 1540, y: 420 },
      ],
    },
  ],
  indestructibleWalls: [
    { x: 96, y: 96, width: 1568, height: 48 },
    { x: 96, y: 936, width: 1568, height: 48 },
    { x: 96, y: 96, width: 48, height: 888 },
    { x: 1616, y: 96, width: 48, height: 888 },
    // Approach cover.
    { x: 448, y: 144, width: 48, height: 208 },
    { x: 448, y: 728, width: 48, height: 208 },
    { x: 640, y: 440, width: 48, height: 200 },
    { x: 832, y: 240, width: 128, height: 48 },
    { x: 832, y: 792, width: 128, height: 48 },
    // Citadel walls.
    { x: 1056, y: 240, width: 48, height: 208 },
    { x: 1056, y: 624, width: 48, height: 216 },
    { x: 1056, y: 240, width: 400, height: 48 },
    { x: 1056, y: 792, width: 560, height: 48 },
    // Keep pillars.
    { x: 1280, y: 400, width: 48, height: 96 },
    { x: 1280, y: 584, width: 48, height: 96 },
  ],
  weakWalls: [
    { id: "citadel-gate", x: 1056, y: 448, width: 48, height: 176, maxHealth: 102 },
    { id: "citadel-postern", x: 1456, y: 240, width: 160, height: 48, maxHealth: 68 },
  ],
  crates: [
    { id: "citadel-crate-1", x: 300, y: 300, ...crateSize, maxHealth: 34 },
    { id: "citadel-crate-2", x: 300, y: 780, ...crateSize, maxHealth: 34 },
    { id: "citadel-crate-3", x: 560, y: 480, ...crateSize, maxHealth: 34 },
    { id: "citadel-crate-4", x: 560, y: 560, ...crateSize, maxHealth: 34 },
    { id: "citadel-crate-5", x: 880, y: 400, ...crateSize, maxHealth: 34 },
    { id: "citadel-crate-6", x: 880, y: 616, ...crateSize, maxHealth: 34 },
    { id: "citadel-crate-7", x: 1160, y: 320, ...crateSize, maxHealth: 34 },
    { id: "citadel-crate-8", x: 1160, y: 700, ...crateSize, maxHealth: 34 },
    { id: "citadel-crate-9", x: 1520, y: 700, ...crateSize, maxHealth: 34, rewardCredits: 120 },
  ],
  pickups: [{ id: "citadel-cache", kind: "coin", x: 1300, y: 890, value: 150 }],
};
