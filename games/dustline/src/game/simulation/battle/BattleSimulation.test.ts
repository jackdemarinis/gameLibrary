import { describe, expect, it } from "vitest";
import { battleConfig } from "../../config/battleConfig";
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
  enemySpawns: [{ id: "enemy-1", x: 120, y: 240, archetype: "raider" }],
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
  enemySpawns: [{ id: "enemy-1", x: 220, y: 120, archetype: "raider" }],
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
  enemySpawns: [{ id: "enemy-1", x: 900, y: 900, archetype: "bulwark" }],
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
    { id: "raider-1", x: 520, y: 120, archetype: "raider" },
    { id: "bulwark-1", x: 520, y: 220, archetype: "bulwark" },
    { id: "skirmisher-1", x: 520, y: 320, archetype: "skirmisher" },
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

    advanceTrackingEnemy(simulation, 2600);

    let snapshot = simulation.getSnapshot();
    expect(snapshot.status).toBe("won");
    expect(snapshot.pickups).toHaveLength(1);
    expect(snapshot.totalScore).toBe(140);

    // Enemies strafe, so the coin lands wherever the kill happened: drive to it.
    advanceTowardPickup(simulation, 2400);

    snapshot = simulation.getSnapshot();
    expect(snapshot.credits).toBe(35);
    expect(snapshot.totalScore).toBe(175);
    expect(snapshot.pickups).toHaveLength(0);
    expect(simulation.getResultSummary()).toMatchObject({
      status: "won",
      levelId: openTestLevel.id,
      levelName: openTestLevel.name,
      creditsEarned: 35,
      pointsEarned: 175,
      totalScore: 175,
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
    expect(snapshot.totalScore).toBe(25);
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
    expect(snapshot.totalScore).toBe(55);
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

    expect(initialEnemies["bulwark-1"].maxHealth).toBeGreaterThan(initialEnemies["raider-1"].maxHealth);
    expect(initialEnemies["raider-1"].maxHealth).toBeGreaterThan(initialEnemies["skirmisher-1"].maxHealth);

    advanceFor(simulation, 1000, {
      movementX: 0,
      movementY: 0,
      aim: { x: 120, y: 120 },
      firing: false,
    });

    const nextEnemies = indexEnemies(simulation.getSnapshot().enemies);
    const bulwarkTravel = distanceTravelled(initialEnemies["bulwark-1"], nextEnemies["bulwark-1"]);
    const skirmisherTravel = distanceTravelled(initialEnemies["skirmisher-1"], nextEnemies["skirmisher-1"]);

    expect(nextEnemies["raider-1"].aiState).toBe("engage");
    expect(nextEnemies["bulwark-1"].aiState).toBe("engage");
    expect(nextEnemies["skirmisher-1"].aiState).not.toBe("idle");
    expect(skirmisherTravel).toBeGreaterThan(bulwarkTravel);
  });

  it("applies saved upgrades and difficulty to the very next level", () => {
    const baseline = new BattleSimulation(openTestLevel, createInitialSave());
    const upgradedSave = createInitialSave({
      difficulty: "ace",
    });

    upgradedSave.upgrades.maxHealth = 1;
    upgradedSave.upgrades.movementSpeed = 1;
    upgradedSave.weaponLevels.cannon = 1;
    upgradedSave.upgrades.visibilityRadius = 1;
    upgradedSave.upgrades.fireRate = 1;
    upgradedSave.upgrades.turretRotationSpeed = 1;

    const upgraded = new BattleSimulation(openTestLevel, upgradedSave);
    const baselineStart = baseline.getSnapshot();
    const upgradedStart = upgraded.getSnapshot();
    const farVisibilityPoint = {
      x: openTestLevel.playerSpawn.x,
      y: openTestLevel.playerSpawn.y + battleConfig.visibility.tileSize * 3.75,
    };

    expect(upgradedStart.player.maxHealth).toBeGreaterThan(baselineStart.player.maxHealth);
    expect(
      getVisibilityTileStateAtWorldPoint(baselineStart.visibility, farVisibilityPoint),
    ).toBe(battleVisibilityTileState.unexplored);
    expect(
      getVisibilityTileStateAtWorldPoint(upgradedStart.visibility, farVisibilityPoint),
    ).toBe(battleVisibilityTileState.visible);

    advanceFor(baseline, 250, {
      movementX: 1,
      movementY: 0,
      aim: { x: 240, y: 120 },
      firing: false,
    });
    advanceFor(upgraded, 250, {
      movementX: 1,
      movementY: 0,
      aim: { x: 240, y: 120 },
      firing: false,
    });

    expect(upgraded.getSnapshot().player.x).toBeGreaterThan(baseline.getSnapshot().player.x);

    advanceFor(baseline, 40, {
      movementX: 0,
      movementY: 0,
      aim: { x: 0, y: 120 },
      firing: false,
    });
    advanceFor(upgraded, 40, {
      movementX: 0,
      movementY: 0,
      aim: { x: 0, y: 120 },
      firing: false,
    });

    expect(upgraded.getSnapshot().player.turretRotation).toBeGreaterThan(
      baseline.getSnapshot().player.turretRotation,
    );
  });

  it("heals with a repair kit and doubles fire rate with a rapid-fire charge", () => {
    const supplyLevel: BattleLevelData = {
      ...openTestLevel,
      id: "test-supply",
      enemySpawns: [{ id: "enemy-far", x: 1500, y: 900, archetype: "raider" }],
      pickups: [
        { id: "repair", kind: "repair", x: 120, y: 120, value: 0 },
        { id: "rapid", kind: "rapidFire", x: 120, y: 120, value: 0 },
      ],
    };
    const simulation = new BattleSimulation(supplyLevel, createInitialSave());
    const state = (simulation as unknown as { state: { player: { health: number; maxHealth: number } } }).state;
    state.player.health = 20;
    const idle = { movementX: 0, movementY: 0, aim: { x: 400, y: 120 }, firing: false };
    simulation.advance(20, idle);
    expect(state.player.health).toBeGreaterThan(20);
    expect(simulation.getHudSnapshot().rapidFireSeconds).toBeGreaterThan(0);

    let shots = 0;
    let lastCount = 0;
    for (let frame = 0; frame < 120; frame += 1) {
      const count = simulation.advance(16, { ...idle, firing: true }).snapshot.projectiles.length;
      if (count > lastCount) shots += count - lastCount;
      lastCount = count;
    }
    const normal = new BattleSimulation({ ...supplyLevel, pickups: [] }, createInitialSave());
    let normalShots = 0;
    lastCount = 0;
    for (let frame = 0; frame < 120; frame += 1) {
      const count = normal.advance(16, { ...idle, firing: true }).snapshot.projectiles.length;
      if (count > lastCount) normalShots += count - lastCount;
      lastCount = count;
    }
    expect(shots).toBeGreaterThan(normalShots);
  });

  it("gives the bulwark a twin volley and the warden a three-shell spread", () => {
    const volleyLevel: BattleLevelData = {
      ...openTestLevel,
      id: "test-volley",
      enemySpawns: [
        { id: "bulwark-1", x: 120, y: 360, archetype: "bulwark" },
        { id: "warden-1", x: 360, y: 120, archetype: "warden" },
      ],
    };
    const simulation = new BattleSimulation(volleyLevel, createInitialSave());
    const owners = new Map<string, number>();
    const seen = new Set<string>();
    for (let frame = 0; frame < 120; frame += 1) {
      const state = (simulation as unknown as { state: { projectiles: { id: string; ownerId: string }[] } }).state;
      simulation.advance(16, { movementX: 0, movementY: 0, aim: { x: 120, y: 400 }, firing: false });
      state.projectiles.forEach((projectile) => {
        if (seen.has(projectile.id)) return;
        seen.add(projectile.id);
        owners.set(projectile.ownerId, (owners.get(projectile.ownerId) ?? 0) + 1);
      });
    }
    expect((owners.get("bulwark-1") ?? 0) % 2).toBe(0);
    expect(owners.get("bulwark-1") ?? 0).toBeGreaterThanOrEqual(2);
    expect(owners.get("warden-1") ?? 0).toBeGreaterThanOrEqual(3);
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

function advanceTowardPickup(simulation: BattleSimulation, durationMs: number): void {
  const stepMs = 16;

  for (let elapsed = 0; elapsed < durationMs; elapsed += stepMs) {
    const snapshot = simulation.getSnapshot();
    const pickup = snapshot.pickups[0];

    if (!pickup) {
      return;
    }

    const offsetX = pickup.x - snapshot.player.x;
    const offsetY = pickup.y - snapshot.player.y;
    simulation.advance(stepMs, {
      movementX: Math.abs(offsetX) > 4 ? Math.sign(offsetX) : 0,
      movementY: Math.abs(offsetY) > 4 ? Math.sign(offsetY) : 0,
      aim: { x: pickup.x, y: pickup.y },
      firing: false,
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
