import { battleConfig } from "../../config/battleConfig";
import type { BattleLevelData } from "../../content/levelTypes";
import type { SaveData } from "../state";
import { buildBattleHudSnapshot } from "./systems/hudSystem";
import { runEnemyLogicSystem } from "./systems/enemyLogicSystem";
import { runPickupSystem } from "./systems/pickupSystem";
import { runPlayerControlSystem } from "./systems/playerControlSystem";
import { runProjectileSystem } from "./systems/projectileSystem";
import type {
  BattleAdvanceResult,
  BattleInput,
  BattleSnapshot,
  BattleState,
  SimulationEffect,
  TankSnapshot,
  TankState,
} from "./types";

export class BattleSimulation {
  private readonly state: BattleState;
  private accumulatorMs = 0;

  constructor(level: BattleLevelData, save: SaveData) {
    this.state = createBattleState(level, save);
  }

  getSnapshot(): BattleSnapshot {
    return createBattleSnapshot(this.state);
  }

  getHudSnapshot() {
    return buildBattleHudSnapshot(this.state);
  }

  advance(deltaMs: number, input: BattleInput): BattleAdvanceResult {
    const cappedDelta = Math.min(deltaMs, battleConfig.world.maxSimulationDeltaMs);
    this.accumulatorMs += cappedDelta;
    const effects: SimulationEffect[] = [];

    while (this.accumulatorMs >= battleConfig.fixedStepMs) {
      effects.push(...this.stepFixed(battleConfig.fixedStepMs, input));
      this.accumulatorMs -= battleConfig.fixedStepMs;
    }

    return {
      effects,
      snapshot: createBattleSnapshot(this.state),
      hud: buildBattleHudSnapshot(this.state),
    };
  }

  private stepFixed(deltaMs: number, input: BattleInput): SimulationEffect[] {
    const effects: SimulationEffect[] = [];
    const deltaSeconds = deltaMs / 1000;

    this.state.elapsedMs += deltaMs;
    tickCooldowns(this.state, deltaMs);

    if (this.state.status !== "lost") {
      effects.push(...runPlayerControlSystem(this.state, input, deltaSeconds));
    }

    if (this.state.status === "active") {
      effects.push(...runEnemyLogicSystem(this.state, deltaSeconds));
    }

    if (this.state.status !== "lost") {
      effects.push(...runProjectileSystem(this.state, deltaSeconds));
    }

    if (this.state.status !== "lost") {
      effects.push(...runPickupSystem(this.state));
    }

    resolveBattleStatus(this.state);
    return effects;
  }
}

function createBattleState(level: BattleLevelData, save: SaveData): BattleState {
  return {
    level,
    obstacles: [...level.walls, ...level.crates],
    player: {
      id: "player",
      faction: "player",
      position: { ...level.playerSpawn },
      hullRotation: 0,
      turretRotation: 0,
      radius: battleConfig.player.radius,
      health: battleConfig.player.maxHealth,
      maxHealth: battleConfig.player.maxHealth,
      moveSpeed: battleConfig.player.moveSpeed,
      fireCooldownMs: battleConfig.player.fireCooldownMs,
      fireCooldownRemainingMs: 0,
      projectileSpeed: battleConfig.player.projectileSpeed,
      projectileDamage: battleConfig.player.projectileDamage,
      muzzleOffset: battleConfig.player.muzzleOffset,
      rewardCredits: 0,
      alive: true,
    },
    enemies: level.enemySpawns.map((spawn) => ({
      id: spawn.id,
      faction: "enemy",
      position: { x: spawn.x, y: spawn.y },
      hullRotation: Math.PI,
      turretRotation: Math.PI,
      radius: battleConfig.enemy.radius,
      health: battleConfig.enemy.maxHealth,
      maxHealth: battleConfig.enemy.maxHealth,
      moveSpeed: battleConfig.enemy.moveSpeed,
      fireCooldownMs: battleConfig.enemy.fireCooldownMs,
      fireCooldownRemainingMs: 300,
      projectileSpeed: battleConfig.enemy.projectileSpeed,
      projectileDamage: battleConfig.enemy.projectileDamage,
      muzzleOffset: battleConfig.enemy.muzzleOffset,
      rewardCredits: battleConfig.pickup.coinValue,
      alive: true,
    })),
    projectiles: [],
    pickups: [],
    credits: save.credits,
    elapsedMs: 0,
    status: "active",
    nextProjectileId: 0,
    nextPickupId: 0,
  };
}

function tickCooldowns(state: BattleState, deltaMs: number): void {
  const tanks = [state.player, ...state.enemies];

  tanks.forEach((tank) => {
    tank.fireCooldownRemainingMs = Math.max(0, tank.fireCooldownRemainingMs - deltaMs);
  });
}

function resolveBattleStatus(state: BattleState): void {
  if (!state.player.alive) {
    state.status = "lost";
    return;
  }

  const enemiesRemaining = state.enemies.some((enemy) => enemy.alive);

  if (!enemiesRemaining && state.status === "active") {
    state.status = "won";
    state.projectiles = state.projectiles.filter((projectile) => projectile.faction === "player");
  }
}

function createBattleSnapshot(state: BattleState): BattleSnapshot {
  return {
    status: state.status,
    player: createTankSnapshot(state.player),
    enemies: state.enemies.map(createTankSnapshot),
    projectiles: state.projectiles.map((projectile) => ({
      id: projectile.id,
      faction: projectile.faction,
      x: projectile.position.x,
      y: projectile.position.y,
      radius: projectile.radius,
    })),
    pickups: state.pickups.map((pickup) => ({
      id: pickup.id,
      x: pickup.position.x,
      y: pickup.position.y,
      radius: pickup.radius,
      kind: pickup.kind,
    })),
    walls: state.level.walls,
    crates: state.level.crates,
    credits: state.credits,
    elapsedMs: state.elapsedMs,
  };
}

function createTankSnapshot(tank: TankState): TankSnapshot {
  return {
    id: tank.id,
    faction: tank.faction,
    x: tank.position.x,
    y: tank.position.y,
    hullRotation: tank.hullRotation,
    turretRotation: tank.turretRotation,
    health: tank.health,
    maxHealth: tank.maxHealth,
    alive: tank.alive,
  };
}
