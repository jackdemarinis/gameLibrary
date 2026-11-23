import { battleConfig } from "../../../config/battleConfig";
import { createEnemyTank } from "../enemyFactory";
import { circleIntersectsRect, distanceBetween } from "../geometry";
import type { BattleState, BreakableObstacleState, SimulationEffect, Vector2 } from "../types";
import { getBreakableObstacleCenter } from "./destructibleSystem";

const spawnFlashColor = 0xe0573a;

/**
 * Spawners produce a tank every spawnIntervalMs while the player is within
 * activationRange, keeping at most maxAlive of their own tanks on the field.
 * New tanks roll out already hunting the player. Everything pauses during a freeze.
 */
export function runSpawnerSystem(state: BattleState, deltaMs: number): SimulationEffect[] {
  if (state.freezeRemainingMs > 0 || !state.player.alive) {
    return [];
  }

  const effects: SimulationEffect[] = [];
  const liveEnemyIds = new Set(state.enemies.filter((enemy) => enemy.alive).map((enemy) => enemy.id));

  state.breakableObstacles.forEach((obstacle) => {
    const spawner = obstacle.spawner;

    if (!obstacle.alive || !spawner || spawner.roster.length === 0) {
      return;
    }

    spawner.liveSpawnIds = spawner.liveSpawnIds.filter((id) => liveEnemyIds.has(id));
    const center = getBreakableObstacleCenter(obstacle);

    if (distanceBetween(center, state.player.position) > battleConfig.spawner.activationRange) {
      return;
    }

    spawner.cooldownMs -= deltaMs;

    if (spawner.cooldownMs > 0 || spawner.liveSpawnIds.length >= battleConfig.spawner.maxAlive) {
      return;
    }

    const archetype = spawner.roster[spawner.rosterIndex % spawner.roster.length];
    const radius = battleConfig.enemy.archetypes[archetype].radius;
    const spawnPoint = findSpawnPoint(state, obstacle, radius, spawner.rosterIndex);

    if (!spawnPoint) {
      // Boxed in: try again shortly rather than stacking tanks.
      spawner.cooldownMs = 400;
      return;
    }

    const id = `${obstacle.id}-spawn-${state.nextSpawnId}`;
    state.nextSpawnId += 1;
    const enemy = createEnemyTank(id, spawnPoint.x, spawnPoint.y, archetype, [], state.difficulty);
    enemy.rewardCredits = Math.round(enemy.rewardCredits * battleConfig.enemy.spawnedRewardMultiplier);
    enemy.rewardScore = Math.round(enemy.rewardScore * battleConfig.enemy.spawnedRewardMultiplier);
    enemy.lastKnownPlayerPosition = { ...state.player.position };
    enemy.aiState = "investigate";
    state.enemies.push(enemy);

    spawner.liveSpawnIds.push(id);
    spawner.rosterIndex += 1;
    spawner.cooldownMs = battleConfig.spawner.spawnIntervalMs;
    effects.push({ type: "explosion", x: spawnPoint.x, y: spawnPoint.y, color: spawnFlashColor, size: 26 });
  });

  return effects;
}

/** The first open cell around the spawner, starting from a rotating side. */
function findSpawnPoint(
  state: BattleState,
  obstacle: BreakableObstacleState,
  radius: number,
  rotation: number,
): Vector2 | null {
  const center = getBreakableObstacleCenter(obstacle);
  const stepX = obstacle.rect.width;
  const stepY = obstacle.rect.height;
  const offsets = [
    { x: 0, y: 1 },
    { x: 1, y: 0 },
    { x: 0, y: -1 },
    { x: -1, y: 0 },
    { x: 1, y: 1 },
    { x: -1, y: 1 },
    { x: 1, y: -1 },
    { x: -1, y: -1 },
  ];

  for (let index = 0; index < offsets.length; index += 1) {
    const offset = offsets[(index + rotation) % offsets.length];
    const point = { x: center.x + offset.x * stepX, y: center.y + offset.y * stepY };
    const insideWorld =
      point.x - radius >= 0 &&
      point.y - radius >= 0 &&
      point.x + radius <= state.worldWidth &&
      point.y + radius <= state.worldHeight;
    const blocked = state.obstacles.some((rect) => circleIntersectsRect(point, radius, rect));
    const occupied = [state.player, ...state.enemies].some(
      (tank) => tank.alive && distanceBetween(tank.position, point) < tank.radius + radius + 4,
    );

    if (insideWorld && !blocked && !occupied) {
      return point;
    }
  }

  return null;
}
