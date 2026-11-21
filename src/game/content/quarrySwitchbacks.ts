import { gameConfig } from "../config/gameConfig";
import type { BattleLevelData } from "./levelTypes";

const crateSize = { width: gameConfig.gridSize, height: gameConfig.gridSize };

// Three stacked lanes joined by alternating gaps: the long way zig-zags down,
// the weak ledge walls are the shortcut if you can punch through under fire.
export const quarrySwitchbacksLevel: BattleLevelData = {
  id: "quarry-switchbacks",
  name: "Quarry Switchbacks",
  briefing: "Work down the quarry ledges, blast shortcuts through the weak rock, and clear every lane.",
  playerSpawn: { x: 240, y: 240 },
  enemySpawns: [
    {
      id: "quarry-chaser-1",
      x: 1100,
      y: 240,
      archetype: "chaser",
      patrol: [
        { x: 1100, y: 240 },
        { x: 1450, y: 240 },
      ],
    },
    {
      id: "quarry-flanker-1",
      x: 560,
      y: 420,
      archetype: "flanker",
      patrol: [
        { x: 560, y: 420 },
        { x: 1180, y: 420 },
      ],
    },
    { id: "quarry-heavy-1", x: 1460, y: 500, archetype: "heavy" },
    {
      id: "quarry-chaser-2",
      x: 900,
      y: 800,
      archetype: "chaser",
      patrol: [
        { x: 900, y: 800 },
        { x: 1400, y: 800 },
      ],
    },
    { id: "quarry-heavy-2", x: 1480, y: 860, archetype: "heavy" },
  ],
  indestructibleWalls: [
    { x: 96, y: 96, width: 1568, height: 48 },
    { x: 96, y: 936, width: 1568, height: 48 },
    { x: 96, y: 96, width: 48, height: 888 },
    { x: 1616, y: 96, width: 48, height: 888 },
    // Upper ledge, open at the east end.
    { x: 144, y: 336, width: 384, height: 48 },
    { x: 688, y: 336, width: 624, height: 48 },
    // Lower ledge, open at the west end.
    { x: 448, y: 624, width: 528, height: 48 },
    { x: 1136, y: 624, width: 480, height: 48 },
    // Boulders.
    { x: 880, y: 144, width: 48, height: 96 },
    { x: 736, y: 480, width: 64, height: 96 },
    { x: 640, y: 760, width: 64, height: 96 },
  ],
  weakWalls: [
    { id: "quarry-shortcut-1", x: 528, y: 336, width: 160, height: 48, maxHealth: 68 },
    { id: "quarry-shortcut-2", x: 976, y: 624, width: 160, height: 48, maxHealth: 68 },
  ],
  crates: [
    { id: "quarry-crate-1", x: 1340, y: 420, ...crateSize, maxHealth: 34 },
    { id: "quarry-crate-2", x: 1340, y: 520, ...crateSize, maxHealth: 34 },
    { id: "quarry-crate-3", x: 300, y: 720, ...crateSize, maxHealth: 34 },
    { id: "quarry-crate-4", x: 380, y: 720, ...crateSize, maxHealth: 34 },
    { id: "quarry-crate-5", x: 1520, y: 180, ...crateSize, maxHealth: 34, rewardCredits: 80 },
  ],
  pickups: [{ id: "quarry-cache", kind: "coin", x: 1560, y: 890, value: 120 }],
};
