import { describe, expect, it } from "vitest";
import type { BattleLevelData } from "../../content/levelTypes";
import { createInitialSave } from "../state";
import { battleVisibilityTileState } from "./types";
import { getVisibilityTileStateAtWorldPoint } from "./visibility";
import { BattleSimulation } from "./BattleSimulation";

const openTestLevel: BattleLevelData = {
  id: "test-open",
  name: "Open Test",
  briefing: "Clear the open lane.",
  playerSpawn: { x: 120, y: 120 },
  enemySpawns: [{ id: "enemy-1", x: 120, y: 240, archetype: "chaser" }],
  indestructibleWalls: [],
  weakWalls: [],
  crates: [],
  pickups: [],
};

const wallTestLevel: BattleLevelData = {
  id: "test-wall",
  name: "Wall Test",
  briefing: "Slide the hull along the barrier.",
  playerSpawn: { x: 100, y: 100 },
  enemySpawns: [],
  indestructibleWalls: [{ x: 140, y: 60, width: 40, height: 120 }],
  weakWalls: [],
  crates: [],
  pickups: [],
};

const enemyWallTestLevel: BattleLevelData = {
  id: "test-enemy-wall",
  name: "Enemy Wall Test",
  briefing: "Enemy should not drive into the wall column.",
  playerSpawn: { x: 80, y: 420 },
  enemySpawns: [{ id: "enemy-1", x: 220, y: 120, archetype: "chaser" }],
  indestructibleWalls: [{ x: 140, y: 60, width: 40, height: 220 }],
  weakWalls: [],
  crates: [],
  pickups: [],
};

const destructibleTestLevel: BattleLevelData = {
  id: "test-destructible",
  name: "Destructible Test",
  briefing: "Destroy cover and sweep the rewards.",
  playerSpawn: { x: 120, y: 120 },
  enemySpawns: [{ id: "enemy-1", x: 900, y: 900, archetype: "heavy" }],
  indestructibleWalls: [],
  weakWalls: [{ id: "wall-1", x: 176, y: 72, width: 48, height: 96, maxHealth: 68 }],
  crates: [{ id: "crate-1", x: 288, y: 88, width: 64, height: 64, maxHealth: 34, rewardCredits: 55 }],
  pickups: [{ id: "pickup-1", kind: "coin", x: 80, y: 180, value: 25 }],
};

