import { battleConfig } from "../../../config/battleConfig";
import {
  distanceBetween,
  moveCircleWithCollisionsDetailed,
  normalizeVector,
  rotationFromVector,
} from "../geometry";
import type { BattleState, SimulationEffect, Vector2 } from "../types";
import { spawnProjectile } from "./projectileSystem";

export function runEnemyLogicSystem(state: BattleState, deltaSeconds: number): SimulationEffect[] {
  const player = state.player;

  if (!player.alive) {
    return [];
  }

  state.enemies.forEach((enemy) => {
    if (!enemy.alive) {
      return;
    }

    const toPlayer = {
      x: player.position.x - enemy.position.x,
      y: player.position.y - enemy.position.y,
    };
    const distance = distanceBetween(enemy.position, player.position);

    enemy.turretRotation = rotationFromVector(toPlayer);

    if (distance > battleConfig.enemy.preferredRange && distance < battleConfig.enemy.aggroRange) {
      const direction = normalizeVector(toPlayer);
      const movement = chooseEnemyMoveDirection(
        enemy.position,
        player.position,
        direction,
        enemy.moveSpeed * deltaSeconds,
        enemy.radius,
        state.obstacles,
      );

      if (movement) {
        enemy.position = movement.position;
        enemy.hullRotation = rotationFromVector(movement.heading);
      } else {
        enemy.hullRotation = enemy.turretRotation;
      }
    } else {
      enemy.hullRotation = enemy.turretRotation;
    }

    if (distance < battleConfig.enemy.aggroRange && enemy.fireCooldownRemainingMs <= 0 && state.status === "active") {
      spawnProjectile(state, enemy);
    }
  });

  return [];
}

interface EnemyMoveChoice {
  position: Vector2;
  heading: Vector2;
  score: number;
}

function chooseEnemyMoveDirection(
  start: Vector2,
  target: Vector2,
  direction: Vector2,
  stepDistance: number,
  radius: number,
  obstacles: readonly { x: number; y: number; width: number; height: number }[],
): EnemyMoveChoice | undefined {
  const candidates = buildEnemyMoveCandidates(target, start, direction);
  const startDistance = distanceBetween(start, target);
  let best: EnemyMoveChoice | undefined;

  candidates.forEach((candidate) => {
    const delta = {
      x: candidate.x * stepDistance,
      y: candidate.y * stepDistance,
    };
    const result = moveCircleWithCollisionsDetailed(start, delta, radius, obstacles);
    const travelVector = {
      x: result.position.x - start.x,
      y: result.position.y - start.y,
    };
    const travelDistance = Math.hypot(travelVector.x, travelVector.y);

    if (travelDistance <= 0.2) {
      return;
    }

    const distanceAfterMove = distanceBetween(result.position, target);
    const heading = normalizeVector(travelVector);
    const score =
      (startDistance - distanceAfterMove) * 2 +
      travelDistance * 0.12 -
      (result.blocked ? 0.35 : 0);

    if (!best || score > best.score) {
      best = {
        position: result.position,
        heading,
        score,
      };
    }
  });

  return best;
}

function buildEnemyMoveCandidates(target: Vector2, start: Vector2, direction: Vector2): Vector2[] {
  const toTarget = {
    x: target.x - start.x,
    y: target.y - start.y,
  };
  const xTowardTarget = Math.sign(toTarget.x);
  const yTowardTarget = Math.sign(toTarget.y);
  const seen = new Set<string>();

  return [
    direction,
    normalizeVector({ x: xTowardTarget, y: 0 }),
    normalizeVector({ x: 0, y: yTowardTarget }),
    normalizeVector({ x: direction.x, y: yTowardTarget }),
    normalizeVector({ x: xTowardTarget, y: direction.y }),
  ].filter((candidate) => {
    if (candidate.x === 0 && candidate.y === 0) {
      return false;
    }

    const key = `${candidate.x.toFixed(3)}:${candidate.y.toFixed(3)}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
