import { describe, expect, it } from "vitest";
import { battleConfig } from "../../config/battleConfig";
import { compileTileLevel } from "../../content/tileMap";
import type { BattleLevelData } from "../../content/levelTypes";
import { createInitialSave } from "../state";
import { BattleSimulation } from "./BattleSimulation";
import { battleLevelOrder } from "../../content/levelCatalog";
import { hiddenCrateDrop } from "./systems/destructibleSystem";

const idle = { movementX: 0, movementY: 0, aim: { x: 0, y: 0 }, firing: false };

function advanceFor(
  simulation: BattleSimulation,
  durationMs: number,
  input: { movementX: number; movementY: number; aim: { x: number; y: number }; firing: boolean } = idle,
): void {
  for (let elapsed = 0; elapsed < durationMs; elapsed += 16) {
    simulation.advance(16, input);
  }
}

const spawnerLevel: BattleLevelData = {
  id: "test-spawner",
  name: "Spawner Test",
  briefing: "",
  playerSpawn: { x: 120, y: 120 },
  enemySpawns: [],
  indestructibleWalls: [],
  weakWalls: [],
  crates: [],
  spawners: [
    { id: "spawner-1", x: 448, y: 96, width: 64, height: 64, maxHealth: 900, rewardCredits: 120, roster: ["raider"] },
  ],
  pickups: [],
};

describe("tile map power-ups and spawners", () => {
  it("compiles supply crates and spawners as solid breakables", () => {
    const level = compileTileLevel({
      id: "test",
      name: "Test",
      briefing: "",
      tagline: "",
      tier: "easy",
      rooms: [],
      map: ["#######", "#PHFR.#", "#..X.Y#", "#######"],
    });

    expect(level.supplyCrates?.map((crate) => crate.drop)).toEqual(["repair", "freeze", "rapidFire"]);
    expect(level.spawners?.map((spawner) => spawner.roster[0])).toEqual(["raider", "bulwark"]);
    expect(level.spawners?.[0].maxHealth).toBe(battleConfig.spawner.maxHealth);
  });
});

describe("enemy spawners", () => {
  it("produce tanks while the player is near, and the level is not won until they fall", () => {
    const simulation = new BattleSimulation(spawnerLevel, createInitialSave());

    expect(simulation.getSnapshot().status).toBe("active");
    advanceFor(simulation, battleConfig.spawner.firstSpawnDelayMs + 100);

    const snapshot = simulation.getSnapshot();
    expect(snapshot.enemies.filter((enemy) => enemy.alive)).toHaveLength(1);
    expect(snapshot.status).toBe("active");
  });

  it("never keep more than maxAlive of their own tanks on the field", () => {
    const simulation = new BattleSimulation(spawnerLevel, createInitialSave());
    // Retreat input is irrelevant: the player just sits and absorbs fire long enough.
    const durationMs =
      battleConfig.spawner.firstSpawnDelayMs + battleConfig.spawner.spawnIntervalMs * (battleConfig.spawner.maxAlive + 1);

    for (let elapsed = 0; elapsed < durationMs && simulation.getSnapshot().status === "active"; elapsed += 16) {
      simulation.advance(16, idle);
      expect(simulation.getSnapshot().enemies.filter((enemy) => enemy.alive).length).toBeLessThanOrEqual(
        battleConfig.spawner.maxAlive,
      );
    }
  });

  it("stay idle while the player is out of range", () => {
    const farLevel: BattleLevelData = {
      ...spawnerLevel,
      spawners: [{ ...spawnerLevel.spawners![0], x: 120 + battleConfig.spawner.activationRange + 200 }],
    };
    const simulation = new BattleSimulation(farLevel, createInitialSave());

    advanceFor(simulation, battleConfig.spawner.firstSpawnDelayMs + battleConfig.spawner.spawnIntervalMs);

    expect(simulation.getSnapshot().enemies).toHaveLength(0);
  });
});

