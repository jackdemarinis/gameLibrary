import { battleConfig } from "../../../config/battleConfig";
import {
  distanceBetween,
  moveCircleWithCollisionsDetailed,
  normalizeVector,
  rotationFromVector,
} from "../geometry";
import { hasLineOfSight } from "../vision";
import type {
  BattleState,
  EnemyAiStateName,
  SimulationEffect,
  TankState,
  Vector2,
} from "../types";
import { findNextWaypoint } from "../navigation";
import { spawnProjectile } from "./projectileSystem";

const navRefreshIntervalMs = 280;
/** Slow, heavy tanks back off instead of circling. */
const holdsGround = (enemy: TankState): boolean =>
  enemy.archetype === "bulwark" || enemy.archetype === "lancer" || enemy.archetype === "warden";

export function runEnemyLogicSystem(state: BattleState, deltaMs: number): SimulationEffect[] {
  const player = state.player;
  const effects: SimulationEffect[] = [];

  // A freeze power-up holds every enemy in place: no moving, aiming or firing.
  if (!player.alive || state.freezeRemainingMs > 0) {
    return effects;
  }

  state.enemies.forEach((enemy) => {
    if (!enemy.alive || enemy.aiState === null) {
      return;
    }

    enemy.aiStateElapsedMs += deltaMs;

    const perception = getEnemyPerception(enemy, player, state.obstacles);

    if (perception.detectsPlayer) {
      enemy.lastKnownPlayerPosition = { ...player.position };
    }

    updateEnemyState(enemy, perception);
    updateEnemyAim(enemy, player, perception, state.elapsedMs);

    const moveTarget = chooseMovementTarget(enemy, player, perception, state.elapsedMs);

    if (moveTarget) {
      const steerTarget = routeAroundWalls(state, enemy, moveTarget, deltaMs);
      moveEnemyTowards(enemy, steerTarget, deltaMs / 1000, state.obstacles);
    } else {
      enemy.navWaypoint = null;
    }

    if (
      enemy.fireCooldownRemainingMs <= 0 &&
      perception.distance <= enemy.engageRange &&
      (perception.hasLineOfSight || perception.isNearby)
    ) {
      effects.push(...spawnProjectile(state, enemy, computeEnemyAimOffset(enemy, state.elapsedMs)));
    }
  });

  return effects;
}

/**
 * Direct line to the target: drive straight at it. Otherwise follow the grid
 * path one cell at a time, so enemies can find their way through doorways.
 */
function routeAroundWalls(state: BattleState, enemy: TankState, target: Vector2, deltaMs: number): Vector2 {
  if (hasLineOfSight(enemy.position, target, state.obstacles)) {
    enemy.navWaypoint = null;
    return target;
  }

  enemy.navRefreshMs -= deltaMs;
  const reachedWaypoint =
    enemy.navWaypoint !== null && distanceBetween(enemy.position, enemy.navWaypoint) <= 10;
  if (enemy.navWaypoint === null || reachedWaypoint || enemy.navRefreshMs <= 0) {
    enemy.navWaypoint = findNextWaypoint(state.navGrid, enemy.position, target);
    enemy.navRefreshMs = navRefreshIntervalMs;
  }
  return enemy.navWaypoint ?? target;
}

interface EnemyPerception {
  distance: number;
  hasLineOfSight: boolean;
  isNearby: boolean;
  detectsPlayer: boolean;
}

function getEnemyPerception(
  enemy: TankState,
  player: TankState,
  obstacles: readonly { x: number; y: number; width: number; height: number }[],
): EnemyPerception {
  const distance = distanceBetween(enemy.position, player.position);
  const hasSight =
    distance <= enemy.sightRange && hasLineOfSight(enemy.position, player.position, obstacles);
  const isNearby = distance <= enemy.nearbyRange;

  return {
    distance,
    hasLineOfSight: hasSight,
    isNearby,
    detectsPlayer: hasSight || isNearby,
  };
}