const archetypeTestLevel: BattleLevelData = {
  id: "test-archetypes",
  name: "Archetype Test",
  briefing: "Different enemy tanks should feel and behave differently.",
  playerSpawn: { x: 120, y: 120 },
  enemySpawns: [
    { id: "chaser-1", x: 520, y: 120, archetype: "chaser" },
    { id: "heavy-1", x: 520, y: 220, archetype: "heavy" },
    { id: "flanker-1", x: 520, y: 320, archetype: "flanker" },
  ],
  indestructibleWalls: [],
  weakWalls: [],
  crates: [],
  pickups: [],
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

  it("updates exploration memory as the player uncovers new space", () => {
    const simulation = new BattleSimulation(openTestLevel, createInitialSave());

    let snapshot = simulation.getSnapshot();
    expect(getVisibilityTileStateAtWorldPoint(snapshot.visibility, openTestLevel.playerSpawn)).toBe(
      battleVisibilityTileState.visible,
    );

    advanceFor(simulation, 1600, {
      movementX: 1,
      movementY: 0,
      aim: { x: 420, y: 120 },
      firing: false,
    });

    snapshot = simulation.getSnapshot();
    expect(getVisibilityTileStateAtWorldPoint(snapshot.visibility, openTestLevel.playerSpawn)).toBe(
      battleVisibilityTileState.explored,
    );
    expect(getVisibilityTileStateAtWorldPoint(snapshot.visibility, { x: 420, y: 120 })).toBe(
      battleVisibilityTileState.visible,
    );
  });

  it("lets the player destroy the enemy, then collect the dropped credits", () => {
    const simulation = new BattleSimulation(openTestLevel, createInitialSave());

    advanceTrackingEnemy(simulation, 1800);

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
    expect(simulation.getResultSummary()).toMatchObject({
      status: "won",
      levelId: openTestLevel.id,
      levelName: openTestLevel.name,
      creditsEarned: 35,
      damageTaken: 0,
    });
  });

  it("loads authored reward pickups and lets the player collect them", () => {
    const simulation = new BattleSimulation(destructibleTestLevel, createInitialSave());

    expect(simulation.getSnapshot().pickups).toHaveLength(1);

    advanceFor(simulation, 500, {
      movementX: -1,
      movementY: 1,
      aim: { x: 80, y: 180 },
      firing: false,
    });

    const snapshot = simulation.getSnapshot();
    expect(snapshot.credits).toBe(25);
    expect(snapshot.pickups).toHaveLength(0);
  });

  it("lets the player destroy weak walls and crates to open space", () => {
    const simulation = new BattleSimulation(destructibleTestLevel, createInitialSave());

    advanceFor(simulation, 900, {
      movementX: 0,
      movementY: 0,
      aim: { x: 200, y: 120 },
      firing: true,
    });

    let snapshot = simulation.getSnapshot();
    expect(snapshot.breakableObstacles.some((obstacle) => obstacle.id === "wall-1")).toBe(false);

    advanceFor(simulation, 500, {
      movementX: 0,
      movementY: 0,
      aim: { x: 320, y: 120 },
      firing: true,
    });

    snapshot = simulation.getSnapshot();
    expect(snapshot.breakableObstacles.some((obstacle) => obstacle.id === "crate-1")).toBe(false);
    expect(snapshot.pickups.some((pickup) => pickup.x === 320 && pickup.y === 120)).toBe(true);
  });

  it("allows the enemy to destroy the player and trigger the lose state", () => {
    const simulation = new BattleSimulation(openTestLevel, createInitialSave());

    advanceFor(simulation, 10500, {
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
    expect(enemy.y).toBeGreaterThanOrEqual(120);
  });

  it("gives archetypes distinct durability and movement profiles", () => {
    const simulation = new BattleSimulation(archetypeTestLevel, createInitialSave());
    const initialEnemies = indexEnemies(simulation.getSnapshot().enemies);

    expect(initialEnemies["heavy-1"].maxHealth).toBeGreaterThan(initialEnemies["chaser-1"].maxHealth);
    expect(initialEnemies["chaser-1"].maxHealth).toBeGreaterThan(initialEnemies["flanker-1"].maxHealth);

    advanceFor(simulation, 1000, {
      movementX: 0,
      movementY: 0,
      aim: { x: 120, y: 120 },
      firing: false,
    });

    const nextEnemies = indexEnemies(simulation.getSnapshot().enemies);
    const heavyTravel = distanceTravelled(initialEnemies["heavy-1"], nextEnemies["heavy-1"]);
    const flankerTravel = distanceTravelled(initialEnemies["flanker-1"], nextEnemies["flanker-1"]);

    expect(nextEnemies["chaser-1"].aiState).toBe("engage");
    expect(nextEnemies["heavy-1"].aiState).toBe("engage");
    expect(nextEnemies["flanker-1"].aiState).not.toBe("idle");
    expect(flankerTravel).toBeGreaterThan(heavyTravel);
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

function advanceTrackingEnemy(simulation: BattleSimulation, durationMs: number): void {
  const stepMs = 16;

  for (let elapsed = 0; elapsed < durationMs; elapsed += stepMs) {
    const enemy = simulation.getSnapshot().enemies.find((candidate) => candidate.alive);

    simulation.advance(stepMs, {
      movementX: 0,
      movementY: 0,
      aim: enemy
        ? { x: enemy.x, y: enemy.y }
        : { x: 120, y: 240 },
      firing: true,
    });
  }
}

function indexEnemies(enemies: ReturnType<BattleSimulation["getSnapshot"]>["enemies"]) {
  return Object.fromEntries(enemies.map((enemy) => [enemy.id, enemy])) as Record<
    string,
    (typeof enemies)[number]
  >;
}

function distanceTravelled(
  start: ReturnType<BattleSimulation["getSnapshot"]>["enemies"][number],
  end: ReturnType<BattleSimulation["getSnapshot"]>["enemies"][number],
): number {
  return Math.hypot(end.x - start.x, end.y - start.y);
}
