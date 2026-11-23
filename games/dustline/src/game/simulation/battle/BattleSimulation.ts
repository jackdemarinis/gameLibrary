import { battleConfig } from "../../config/battleConfig";
import type { BattleLevelData } from "../../content/levelTypes";
import { gameConfig } from "../../config/gameConfig";
import type { SaveData } from "../state";
import { createNavGrid } from "./navigation";
import { buildBattleHudSnapshot } from "./systems/hudSystem";
import { createBreakableObstacles, rebuildObstacleRects } from "./systems/destructibleSystem";
import { runEnemyLogicSystem } from "./systems/enemyLogicSystem";
import { runSpawnerSystem } from "./systems/spawnerSystem";
import { runTankCollisionSystem } from "./systems/tankCollisionSystem";
import { createEnemyTank } from "./enemyFactory";
import { applyWeaponToTank, buildPlayerLoadout, selectPlayerWeapon } from "./playerWeapons";
import { runPickupSystem } from "./systems/pickupSystem";
import { runPlayerControlSystem } from "./systems/playerControlSystem";
import { runProjectileSystem } from "./systems/projectileSystem";
import {
  createBattleVisibilitySnapshot,
  createBattleVisibilityState,
  refreshBattleVisibility,
} from "./visibility";
import type {
  BattleAdvanceResult,
  BattleInput,
  BattleResultSummary,
  BattleSnapshot,
  BattleState,
  BreakableObstacleSnapshot,
  PickupState,
  SimulationEffect,
  TankSnapshot,
  TankState,
} from "./types";

export class BattleSimulation {
  private readonly state: BattleState;
  private accumulatorMs = 0;
  private readonly pendingEffects: SimulationEffect[] = [];

  constructor(level: BattleLevelData, save: SaveData) {
    this.state = createBattleState(level, save);
  }

  getSnapshot(): BattleSnapshot {
    return createBattleSnapshot(this.state);
  }

  getHudSnapshot() {
    return buildBattleHudSnapshot(this.state);
  }

  getResultSummary(): BattleResultSummary {
    return createBattleResultSummary(this.state);
  }

  /** Switch to inventory slot `index` (0-based). Its click sound comes out with the next advance. */
  selectWeapon(index: number): void {
    this.pendingEffects.push(...selectPlayerWeapon(this.state, index));
  }

  /** Scroll through the inventory: +1 next cannon, -1 previous, wrapping around. */
  cycleWeapon(direction: 1 | -1): void {
    const count = this.state.playerLoadout.length;
    if (count > 1) {
      this.selectWeapon((this.state.activeWeaponIndex + direction + count) % count);
    }
  }

  advance(deltaMs: number, input: BattleInput): BattleAdvanceResult {
    const cappedDelta = Math.min(deltaMs, battleConfig.world.maxSimulationDeltaMs);
    this.accumulatorMs += cappedDelta;
    const effects: SimulationEffect[] = this.pendingEffects.splice(0);

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
    this.state.rapidFireRemainingMs = Math.max(0, this.state.rapidFireRemainingMs - deltaMs);
    this.state.freezeRemainingMs = Math.max(0, this.state.freezeRemainingMs - deltaMs);
    tickCooldowns(this.state, deltaMs);

    if (this.state.status !== "lost") {
      effects.push(...runPlayerControlSystem(this.state, input, deltaSeconds));
    }

    if (this.state.status === "active") {
      effects.push(...runEnemyLogicSystem(this.state, deltaMs));
      effects.push(...runSpawnerSystem(this.state, deltaMs));
    }

    if (this.state.status !== "lost") {
      runTankCollisionSystem(this.state);
    }

    if (this.state.status !== "lost") {
      effects.push(...runProjectileSystem(this.state, deltaSeconds));
    }

    if (this.state.status !== "lost") {
      effects.push(...runPickupSystem(this.state));
    }

    if (this.state.status !== "lost") {
      refreshBattleVisibility(this.state.visibility, this.state.player.position, this.state.obstacles);
    }

    resolveBattleStatus(this.state);
    return effects;
  }
}