function updateEnemyState(enemy: TankState, perception: EnemyPerception): void {
  if (perception.detectsPlayer) {
    if (
      enemy.aiState === "engage" &&
      shouldStartReposition(enemy, perception)
    ) {
      const repositionTarget = buildRepositionTarget(enemy);

      if (repositionTarget) {
        enemy.repositionTarget = repositionTarget;
        setEnemyState(enemy, "reposition");
        return;
      }
    }

    if (enemy.aiState !== "reposition") {
      setEnemyState(enemy, "engage");
    }
    return;
  }

  if (enemy.lastKnownPlayerPosition) {
    if (enemy.aiState !== "investigate") {
      setEnemyState(enemy, "investigate");
      return;
    }

    if (enemy.aiStateElapsedMs >= battleConfig.enemy.investigateDurationMs) {
      enemy.lastKnownPlayerPosition = null;
      enemy.repositionTarget = null;
      setEnemyState(enemy, enemy.patrolPoints.length > 0 ? "patrol" : "idle");
    }
    return;
  }

  if (enemy.patrolPoints.length > 0) {
    setEnemyState(enemy, "patrol");
    return;
  }

  setEnemyState(enemy, "idle");
}

function chooseMovementTarget(
  enemy: TankState,
  player: TankState,
  perception: EnemyPerception,
  elapsedMs: number,
): Vector2 | null {
  switch (enemy.aiState) {
    case "patrol":
      return getCurrentPatrolPoint(enemy);
    case "investigate":
      if (!enemy.lastKnownPlayerPosition) {
        return enemy.patrolPoints.length > 0 ? getCurrentPatrolPoint(enemy) : null;
      }

      if (
        distanceBetween(enemy.position, enemy.lastKnownPlayerPosition) <=
        battleConfig.enemy.investigateArrivalRadius
      ) {
        enemy.lastKnownPlayerPosition = null;
        setEnemyState(enemy, enemy.patrolPoints.length > 0 ? "patrol" : "idle");
        return enemy.patrolPoints.length > 0 ? getCurrentPatrolPoint(enemy) : null;
      }

      return enemy.lastKnownPlayerPosition;
    case "reposition":
      if (!enemy.repositionTarget) {
        setEnemyState(enemy, "engage");
        return null;
      }

      if (
        enemy.aiStateElapsedMs >= battleConfig.enemy.repositionDurationMs ||
        distanceBetween(enemy.position, enemy.repositionTarget) <= battleConfig.enemy.repositionArrivalRadius
      ) {
        enemy.repositionTarget = null;
        setEnemyState(enemy, "engage");
        return null;
      }

      return enemy.repositionTarget;
    case "engage":
      if (!perception.detectsPlayer && enemy.lastKnownPlayerPosition) {
        return enemy.lastKnownPlayerPosition;
      }

      return chooseEngageTarget(enemy, player, perception, elapsedMs);
    case "idle":
    default:
      return null;
  }
}

function chooseEngageTarget(
  enemy: TankState,
  player: TankState,
  perception: EnemyPerception,
  elapsedMs: number,
): Vector2 {
  const toPlayer = normalizeVector({
    x: player.position.x - enemy.position.x,
    y: player.position.y - enemy.position.y,
  });

  if (perception.distance > enemy.preferredRange + 52) {
    return { ...player.position };
  }

  if (perception.distance < enemy.preferredRange * 0.7) {
    return {
      x: enemy.position.x - toPlayer.x * enemy.repositionDistance,
      y: enemy.position.y - toPlayer.y * enemy.repositionDistance,
    };
  }

  if (enemy.archetype === "skirmisher" && perception.hasLineOfSight) {
    return buildLateralTarget(enemy, player.position, 1.08);
  }

  if (enemy.archetype === "raider" && !perception.hasLineOfSight) {
    return { ...player.position };
  }

  return buildStrafeTarget(enemy, toPlayer, perception.distance, elapsedMs);
}

/**
 * Keep moving around the player at preferred range, at normal driving speed.
 * Time is cut into legs of random length; each leg gets a random heading
 * (sideways one way or the other, swung forward or back by a random amount),
 * blended with a pull in or out to hold range. Seeded per tank, so it looks
 * random but replays the same way.
 */