describe("supply crates", () => {
  const supplyLevel: BattleLevelData = {
    id: "test-supply",
    name: "Supply Test",
    briefing: "",
    playerSpawn: { x: 120, y: 120 },
    enemySpawns: [{ id: "far-raider", x: 1400, y: 1400, archetype: "raider" }],
    indestructibleWalls: [],
    weakWalls: [],
    crates: [],
    supplyCrates: [{ id: "supply-freeze", x: 280, y: 88, width: 64, height: 64, maxHealth: 60, drop: "freeze" }],
    pickups: [],
  };

  it("drop their power-up when shot open, and freeze holds every enemy", () => {
    const simulation = new BattleSimulation(supplyLevel, createInitialSave());

    advanceFor(simulation, 900, { movementX: 0, movementY: 0, aim: { x: 312, y: 120 }, firing: true });

    let snapshot = simulation.getSnapshot();
    expect(snapshot.breakableObstacles.find((obstacle) => obstacle.id === "supply-freeze")).toBeUndefined();
    expect(snapshot.pickups.map((pickup) => pickup.kind)).toEqual(["freeze"]);

    advanceFor(simulation, 1200, { movementX: 1, movementY: 0, aim: { x: 400, y: 120 }, firing: false });

    snapshot = simulation.getSnapshot();
    expect(snapshot.pickups).toHaveLength(0);
    expect(snapshot.enemies[0].frozen).toBe(true);

    const frozenAt = { x: snapshot.enemies[0].x, y: snapshot.enemies[0].y };
    advanceFor(simulation, 1000);
    snapshot = simulation.getSnapshot();
    expect({ x: snapshot.enemies[0].x, y: snapshot.enemies[0].y }).toEqual(frozenAt);
  });
});

describe("enemy movement", () => {
  it("never moves a tank faster than its driving speed: no dashes", () => {
    const level: BattleLevelData = {
      id: "test-speed",
      name: "Speed Test",
      briefing: "",
      playerSpawn: { x: 160, y: 400 },
      enemySpawns: [
        { id: "speed-raider", x: 520, y: 300, archetype: "raider" },
        { id: "speed-skirmisher", x: 520, y: 500, archetype: "skirmisher" },
      ],
      indestructibleWalls: [],
      weakWalls: [],
      crates: [],
      pickups: [],
    };
    const simulation = new BattleSimulation(level, createInitialSave());
    const stepMs = 16;
    let previous = simulation.getSnapshot().enemies;

    for (let elapsed = 0; elapsed < 6000; elapsed += stepMs) {
      // The player keeps shooting at the raider, which is when a dodge would have fired.
      simulation.advance(stepMs, { movementX: 0, movementY: 0, aim: { x: previous[0].x, y: previous[0].y }, firing: true });
      const current = simulation.getSnapshot().enemies;

      current.forEach((enemy, index) => {
        const archetype = enemy.archetype ?? "raider";
        const maxStep = battleConfig.enemy.archetypes[archetype].moveSpeed * (stepMs / 1000);
        const moved = Math.hypot(enemy.x - previous[index].x, enemy.y - previous[index].y);
        expect(moved).toBeLessThanOrEqual(maxStep + 0.5);
      });
      previous = current;
    }
  });
});

describe("sound cues", () => {
  it("tags shots, hits and supply breaks with sounds", () => {
    const simulation = new BattleSimulation(
      {
        id: "test-sound",
        name: "Sound Test",
        briefing: "",
        playerSpawn: { x: 120, y: 120 },
        enemySpawns: [{ id: "far-raider", x: 1400, y: 1400, archetype: "raider" }],
        indestructibleWalls: [],
        weakWalls: [],
        crates: [],
        supplyCrates: [{ id: "supply-repair", x: 280, y: 88, width: 64, height: 64, maxHealth: 60, drop: "repair" }],
        pickups: [],
      },
      createInitialSave(),
    );
    const sounds = new Set<string>();

    for (let elapsed = 0; elapsed < 900; elapsed += 16) {
      const result = simulation.advance(16, { movementX: 0, movementY: 0, aim: { x: 312, y: 120 }, firing: true });
      result.effects.forEach((effect) => effect.sound && sounds.add(effect.sound));
    }

    expect(sounds).toContain("playerShot");
    expect(sounds).toContain("hitCrate");
    expect(sounds).toContain("crateBreak");
  });
});