function createBattleState(level: BattleLevelData, save: SaveData): BattleState {
  const breakableObstacles = createBreakableObstacles(level);
  const playerUpgrades = save.upgrades;
  const difficultyTuning = battleConfig.difficulty[save.difficulty];
  const playerLoadout = buildPlayerLoadout(save);
  const playerMaxHealth =
    battleConfig.player.maxHealth +
    playerUpgrades.maxHealth * battleConfig.upgrades.maxHealthPerLevel;
  const player: TankState = {
    id: "player",
    faction: "player",
    archetype: null,
    position: { ...level.playerSpawn },
    hullRotation: 0,
    turretRotation: 0,
    radius: battleConfig.player.radius,
    health: playerMaxHealth,
    maxHealth: playerMaxHealth,
    moveSpeed:
      battleConfig.player.moveSpeed +
      playerUpgrades.movementSpeed * battleConfig.upgrades.movementSpeedPerLevel,
    turretTurnSpeed:
      battleConfig.player.turretTurnSpeedRadiansPerSecond +
      playerUpgrades.turretRotationSpeed * battleConfig.upgrades.turretRotationSpeedPerLevel,
    // Weapon fields are filled in from the first cannon by applyWeaponToTank below.
    weapon: "cannon",
    fireCooldownMs: 0,
    fireCooldownRemainingMs: 0,
    shotCount: 1,
    spreadRadians: 0,
    aimJitterRadians: 0,
    projectileRangePx: 0,
    projectileRadius: 0,
    projectileBounces: 0,
    projectilePierce: 0,
    navWaypoint: null,
    navRefreshMs: 0,
    projectileSpeed: 0,
    projectileDamage: 0,
    muzzleOffset: battleConfig.player.muzzleOffset,
    recoilKick: 0,
    recoilRecoveryPerSecond: battleConfig.player.recoilRecoveryPerSecond,
    recoilOffset: 0,
    recentDamageMs: 0,
    rewardCredits: 0,
    rewardScore: 0,
    sightRange: 0,
    nearbyRange: 0,
    preferredRange: 0,
    engageRange: 0,
    aimInaccuracyRadians: 0,
    repositionDistance: 0,
    patrolPoints: [],
    aiState: null,
    aiStateElapsedMs: 0,
    patrolIndex: 0,
    lastKnownPlayerPosition: null,
    repositionTarget: null,
    behaviorSeed: 0,
    strafeLeg: 0,
    strafeLegEndMs: 0,
    alive: true,
  };
  applyWeaponToTank(player, playerLoadout[0]);

  const worldWidth = level.width ?? gameConfig.worldWidth;
  const worldHeight = level.height ?? gameConfig.worldHeight;
  const visibilityRadiusTiles =
    battleConfig.visibility.radiusTiles +
    playerUpgrades.visibilityRadius * battleConfig.upgrades.visibilityRadiusTilesPerLevel;
  const state: BattleState = {
    level,
    worldWidth,
    worldHeight,
    navGrid: createNavGrid(worldWidth, worldHeight, battleConfig.visibility.tileSize, []),
    rapidFireRemainingMs: 0,
    obstacles: [],
    breakableObstacles,
    visibility: createBattleVisibilityState(player.position, [], {
      radiusTiles: visibilityRadiusTiles,
      worldWidth,
      worldHeight,
    }),
    player,
    playerLoadout,
    activeWeaponIndex: 0,
    enemies: level.enemySpawns.map((spawn) =>
      createEnemyTank(
        spawn.id,
        spawn.x,
        spawn.y,
        spawn.archetype,
        spawn.patrol ?? [],
        difficultyTuning,
      ),
    ),
    projectiles: [],
    pickups: createInitialPickups(level),
    credits: save.credits,
    startingCredits: save.credits,
    creditsEarned: 0,
    totalScore: save.totalScore,
    startingTotalScore: save.totalScore,
    pointsEarned: 0,
    damageTaken: 0,
    elapsedMs: 0,
    status: "active",
    nextProjectileId: 0,
    nextPickupId: 0,
    freezeRemainingMs: 0,
    nextSpawnId: 0,
    difficulty: difficultyTuning,
  };

  rebuildObstacleRects(state);
  state.visibility = createBattleVisibilityState(player.position, state.obstacles, {
    radiusTiles: visibilityRadiusTiles,
    worldWidth,
    worldHeight,
  });
  return state;
}