function buildStrafeTarget(enemy: TankState, toPlayer: Vector2, distance: number, elapsedMs: number): Vector2 {
  const { lookAheadDistance, maxRangeCorrection, legLengthMin, legLengthMax, headingJitterRadians, switchMs } =
    battleConfig.enemy.strafe;
  const leg = advanceStrafeLeg(enemy, elapsedMs, switchMs[enemy.archetype ?? "raider"], legLengthMin, legLengthMax);
  const side = seededUnit(enemy.behaviorSeed, leg, 1) < 0.5 ? 1 : -1;
  const swing = (seededUnit(enemy.behaviorSeed, leg, 2) * 2 - 1) * headingJitterRadians;
  const sideways = { x: -toPlayer.y * side, y: toPlayer.x * side };
  const swung = {
    x: sideways.x * Math.cos(swing) - sideways.y * Math.sin(swing),
    y: sideways.x * Math.sin(swing) + sideways.y * Math.cos(swing),
  };
  const rangeCorrection = Math.max(
    -maxRangeCorrection,
    Math.min(maxRangeCorrection, (distance - enemy.preferredRange) / enemy.preferredRange),
  );
  const heading = normalizeVector({
    x: swung.x + toPlayer.x * rangeCorrection,
    y: swung.y + toPlayer.y * rangeCorrection,
  });

  return {
    x: enemy.position.x + heading.x * lookAheadDistance,
    y: enemy.position.y + heading.y * lookAheadDistance,
  };
}

/** Moves the tank onto a new random-length leg once the current one runs out. */
function advanceStrafeLeg(
  enemy: TankState,
  elapsedMs: number,
  baseMs: number,
  minFactor: number,
  maxFactor: number,
): number {
  while (enemy.strafeLegEndMs <= elapsedMs) {
    enemy.strafeLeg += 1;
    const lengthFactor = minFactor + seededUnit(enemy.behaviorSeed, enemy.strafeLeg, 0) * (maxFactor - minFactor);
    enemy.strafeLegEndMs = Math.max(enemy.strafeLegEndMs, elapsedMs) + baseMs * lengthFactor;
  }

  return enemy.strafeLeg;
}

