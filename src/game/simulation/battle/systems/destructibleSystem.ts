import { battleConfig } from "../../../config/battleConfig";
import type { BattleLevelData, BreakableLayoutRect } from "../../../content/levelTypes";
import { circleIntersectsRect } from "../geometry";
import type {
  BattleState,
  BreakableObstacleKind,
  BreakableObstacleState,
  SimulationEffect,
  Vector2,
} from "../types";
import { refreshBattleVisibility } from "../visibility";

const CRATE_DEBRIS_COLOR = 0xcf8d3d;
const WEAK_WALL_DEBRIS_COLOR = 0x9c917a;

export function createBreakableObstacles(level: BattleLevelData): BreakableObstacleState[] {
  return [
    ...level.weakWalls.map((layout) => createBreakableObstacle("weakWall", layout)),
    ...level.crates.map((layout) => createBreakableObstacle("crate", layout)),
  ];
}

export function rebuildObstacleRects(state: BattleState): void {
  state.obstacles = [
    ...state.level.indestructibleWalls,
    ...state.breakableObstacles.filter((obstacle) => obstacle.alive).map((obstacle) => obstacle.rect),
  ];
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
  const effects: SimulationEffect[] = [
    {
      type: "explosion",
      x: center.x,
      y: center.y,
      color: obstacle.kind === "crate" ? CRATE_DEBRIS_COLOR : WEAK_WALL_DEBRIS_COLOR,
      size: obstacle.kind === "crate" ? 24 : 28,
      shakeDurationMs: obstacle.kind === "crate" ? 55 : 80,
      shakeIntensity: obstacle.kind === "crate" ? 0.0012 : 0.0018,
    },
    {
      type: "debris",
      x: center.x,
      y: center.y,
      color: obstacle.kind === "crate" ? CRATE_DEBRIS_COLOR : WEAK_WALL_DEBRIS_COLOR,
      size: obstacle.kind === "crate" ? 12 : 14,
      count: obstacle.kind === "crate" ? 6 : 8,
      lifetimeMs: obstacle.kind === "crate" ? 260 : 320,
    },
  ];

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

function createBreakableObstacle(
  kind: BreakableObstacleKind,
  layout: BreakableLayoutRect,
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
    rewardScore:
      kind === "crate"
        ? battleConfig.destructible.crateScore
        : battleConfig.destructible.weakWallScore,
    alive: true,
  };
}