function tickCooldowns(state: BattleState, deltaMs: number): void {
  const tanks = [state.player, ...state.enemies];

  tanks.forEach((tank) => {
    tank.fireCooldownRemainingMs = Math.max(0, tank.fireCooldownRemainingMs - deltaMs);
    tank.recoilOffset = Math.max(0, tank.recoilOffset - tank.recoilRecoveryPerSecond * (deltaMs / 1000));
    tank.recentDamageMs = Math.max(0, tank.recentDamageMs - deltaMs);
  });
}

function resolveBattleStatus(state: BattleState): void {
  if (!state.player.alive) {
    state.status = "lost";
    return;
  }

  const enemiesRemaining = state.enemies.some((enemy) => enemy.alive);
  const spawnersRemaining = state.breakableObstacles.some(
    (obstacle) => obstacle.kind === "spawner" && obstacle.alive,
  );

  if (!enemiesRemaining && !spawnersRemaining && state.status === "active") {
    state.status = "won";
    state.projectiles = state.projectiles.filter((projectile) => projectile.faction === "player");
  }
}

function createBattleSnapshot(state: BattleState): BattleSnapshot {
  return {
    status: state.status,
    visibility: createBattleVisibilitySnapshot(state.visibility),
    player: createTankSnapshot(state.player, false),
    enemies: state.enemies.map((enemy) => createTankSnapshot(enemy, state.freezeRemainingMs > 0)),
    projectiles: state.projectiles.map((projectile) => ({
      id: projectile.id,
      faction: projectile.faction,
      kind: projectile.kind,
      x: projectile.position.x,
      y: projectile.position.y,
      rotation: Math.atan2(projectile.velocity.y, projectile.velocity.x),
      radius: projectile.radius,
    })),
    pickups: state.pickups.map((pickup) => ({
      id: pickup.id,
      x: pickup.position.x,
      y: pickup.position.y,
      radius: pickup.radius,
      kind: pickup.kind,
    })),
    worldWidth: state.worldWidth,
    worldHeight: state.worldHeight,
    indestructibleWalls: state.level.indestructibleWalls,
    breakableObstacles: state.breakableObstacles
      .filter((obstacle) => obstacle.alive)
      .map(createBreakableObstacleSnapshot),
    credits: state.credits,
    totalScore: state.totalScore,
    elapsedMs: state.elapsedMs,
  };
}

function createTankSnapshot(tank: TankState, frozen: boolean): TankSnapshot {
  return {
    id: tank.id,
    faction: tank.faction,
    archetype: tank.archetype,
    x: tank.position.x,
    y: tank.position.y,
    hullRotation: tank.hullRotation,
    turretRotation: tank.turretRotation,
    health: tank.health,
    maxHealth: tank.maxHealth,
    recoilOffset: tank.recoilOffset,
    weapon: tank.weapon,
    showHealthBar: tank.faction === "enemy" && tank.recentDamageMs > 0 && tank.health < tank.maxHealth,
    frozen: frozen && tank.faction === "enemy",
    aiState: tank.aiState,
    alive: tank.alive,
  };
}

function createBreakableObstacleSnapshot(obstacle: BattleState["breakableObstacles"][number]): BreakableObstacleSnapshot {
  return {
    id: obstacle.id,
    kind: obstacle.kind,
    x: obstacle.rect.x,
    y: obstacle.rect.y,
    width: obstacle.rect.width,
    height: obstacle.rect.height,
    health: obstacle.health,
    maxHealth: obstacle.maxHealth,
    rewardCredits: obstacle.rewardCredits,
    drop: obstacle.drop,
  };
}

function createInitialPickups(level: BattleLevelData): PickupState[] {
  return level.pickups.map((pickup) => ({
    id: pickup.id,
    kind: pickup.kind,
    position: {
      x: pickup.x,
      y: pickup.y,
    },
    radius: pickup.radius ?? battleConfig.pickup.radius,
    value: pickup.value,
    scoreValue: pickup.kind === "coin" ? pickup.value : 50,
  }));
}

function createBattleResultSummary(state: BattleState): BattleResultSummary {
  return {
    status: state.status,
    levelId: state.level.id,
    levelName: state.level.name,
    creditsEarned: state.creditsEarned,
    pointsEarned: state.pointsEarned,
    totalScore: state.totalScore,
    damageTaken: state.damageTaken,
    completionTimeMs: state.elapsedMs,
  };
}