/** Deterministic 0..1 noise from a tank's seed, a leg number and a channel. */
function seededUnit(seed: number, leg: number, channel: number): number {
  let value = Math.imul(seed | 0, 2654435761 | 0) ^ Math.imul(leg + 1, 2246822519 | 0) ^ Math.imul(channel + 7, 3266489917 | 0);
  value = Math.imul(value ^ (value >>> 15), 2246822507 | 0);
  value = Math.imul(value ^ (value >>> 13), 3266489909 | 0);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

function moveEnemyTowards(
  enemy: TankState,
  target: Vector2,
  deltaSeconds: number,
  obstacles: readonly { x: number; y: number; width: number; height: number }[],
): void {
  const direction = normalizeVector({
    x: target.x - enemy.position.x,
    y: target.y - enemy.position.y,
  });

  if (direction.x === 0 && direction.y === 0) {
    if (enemy.aiState === "patrol" && enemy.patrolPoints.length > 0) {
      enemy.patrolIndex = (enemy.patrolIndex + 1) % enemy.patrolPoints.length;
    }
    return;
  }

  const movement = chooseEnemyMoveDirection(
    enemy.position,
    target,
    direction,
    enemy.moveSpeed * deltaSeconds,
    enemy.radius,
    obstacles,
  );

  if (!movement) {
    if (enemy.aiState === "reposition") {
      enemy.repositionTarget = buildRepositionTarget(enemy);
    }
    return;
  }

  enemy.position = movement.position;
  enemy.hullRotation = rotationFromVector(movement.heading);

  if (
    enemy.aiState === "patrol" &&
    enemy.patrolPoints.length > 0 &&
    distanceBetween(enemy.position, getCurrentPatrolPoint(enemy)) <= battleConfig.enemy.patrolArrivalRadius
  ) {
    enemy.patrolIndex = (enemy.patrolIndex + 1) % enemy.patrolPoints.length;
  }
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
      (startDistance - distanceAfterMove) * 2.3 +
      travelDistance * 0.14 -
      (result.blocked ? 0.45 : 0);

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
  const lateral = { x: -direction.y, y: direction.x };
  const seen = new Set<string>();

  return [
    direction,
    normalizeVector({ x: xTowardTarget, y: 0 }),
    normalizeVector({ x: 0, y: yTowardTarget }),
    normalizeVector({ x: direction.x, y: yTowardTarget }),
    normalizeVector({ x: xTowardTarget, y: direction.y }),
    normalizeVector(lateral),
    normalizeVector({ x: -lateral.x, y: -lateral.y }),
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

function updateEnemyAim(
  enemy: TankState,
  player: TankState,
  perception: EnemyPerception,
  elapsedMs: number,
): void {
  const baseTarget = perception.detectsPlayer
    ? player.position
    : enemy.lastKnownPlayerPosition ?? player.position;
  const aimVector = {
    x: baseTarget.x - enemy.position.x,
    y: baseTarget.y - enemy.position.y,
  };

  if (aimVector.x === 0 && aimVector.y === 0) {
    return;
  }

  const offset = perception.hasLineOfSight
    ? computeEnemyAimOffset(enemy, elapsedMs) * 0.35
    : computeEnemyAimOffset(enemy, elapsedMs) * 0.85;
  enemy.turretRotation = rotationFromVector(aimVector) + offset;
}

function shouldStartReposition(enemy: TankState, perception: EnemyPerception): boolean {
  if (!perception.hasLineOfSight) {
    return true;
  }

  if (holdsGround(enemy)) {
    return perception.distance < enemy.preferredRange * 0.58;
  }

  if (enemy.archetype === "skirmisher") {
    return enemy.aiStateElapsedMs >= 900 || perception.distance < enemy.preferredRange * 0.9;
  }

  return perception.distance < enemy.preferredRange * 0.62;
}

function buildRepositionTarget(enemy: TankState): Vector2 | null {
  const target = enemy.lastKnownPlayerPosition;

  if (!target) {
    return null;
  }

  return holdsGround(enemy)
    ? {
        x: enemy.position.x - normalizeVector({
          x: target.x - enemy.position.x,
          y: target.y - enemy.position.y,
        }).x * enemy.repositionDistance,
        y: enemy.position.y - normalizeVector({
          x: target.x - enemy.position.x,
          y: target.y - enemy.position.y,
        }).y * enemy.repositionDistance,
      }
    : buildLateralTarget(enemy, target, 1);
}

function buildLateralTarget(enemy: TankState, target: Vector2, multiplier: number): Vector2 {
  const toPlayer = normalizeVector({
    x: target.x - enemy.position.x,
    y: target.y - enemy.position.y,
  });
  const side = enemy.behaviorSeed % 2 === 0 ? 1 : -1;
  const lateral = {
    x: -toPlayer.y * side,
    y: toPlayer.x * side,
  };

  return {
    x: target.x + lateral.x * enemy.repositionDistance * multiplier - toPlayer.x * enemy.preferredRange * 0.22,
    y: target.y + lateral.y * enemy.repositionDistance * multiplier - toPlayer.y * enemy.preferredRange * 0.22,
  };
}

function computeEnemyAimOffset(enemy: TankState, elapsedMs: number): number {
  return Math.sin(elapsedMs / 320 + enemy.behaviorSeed * 0.013) * enemy.aimInaccuracyRadians;
}

function setEnemyState(enemy: TankState, state: EnemyAiStateName): void {
  if (enemy.aiState === state) {
    return;
  }

  enemy.aiState = state;
  enemy.aiStateElapsedMs = 0;

  if (state !== "reposition") {
    enemy.repositionTarget = null;
  }
}

function getCurrentPatrolPoint(enemy: TankState): Vector2 {
  return enemy.patrolPoints[enemy.patrolIndex] ?? enemy.position;
}
