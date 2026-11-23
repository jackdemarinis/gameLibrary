import { battleConfig } from "../../../config/battleConfig";
import {
  circleIntersectsRect,
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
import { cellCentre, findPath, openNeighbourCentres } from "../navigation";
import { spawnProjectile } from "./projectileSystem";

const navRefreshIntervalMs = 280;
/** Corner-stuck detection: less than stuckDistancePx of progress in stuckAfterMs means stuck. */
const stuck = {
  distancePx: 10,
  afterMs: 650,
  /** How long to back off to an open cell before trying again. */
  unstickMs: 700,
  /** Targets closer than this are "holding position", not stuck. */
  minTargetDistancePx: 36,
};
/**
 * "Local" moves (strafe, back off, sidestep) are points a fixed distance away in
 * some direction. They can land inside a wall, which used to wedge tanks on it.
 * They're tagged here and clipped to how far the hull can really go.
 */
const localTargets = new WeakSet<Vector2>();
const local = (target: Vector2): Vector2 => {
  localTargets.add(target);
  return target;
};
/** A local move shorter than this is treated as blocked; try another direction. */
const minLocalMovePx = 48;

/** Look this many cells ahead on the path for one the whole hull can reach in a straight line. */
const pathLookahead = 6;
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

    const chosenTarget = chooseMovementTarget(enemy, player, perception, state.elapsedMs);
    const moveTarget =
      chosenTarget && localTargets.has(chosenTarget) ? clipLocalTarget(state, enemy, chosenTarget) : chosenTarget;

    if (moveTarget) {
      trackProgress(state, enemy, moveTarget, deltaMs);
      const steerTarget =
        enemy.unstickTarget && enemy.unstickRemainingMs > 0
          ? enemy.unstickTarget
          : routeAroundWalls(state, enemy, moveTarget, deltaMs);
      moveEnemyTowards(enemy, steerTarget, deltaMs / 1000, state.obstacles);
    } else {
      enemy.navWaypoint = null;
      enemy.stuckMs = 0;
      enemy.progressAnchor = { ...enemy.position };
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
 * If the whole hull fits along a straight line to the target, drive at it.
 * Otherwise follow the grid path, skipping ahead to the furthest cell on it the
 * hull can reach in a straight line, so tanks cut clean lines through doorways
 * instead of clipping corners. If no cell ahead is reachable, re-centre in the
 * current cell first.
 */
function routeAroundWalls(state: BattleState, enemy: TankState, target: Vector2, deltaMs: number): Vector2 {
  if (hullFits(enemy.position, target, enemy.radius, state.obstacles)) {
    enemy.navWaypoint = null;
    return target;
  }

  enemy.navRefreshMs -= deltaMs;
  const reachedWaypoint =
    enemy.navWaypoint !== null && distanceBetween(enemy.position, enemy.navWaypoint) <= 10;
  if (enemy.navWaypoint === null || reachedWaypoint || enemy.navRefreshMs <= 0) {
    const path = findPath(state.navGrid, enemy.position, target);
    enemy.navWaypoint = null;
    for (let index = Math.min(pathLookahead, path.length) - 1; index >= 0; index -= 1) {
      if (hullFits(enemy.position, path[index], enemy.radius, state.obstacles)) {
        enemy.navWaypoint = path[index];
        break;
      }
    }
    if (!enemy.navWaypoint && path.length > 0) {
      enemy.navWaypoint = cellCentre(state.navGrid, enemy.position);
    }
    enemy.navRefreshMs = navRefreshIntervalMs;
  }
  return enemy.navWaypoint ?? target;
}

/**
 * Shortens a local move to the furthest point the hull can reach in a straight
 * line. If that's barely anywhere (a wall right there), tries the two sideways
 * directions and straight back, and takes whichever goes furthest.
 */
function clipLocalTarget(state: BattleState, enemy: TankState, target: Vector2): Vector2 {
  const offset = { x: target.x - enemy.position.x, y: target.y - enemy.position.y };
  const length = Math.hypot(offset.x, offset.y);
  if (length < 1) {
    return target;
  }

  const reach = (direction: Vector2): Vector2 => {
    const best = clearDistance(enemy.position, direction, Math.min(length, 640), enemy.radius, state.obstacles);
    return { x: enemy.position.x + direction.x * best, y: enemy.position.y + direction.y * best };
  };

  const forward = { x: offset.x / length, y: offset.y / length };
  const first = reach(forward);
  if (distanceBetween(enemy.position, first) >= minLocalMovePx) {
    return first;
  }

  const alternatives = [
    { x: -forward.y, y: forward.x },
    { x: forward.y, y: -forward.x },
    { x: -forward.x, y: -forward.y },
  ].map(reach);
  return alternatives.reduce(
    (best, point) =>
      distanceBetween(enemy.position, point) > distanceBetween(enemy.position, best) ? point : best,
    first,
  );
}

/** True when a circle of this radius can slide from start to end without touching anything. */
function hullFits(
  start: Vector2,
  end: Vector2,
  radius: number,
  obstacles: readonly { x: number; y: number; width: number; height: number }[],
): boolean {
  const length = distanceBetween(start, end);
  if (length < 1) {
    return true;
  }
  const direction = { x: (end.x - start.x) / length, y: (end.y - start.y) / length };
  return clearDistance(start, direction, length, radius, obstacles) >= length;
}

/**
 * How far a circle can travel from start along direction (up to maxDistance)
 * before it would hit an obstacle. Marches the hull in small steps, with the
 * radius trimmed a little so a tank already touching a wall can still slide
 * along it or drive away from it.
 */
function clearDistance(
  start: Vector2,
  direction: Vector2,
  maxDistance: number,
  radius: number,
  obstacles: readonly { x: number; y: number; width: number; height: number }[],
): number {
  const stepPx = 8;
  const hullRadius = Math.max(4, radius - 3);
  const end = { x: start.x + direction.x * maxDistance, y: start.y + direction.y * maxDistance };
  // Only obstacles near the segment matter.
  const nearby = obstacles.filter(
    (rect) =>
      rect.x - hullRadius <= Math.max(start.x, end.x) &&
      rect.x + rect.width + hullRadius >= Math.min(start.x, end.x) &&
      rect.y - hullRadius <= Math.max(start.y, end.y) &&
      rect.y + rect.height + hullRadius >= Math.min(start.y, end.y),
  );
  if (nearby.length === 0) {
    return maxDistance;
  }

  let clear = 0;
  for (let distance = stepPx; ; distance += stepPx) {
    const along = Math.min(distance, maxDistance);
    const point = { x: start.x + direction.x * along, y: start.y + direction.y * along };
    if (nearby.some((rect) => circleIntersectsRect(point, hullRadius, rect))) {
      return clear;
    }
    clear = along;
    if (along >= maxDistance) {
      return clear;
    }
  }
}

/**
 * Watches for a tank wedged on a corner (or another tank): if it hasn't made
 * real progress for a while, it backs off to the nearest open cell, then
 * re-plans its route.
 */
function trackProgress(state: BattleState, enemy: TankState, target: Vector2, deltaMs: number): void {
  if (enemy.unstickRemainingMs > 0) {
    enemy.unstickRemainingMs -= deltaMs;
    if (
      enemy.unstickRemainingMs <= 0 ||
      (enemy.unstickTarget && distanceBetween(enemy.position, enemy.unstickTarget) <= 8)
    ) {
      enemy.unstickTarget = null;
      enemy.unstickRemainingMs = 0;
      enemy.navWaypoint = null;
      enemy.navRefreshMs = 0;
      enemy.progressAnchor = { ...enemy.position };
      enemy.stuckMs = 0;
    }
    return;
  }

  if (distanceBetween(enemy.position, enemy.progressAnchor) > stuck.distancePx) {
    enemy.progressAnchor = { ...enemy.position };
    enemy.stuckMs = 0;
    return;
  }

  if (distanceBetween(enemy.position, target) < stuck.minTargetDistancePx) {
    enemy.stuckMs = 0;
    return;
  }

  enemy.stuckMs += deltaMs;
  if (enemy.stuckMs < stuck.afterMs) {
    return;
  }

  // Back off: the current cell's centre if we're off it, else the nearest open neighbour.
  const centre = cellCentre(state.navGrid, enemy.position);
  const options =
    distanceBetween(enemy.position, centre) > 12
      ? [centre, ...openNeighbourCentres(state.navGrid, enemy.position)]
      : openNeighbourCentres(state.navGrid, enemy.position);
  // Prefer an escape that isn't straight back into whatever is blocking us: alternate by attempt.
  enemy.unstickTarget = options[Math.floor(state.elapsedMs / 1000) % Math.max(1, options.length)] ?? centre;
  enemy.unstickRemainingMs = stuck.unstickMs;
  enemy.stuckMs = 0;
  enemy.navWaypoint = null;
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
    return local({
      x: enemy.position.x - toPlayer.x * enemy.repositionDistance,
      y: enemy.position.y - toPlayer.y * enemy.repositionDistance,
    });
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

  return local({
    x: enemy.position.x + heading.x * lookAheadDistance,
    y: enemy.position.y + heading.y * lookAheadDistance,
  });
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

  return local(holdsGround(enemy)
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
    : buildLateralTarget(enemy, target, 1));
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

  return local({
    x: target.x + lateral.x * enemy.repositionDistance * multiplier - toPlayer.x * enemy.preferredRange * 0.22,
    y: target.y + lateral.y * enemy.repositionDistance * multiplier - toPlayer.y * enemy.preferredRange * 0.22,
  });
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
