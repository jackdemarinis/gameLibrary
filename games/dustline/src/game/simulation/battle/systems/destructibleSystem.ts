import { battleConfig } from "../../../config/battleConfig";
import type { BattleLevelData, BreakableLayoutRect, SpawnerLayout, SupplyDrop } from "../../../content/levelTypes";
import { circleIntersectsRect } from "../geometry";
import type {
  BattleState,
  BreakableObstacleKind,
  BreakableObstacleState,
  SimulationEffect,
  Vector2,
} from "../types";
import { rebuildNavGrid } from "../navigation";
import { refreshBattleVisibility } from "../visibility";

const CRATE_DEBRIS_COLOR = 0xcf8d3d;
const WEAK_WALL_DEBRIS_COLOR = 0x9c917a;
const SPAWNER_DEBRIS_COLOR = 0xe0573a;

const debrisColor: Record<BreakableObstacleKind, number> = {
  crate: CRATE_DEBRIS_COLOR,
  supplyCrate: CRATE_DEBRIS_COLOR,
  weakWall: WEAK_WALL_DEBRIS_COLOR,
  spawner: SPAWNER_DEBRIS_COLOR,
};

export function createBreakableObstacles(level: BattleLevelData): BreakableObstacleState[] {
  return [
    ...level.weakWalls.map((layout) => createBreakableObstacle("weakWall", layout)),
    ...level.crates.map((layout) => createBreakableObstacle("crate", layout)),
    ...(level.supplyCrates ?? []).map((layout) =>
      createBreakableObstacle("supplyCrate", layout, layout.drop),
    ),
    ...(level.spawners ?? []).map((layout) => createSpawnerObstacle(layout)),
  ];
}

export function rebuildObstacleRects(state: BattleState): void {
  state.obstacles = [
    ...state.level.indestructibleWalls,
    ...state.breakableObstacles.filter((obstacle) => obstacle.alive).map((obstacle) => obstacle.rect),
  ];
  rebuildNavGrid(state.navGrid, state.obstacles);
}

export function findBreakableObstacleAtPoint(
  state: BattleState,
  point: Vector2,
  radius: number,
): BreakableObstacleState | undefined {
  return state.breakableObstacles.find(
    (obstacle) => obstacle.alive && circleIntersectsRect(point, radius, obstacle.rect),
  );
}

export function damageBreakableObstacle(
  state: BattleState,
  obstacle: BreakableObstacleState,
  amount: number,
): SimulationEffect[] {
  if (!obstacle.alive || amount <= 0) {
    return [];
  }

  obstacle.health = Math.max(0, obstacle.health - amount);

  if (obstacle.health > 0) {
    return [];
  }

  obstacle.alive = false;
  rebuildObstacleRects(state);
  refreshBattleVisibility(state.visibility, state.player.position, state.obstacles, true);

  const center = getBreakableObstacleCenter(obstacle);
  const isCrate = obstacle.kind === "crate" || obstacle.kind === "supplyCrate";
  const isSpawner = obstacle.kind === "spawner";
  const effects: SimulationEffect[] = [
    {
      type: "explosion",
      x: center.x,
      y: center.y,
      color: debrisColor[obstacle.kind],
      size: isSpawner ? 46 : isCrate ? 24 : 28,
      shakeDurationMs: isSpawner ? 220 : isCrate ? 55 : 80,
      shakeIntensity: isSpawner ? 0.005 : isCrate ? 0.0012 : 0.0018,
    },
    {
      type: "debris",
      x: center.x,
      y: center.y,
      color: debrisColor[obstacle.kind],
      size: isSpawner ? 16 : isCrate ? 12 : 14,
      count: isSpawner ? 14 : isCrate ? 6 : 8,
      lifetimeMs: isSpawner ? 480 : isCrate ? 260 : 320,
    },
  ];

  if (obstacle.drop) {
    state.pickups.push({
      id: `pickup-${state.nextPickupId}`,
      kind: obstacle.drop,
      position: center,
      radius: battleConfig.pickup.radius,
      value: 0,
      scoreValue: 50,
    });
    state.nextPickupId += 1;
  }

  if (obstacle.rewardCredits > 0) {
    state.pickups.push({
      id: `pickup-${state.nextPickupId}`,
      kind: "coin",
      position: center,
      radius: battleConfig.pickup.radius,
      value: obstacle.rewardCredits,
      scoreValue: obstacle.rewardCredits,
    });
    state.nextPickupId += 1;
  }

  state.pointsEarned += obstacle.rewardScore;
  state.totalScore += obstacle.rewardScore;

  return effects;
}

export function getBreakableObstacleCenter(obstacle: BreakableObstacleState): Vector2 {
  return {
    x: obstacle.rect.x + obstacle.rect.width / 2,
    y: obstacle.rect.y + obstacle.rect.height / 2,
  };
}

function createSpawnerObstacle(layout: SpawnerLayout): BreakableObstacleState {
  return {
    ...createBreakableObstacle("spawner", layout),
    spawner: {
      roster: [...layout.roster],
      rosterIndex: 0,
      cooldownMs: battleConfig.spawner.firstSpawnDelayMs,
      liveSpawnIds: [],
    },
  };
}

const rewardScoreByKind: Record<BreakableObstacleKind, number> = {
  crate: battleConfig.destructible.crateScore,
  supplyCrate: battleConfig.supplyCrate.rewardScore,
  weakWall: battleConfig.destructible.weakWallScore,
  spawner: battleConfig.spawner.rewardScore,
};

function createBreakableObstacle(
  kind: BreakableObstacleKind,
  layout: BreakableLayoutRect,
  drop: SupplyDrop | null = null,
): BreakableObstacleState {
  return {
    id: layout.id,
    kind,
    rect: {
      x: layout.x,
      y: layout.y,
      width: layout.width,
      height: layout.height,
    },
    health: layout.maxHealth,
    maxHealth: layout.maxHealth,
    rewardCredits: layout.rewardCredits ?? 0,
    rewardScore: rewardScoreByKind[kind],
    drop,
    spawner: null,
    alive: true,
  };
}
