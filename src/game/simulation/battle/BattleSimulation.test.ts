import { describe, expect, it } from "vitest";
import type { BattleLevelData } from "../../content/levelTypes";
import { createInitialSave } from "../state";
import { BattleSimulation } from "./BattleSimulation";

const openTestLevel: BattleLevelData = {
  id: "test-open",
  name: "Open Test",
  playerSpawn: { x: 120, y: 120 },
  enemySpawns: [{ id: "enemy-1", x: 120, y: 240 }],
  walls: [],
  crates: [],
};

const wallTestLevel: BattleLevelData = {
  id: "test-wall",
  name: "Wall Test",
  playerSpawn: { x: 100, y: 100 },
  enemySpawns: [],
  walls: [{ x: 140, y: 60, width: 40, height: 120 }],
  crates: [],
};

const enemyWallTestLevel: BattleLevelData = {
  id: "test-enemy-wall",
  name: "Enemy Wall Test",
  playerSpawn: { x: 80, y: 420 },
  enemySpawns: [{ id: "enemy-1", x: 220, y: 120 }],
  walls: [{ x: 140, y: 60, width: 40, height: 220 }],
  crates: [],
};

describe("BattleSimulation", () => {
  it("stops the player against walls", () => {
    const simulation = new BattleSimulation(wallTestLevel, createInitialSave());

    advanceFor(simulation, 900, {
      movementX: 1,
      movementY: 0,
      aim: { x: 300, y: 100 },
      firing: false,
    });

    const snapshot = simulation.getSnapshot();
    expect(snapshot.player.x).toBeLessThanOrEqual(112);
  });

  it("slides the player along walls without snapping backward", () => {
    const simulation = new BattleSimulation(wallTestLevel, createInitialSave());

    advanceFor(simulation, 600, {
      movementX: 1,
      movementY: 1,
      aim: { x: 300, y: 260 },
      firing: false,
    });

    const snapshot = simulation.getSnapshot();
    expect(snapshot.player.x).toBeLessThanOrEqual(112.1);
    expect(snapshot.player.y).toBeGreaterThan(180);
  });

  it("lets the player destroy the enemy, then collect the dropped credits", () => {
    const simulation = new BattleSimulation(openTestLevel, createInitialSave());

    advanceFor(simulation, 1500, {
      movementX: 0,
      movementY: 0,
      aim: { x: 120, y: 240 },
      firing: true,
    });

    let snapshot = simulation.getSnapshot();
    expect(snapshot.status).toBe("won");
    expect(snapshot.pickups).toHaveLength(1);

    advanceFor(simulation, 800, {
      movementX: 0,
      movementY: 1,
      aim: { x: 120, y: 240 },
      firing: false,
    });

    snapshot = simulation.getSnapshot();
    expect(snapshot.credits).toBe(35);
    expect(snapshot.pickups).toHaveLength(0);
  });

  it("allows the enemy to destroy the player and trigger the lose state", () => {
    const simulation = new BattleSimulation(openTestLevel, createInitialSave());

    advanceFor(simulation, 7200, {
      movementX: 0,
      movementY: 0,
      aim: { x: 120, y: 20 },
      firing: false,
    });

    expect(simulation.getSnapshot().status).toBe("lost");
  });

  it("keeps the enemy outside blocking walls while it steers toward the player", () => {
    const simulation = new BattleSimulation(enemyWallTestLevel, createInitialSave());

    advanceFor(simulation, 1000, {
      movementX: 0,
      movementY: 0,
      aim: { x: 80, y: 420 },
      firing: false,
    });

    const enemy = simulation.getSnapshot().enemies[0];
    expect(enemy.x).toBeGreaterThanOrEqual(208);
    expect(enemy.y).toBeGreaterThan(150);
  });
});

function advanceFor(
  simulation: BattleSimulation,
  durationMs: number,
  input: { movementX: number; movementY: number; aim: { x: number; y: number }; firing: boolean },
): void {
  const stepMs = 16;

  for (let elapsed = 0; elapsed < durationMs; elapsed += stepMs) {
    simulation.advance(stepMs, input);
  }
}