describe("crates hide power-ups", () => {
  it("about a third of plain crates across the campaign hold one, gold crates never", () => {
    const plain = battleLevelOrder.flatMap((level) => level.crates.filter((crate) => !crate.rewardCredits));
    const gold = battleLevelOrder.flatMap((level) => level.crates.filter((crate) => crate.rewardCredits));
    const drops = plain.map(hiddenCrateDrop).filter((drop) => drop !== null);

    expect(drops.length / plain.length).toBeGreaterThan(0.2);
    expect(drops.length / plain.length).toBeLessThan(0.5);
    expect(new Set(drops)).toEqual(new Set(["repair", "rapidFire", "freeze"]));
    expect(gold.map(hiddenCrateDrop).every((drop) => drop === null)).toBe(true);
  });
});

describe("cannons", () => {
  const range: BattleLevelData = {
    id: "test-range",
    name: "Range",
    briefing: "",
    playerSpawn: { x: 200, y: 400 },
    // A far-off enemy keeps the battle running.
    enemySpawns: [{ id: "far-raider", x: 1400, y: 1400, archetype: "raider" }],
    indestructibleWalls: [{ x: 600, y: 0, width: 64, height: 800 }],
    weakWalls: [],
    crates: [],
    pickups: [],
  };

  function armed(level: BattleLevelData, weapon: "ricochet" | "laser" | "scattergun") {
    const save = createInitialSave();
    save.unlockedWeapons = ["cannon", weapon];
    const simulation = new BattleSimulation(level, save);
    simulation.selectWeapon(1);
    return simulation;
  }

  it("ricochet shells bounce back off walls; plain shells stop", () => {
    const simulation = armed(range, "ricochet");
    // Turn the turret onto the target first.
    advanceFor(simulation, 400, { movementX: 0, movementY: 0, aim: { x: 700, y: 400 }, firing: false });
    simulation.advance(16, { movementX: 0, movementY: 0, aim: { x: 700, y: 400 }, firing: true });
    advanceFor(simulation, 900);

    const shell = simulation.getSnapshot().projectiles[0];
    expect(shell.kind).toBe("ricochet");
    // Flew right into the wall, now heading back left.
    expect(Math.abs(shell.rotation)).toBeGreaterThan(Math.PI / 2);
  });

  it("laser bolts pierce through a line of tanks", () => {
    const line: BattleLevelData = {
      ...range,
      indestructibleWalls: [],
      enemySpawns: [
        { id: "line-1", x: 400, y: 400, archetype: "raider" },
        { id: "line-2", x: 520, y: 400, archetype: "raider" },
        { id: "line-3", x: 640, y: 400, archetype: "raider" },
      ],
    };
    const simulation = armed(line, "laser");
    // Hold the line still, as a freeze power-up would.
    (simulation as unknown as { state: { freezeRemainingMs: number } }).state.freezeRemainingMs = 10000;
    // Turn the turret onto the target first.
    advanceFor(simulation, 400, { movementX: 0, movementY: 0, aim: { x: 900, y: 400 }, firing: false });
    simulation.advance(16, { movementX: 0, movementY: 0, aim: { x: 900, y: 400 }, firing: true });
    advanceFor(simulation, 300);

    const damaged = simulation.getSnapshot().enemies.filter((enemy) => enemy.health < enemy.maxHealth);
    expect(damaged).toHaveLength(3);
  });

  it("the scattergun fires a fan of pellets, and switching shows in the snapshot", () => {
    const simulation = armed(range, "scattergun");
    // Turn the turret onto the target first.
    advanceFor(simulation, 400, { movementX: 0, movementY: 0, aim: { x: 500, y: 400 }, firing: false });
    simulation.advance(16, { movementX: 0, movementY: 0, aim: { x: 500, y: 400 }, firing: true });

    const snapshot = simulation.getSnapshot();
    expect(snapshot.player.weapon).toBe("scattergun");
    expect(snapshot.projectiles).toHaveLength(battleConfig.weapons.scattergun.shotCount);
    expect(simulation.getHudSnapshot().weapons.map((slot) => slot.active)).toEqual([false, true]);
  });
});
