import type { Rect } from "../../content/levelTypes";
import type { Vector2 } from "./types";

const CONTACT_EPSILON = 0.05;
const SWEEP_EPSILON = 0.001;
const MIN_REMAINING_DELTA = 0.01;
const MAX_COLLISION_PASSES = 4;
const MAX_OVERLAP_PASSES = 6;

export interface CollisionMoveResult {
  position: Vector2;
  blocked: boolean;
}

export function normalizeVector(vector: Vector2): Vector2 {
  const length = Math.hypot(vector.x, vector.y);

  if (length === 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: vector.x / length,
    y: vector.y / length,
  };
}

export function distanceBetween(a: Vector2, b: Vector2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function rotationFromVector(vector: Vector2): number {
  return Math.atan2(vector.y, vector.x) - Math.PI / 2;
}

export function forwardFromRotation(rotation: number): Vector2 {
  return {
    x: -Math.sin(rotation),
    y: Math.cos(rotation),
  };
}

export function rotateAngleTowards(current: number, target: number, maxStep: number): number {
  const delta = wrapAngle(target - current);

  if (Math.abs(delta) <= maxStep) {
    return target;
  }

  return current + Math.sign(delta) * maxStep;
}

export function wrapAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function circleIntersectsCircle(
  a: Vector2,
  aRadius: number,
  b: Vector2,
  bRadius: number,
): boolean {
  return distanceBetween(a, b) <= aRadius + bRadius;
}

export function circleIntersectsRect(center: Vector2, radius: number, rect: Rect): boolean {
  const closestX = clamp(center.x, rect.x, rect.x + rect.width);
  const closestY = clamp(center.y, rect.y, rect.y + rect.height);
  const dx = center.x - closestX;
  const dy = center.y - closestY;

  return dx * dx + dy * dy <= radius * radius;
}

export function moveCircleWithCollisions(
  position: Vector2,
  delta: Vector2,
  radius: number,
  rects: readonly Rect[],
): Vector2 {
  return moveCircleWithCollisionsDetailed(position, delta, radius, rects).position;
}

export function moveCircleWithCollisionsDetailed(
  position: Vector2,
  delta: Vector2,
  radius: number,
  rects: readonly Rect[],
): CollisionMoveResult {
  const origin = resolveCircleOverlaps(position, radius, rects);
  let current = origin;
  let remaining = { ...delta };
  let blocked = distanceBetween(position, origin) > CONTACT_EPSILON;

  for (let pass = 0; pass < MAX_COLLISION_PASSES; pass += 1) {
    if (Math.hypot(remaining.x, remaining.y) <= MIN_REMAINING_DELTA) {
      break;
    }

    const hit = findFirstCollision(current, remaining, radius, rects);

    if (!hit) {
      current = addVector(current, remaining);
      remaining = { x: 0, y: 0 };
      break;
    }

    if (hit.time > 0) {
      current = addVector(current, scaleVector(remaining, Math.max(0, hit.time - SWEEP_EPSILON)));
    }

    current = addVector(current, scaleVector(hit.normal, CONTACT_EPSILON));

    const slide = scaleVector(remaining, Math.max(0, 1 - hit.time));
    const pushIntoSurface = dotProduct(slide, hit.normal);

    remaining =
      pushIntoSurface < 0
        ? subtractVector(slide, scaleVector(hit.normal, pushIntoSurface))
        : slide;
    blocked = true;
  }

  const resolved = resolveCircleOverlaps(current, radius, rects);
  const requestedDistance = Math.hypot(delta.x, delta.y);
  const actualDistance = distanceBetween(origin, resolved);

  return {
    position: resolved,
    blocked: blocked || actualDistance + CONTACT_EPSILON < requestedDistance,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

interface SweepHit {
  time: number;
  normal: Vector2;
}

interface SweepRange {
  entry: number;
  exit: number;
}

function resolveCircleOverlaps(position: Vector2, radius: number, rects: readonly Rect[]): Vector2 {
  let resolved = { ...position };

  for (let pass = 0; pass < MAX_OVERLAP_PASSES; pass += 1) {
    let adjusted = false;

    rects.forEach((rect) => {
      const expanded = expandRect(rect, radius);

      if (!pointInsideRect(resolved, expanded)) {
        return;
      }

      resolved = addVector(resolved, getOverlapCorrection(resolved, expanded));
      adjusted = true;
    });

    if (!adjusted) {
      break;
    }
  }

  return resolved;
}

function findFirstCollision(
  position: Vector2,
  delta: Vector2,
  radius: number,
  rects: readonly Rect[],
): SweepHit | undefined {
  let earliestHit: SweepHit | undefined;

  rects.forEach((rect) => {
    const hit = sweepPointAgainstRect(position, delta, expandRect(rect, radius));

    if (!hit) {
      return;
    }

    if (!earliestHit || hit.time < earliestHit.time) {
      earliestHit = hit;
    }
  });

  return earliestHit;
}

function sweepPointAgainstRect(position: Vector2, delta: Vector2, rect: Rect): SweepHit | undefined {
  const xRange = sweepAxis(position.x, delta.x, rect.x, rect.x + rect.width);
  const yRange = sweepAxis(position.y, delta.y, rect.y, rect.y + rect.height);

  if (!xRange || !yRange) {
    return undefined;
  }

  const entryTime = Math.max(xRange.entry, yRange.entry);
  const exitTime = Math.min(xRange.exit, yRange.exit);

  if (entryTime > exitTime || entryTime < 0 || entryTime > 1) {
    return undefined;
  }

  if (xRange.entry > yRange.entry) {
    return {
      time: entryTime,
      normal: delta.x > 0 ? { x: -1, y: 0 } : { x: 1, y: 0 },
    };
  }

  return {
    time: entryTime,
    normal: delta.y > 0 ? { x: 0, y: -1 } : { x: 0, y: 1 },
  };
}

function sweepAxis(position: number, delta: number, min: number, max: number): SweepRange | undefined {
  if (delta === 0) {
    if (position < min || position > max) {
      return undefined;
    }

    return {
      entry: Number.NEGATIVE_INFINITY,
      exit: Number.POSITIVE_INFINITY,
    };
  }

  const inverseDelta = 1 / delta;
  const first = (min - position) * inverseDelta;
  const second = (max - position) * inverseDelta;

  return {
    entry: Math.min(first, second),
    exit: Math.max(first, second),
  };
}

function expandRect(rect: Rect, padding: number): Rect {
  return {
    x: rect.x - padding,
    y: rect.y - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  };
}

function pointInsideRect(point: Vector2, rect: Rect): boolean {
  return (
    point.x > rect.x &&
    point.x < rect.x + rect.width &&
    point.y > rect.y &&
    point.y < rect.y + rect.height
  );
}

function getOverlapCorrection(point: Vector2, rect: Rect): Vector2 {
  const corrections = [
    { x: rect.x - point.x - CONTACT_EPSILON, y: 0 },
    { x: rect.x + rect.width - point.x + CONTACT_EPSILON, y: 0 },
    { x: 0, y: rect.y - point.y - CONTACT_EPSILON },
    { x: 0, y: rect.y + rect.height - point.y + CONTACT_EPSILON },
  ];

  return corrections.reduce((smallest, candidate) =>
    Math.hypot(candidate.x, candidate.y) < Math.hypot(smallest.x, smallest.y) ? candidate : smallest,
  );
}

function addVector(a: Vector2, b: Vector2): Vector2 {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
  };
}

function subtractVector(a: Vector2, b: Vector2): Vector2 {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
  };
}

function scaleVector(vector: Vector2, scalar: number): Vector2 {
  return {
    x: vector.x * scalar,
    y: vector.y * scalar,
  };
}

function dotProduct(a: Vector2, b: Vector2): number {
  return a.x * b.x + a.y * b.y;
}
