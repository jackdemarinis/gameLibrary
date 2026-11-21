// Pure ball physics: flight, landing on gravel, rolling friction and
// sphere-sphere collisions. No Three.js here so it can be unit tested.

import { balls, physics, pitch, throwing, type ThrowStyle } from "../config/rules";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type BallKind = "jack" | "boule";
export type BallState = "air" | "rolling" | "rest" | "out";

export interface Ball {
  id: number;
  kind: BallKind;
  team: number | null;
  radius: number;
  mass: number;
  position: Vec3;
  velocity: Vec3;
  state: BallState;
}

export interface World {
  balls: Ball[];
  nextId: number;
}

export function createWorld(): World {
  return { balls: [], nextId: 1 };
}

export function addBall(world: World, kind: BallKind, team: number | null, position: Vec3, velocity: Vec3): Ball {
  const ball: Ball = {
    id: world.nextId++,
    kind,
    team,
    radius: kind === "jack" ? balls.jackRadius : balls.bouleRadius,
    mass: kind === "jack" ? balls.jackMass : balls.bouleMass,
    position: { ...position },
    velocity: { ...velocity },
    state: "air",
  };
  world.balls.push(ball);
  return ball;
}

export function isLive(ball: Ball): boolean {
  return ball.state !== "out";
}

export function isSettled(world: World): boolean {
  return world.balls.every((ball) => ball.state === "rest" || ball.state === "out");
}

export function horizontalDistance(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function isOutOfBounds(position: Vec3): boolean {
  return Math.abs(position.x) > pitch.halfWidth || position.z < pitch.deadLine || position.z > pitch.backLine;
}

function stepBall(ball: Ball, dt: number): void {
  if (ball.state === "rest" || ball.state === "out") {
    return;
  }

  if (ball.state === "air") {
    ball.velocity.y -= physics.gravity * dt;
    ball.position.x += ball.velocity.x * dt;
    ball.position.y += ball.velocity.y * dt;
    ball.position.z += ball.velocity.z * dt;

    if (ball.position.y <= ball.radius) {
      land(ball);
    }
  } else {
    const speed = Math.hypot(ball.velocity.x, ball.velocity.z);
    const decel = physics.rollingFriction * physics.gravity * dt;

    if (speed <= decel || speed < physics.restSpeed) {
      ball.velocity.x = 0;
      ball.velocity.z = 0;
      ball.state = "rest";
    } else {
      const scale = (speed - decel) / speed;
      ball.velocity.x *= scale;
      ball.velocity.z *= scale;
      ball.position.x += ball.velocity.x * dt;
      ball.position.z += ball.velocity.z * dt;
    }
    ball.position.y = ball.radius;
    ball.velocity.y = 0;
  }

  if (isOutOfBounds(ball.position)) {
    ball.state = "out";
    ball.velocity = { x: 0, y: 0, z: 0 };
  }
}

// Steep landings bite into the gravel and lose most of their speed; shallow
// ones skid on. This is what makes a lob stop and a roll run.
function land(ball: Ball): void {
  ball.position.y = ball.radius;
  const verticalSpeed = Math.abs(ball.velocity.y);
  const horizontalSpeed = Math.hypot(ball.velocity.x, ball.velocity.z);
  const steepness = verticalSpeed / (verticalSpeed + horizontalSpeed + 1e-9);
  const keep = Math.min(0.95, Math.max(0.12, 1 - physics.landingGrip * steepness));
  ball.velocity.x *= keep;
  ball.velocity.z *= keep;

  const bounceSpeed = verticalSpeed * physics.bounceRestitution;
  if (bounceSpeed > physics.bounceStopSpeed) {
    ball.velocity.y = bounceSpeed;
  } else {
    ball.velocity.y = 0;
    ball.state = "rolling";
  }
}

function collide(a: Ball, b: Ball): void {
  const dx = b.position.x - a.position.x;
  const dy = b.position.y - a.position.y;
  const dz = b.position.z - a.position.z;
  const distance = Math.hypot(dx, dy, dz);
  const minDistance = a.radius + b.radius;

  if (distance >= minDistance || distance === 0) {
    return;
  }

  const nx = dx / distance;
  const ny = dy / distance;
  const nz = dz / distance;
  const inverseA = 1 / a.mass;
  const inverseB = 1 / b.mass;

  const overlap = minDistance - distance;
  const correction = overlap / (inverseA + inverseB);
  a.position.x -= nx * correction * inverseA;
  a.position.z -= nz * correction * inverseA;
  b.position.x += nx * correction * inverseB;
  b.position.z += nz * correction * inverseB;
  // Only airborne balls can be pushed vertically; grounded ones sit on the gravel.
  if (a.state === "air") a.position.y -= ny * correction * inverseA;
  if (b.state === "air") b.position.y += ny * correction * inverseB;

  // A ball can't balance on top of another: roll it off the side.
  if (a.state === "air" && b.state !== "air" && ny < -0.5) rollOff(a, -nx, -nz);
  if (b.state === "air" && a.state !== "air" && ny > 0.5) rollOff(b, nx, nz);

  const closingSpeed =
    (a.velocity.x - b.velocity.x) * nx + (a.velocity.y - b.velocity.y) * ny + (a.velocity.z - b.velocity.z) * nz;

  if (closingSpeed <= 0) {
    return;
  }

  const impulse = ((1 + balls.restitution) * closingSpeed) / (inverseA + inverseB);
  applyImpulse(a, -impulse * inverseA, nx, ny, nz);
  applyImpulse(b, impulse * inverseB, nx, ny, nz);
}

function rollOff(ball: Ball, awayX: number, awayZ: number): void {
  let length = Math.hypot(awayX, awayZ);
  if (length < 1e-3) {
    awayX = 1;
    awayZ = 0;
    length = 1;
  }
  const horizontalSpeed = Math.hypot(ball.velocity.x, ball.velocity.z);
  if (horizontalSpeed < physics.rollOffSpeed) {
    ball.velocity.x += (awayX / length) * physics.rollOffSpeed;
    ball.velocity.z += (awayZ / length) * physics.rollOffSpeed;
  }
}

// Safety net: drops anything still moving onto the gravel and stops it,
// then separates any overlaps. Used if a throw runs past its time budget.
export function forceSettle(world: World): void {
  for (const ball of world.balls) {
    if (ball.state === "out") continue;
    ball.position.y = ball.radius;
    ball.velocity = { x: 0, y: 0, z: 0 };
    ball.state = "rest";
  }
  const live = world.balls.filter(isLive);
  for (let pass = 0; pass < 8; pass++) {
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        collide(live[i], live[j]);
      }
    }
  }
  for (const ball of live) {
    ball.velocity = { x: 0, y: 0, z: 0 };
    ball.state = isOutOfBounds(ball.position) ? "out" : "rest";
  }
}

function applyImpulse(ball: Ball, scale: number, nx: number, ny: number, nz: number): void {
  ball.velocity.x += nx * scale;
  ball.velocity.y += ny * scale;
  ball.velocity.z += nz * scale;

  if (ball.state === "air") {
    return;
  }

  if (ball.velocity.y > physics.popUpSpeed) {
    ball.state = "air";
  } else {
    ball.velocity.y = 0;
    ball.state = Math.hypot(ball.velocity.x, ball.velocity.z) > physics.restSpeed ? "rolling" : "rest";
  }
}

export function stepWorld(world: World, dt: number = physics.stepSeconds): void {
  for (const ball of world.balls) {
    stepBall(ball, dt);
  }

  const live = world.balls.filter(isLive);
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      collide(live[i], live[j]);
    }
  }
}

export interface ThrowInput {
  aimRadians: number;
  power: number;
  style: ThrowStyle;
  accuracyError: number;
}

export function releasePosition(aimRadians: number): Vec3 {
  return {
    x: -Math.sin(aimRadians) * throwing.releaseForward,
    y: throwing.releaseHeight,
    z: -Math.cos(aimRadians) * throwing.releaseForward,
  };
}

export function launchVelocity(speed: number, aimRadians: number, style: ThrowStyle): Vec3 {
  const elevation = (throwing.elevationDegrees[style] * Math.PI) / 180;
  const horizontal = speed * Math.cos(elevation);
  return {
    x: -Math.sin(aimRadians) * horizontal,
    y: speed * Math.sin(elevation),
    z: -Math.cos(aimRadians) * horizontal,
  };
}

// Power maps linearly onto resting distance on an empty pitch, so the meter
// reads like a ruler. We find the launch speed for a distance by bisection.
export function powerToDistance(power: number): number {
  return throwing.minDistance + Math.min(1, Math.max(0, power)) * (throwing.maxDistance - throwing.minDistance);
}

export function distanceToPower(distance: number): number {
  return (distance - throwing.minDistance) / (throwing.maxDistance - throwing.minDistance);
}

const speedCache = new Map<string, number>();

export function simulateRestDistance(speed: number, style: ThrowStyle, kind: BallKind = "boule"): number {
  const world = createWorld();
  // Use an unbounded straight shot; out-of-bounds would cut the distance short.
  const ball = addBall(world, kind, null, releasePosition(0), launchVelocity(speed, 0, style));
  const maxSteps = physics.maxSimSeconds / physics.stepSeconds;
  for (let step = 0; step < maxSteps && ball.state !== "rest"; step++) {
    stepBallUnbounded(ball, physics.stepSeconds);
  }
  return -ball.position.z;
}

function stepBallUnbounded(ball: Ball, dt: number): void {
  const savedZ = ball.position.z;
  // Shift into the pitch so bounds never trigger during calibration.
  ball.position.z = 0;
  stepBall(ball, dt);
  ball.position.z += savedZ;
}

export function speedForDistance(distance: number, style: ThrowStyle, kind: BallKind = "boule"): number {
  const key = `${style}:${kind}:${distance.toFixed(3)}`;
  const cached = speedCache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  let low = 0.1;
  let high = 30;
  for (let iteration = 0; iteration < 40; iteration++) {
    const middle = (low + high) / 2;
    if (simulateRestDistance(middle, style, kind) < distance) {
      low = middle;
    } else {
      high = middle;
    }
  }
  const speed = (low + high) / 2;
  speedCache.set(key, speed);
  return speed;
}

export function throwBall(world: World, kind: BallKind, team: number | null, input: ThrowInput): Ball {
  const errorRadians = (input.accuracyError * throwing.maxAccuracyErrorDegrees * Math.PI) / 180;
  const aim = input.aimRadians + errorRadians;
  const speed = speedForDistance(powerToDistance(input.power), input.style, kind);
  return addBall(world, kind, team, releasePosition(aim), launchVelocity(speed, aim, input.style));
}

// Resting-state snapshot the host sends so every screen ends a throw identically.
export interface BallSnapshot {
  id: number;
  kind: BallKind;
  team: number | null;
  position: Vec3;
  state: BallState;
}

export function snapshotBalls(world: World): BallSnapshot[] {
  return world.balls.map((ball) => ({ id: ball.id, kind: ball.kind, team: ball.team, position: { ...ball.position }, state: ball.state }));
}

export function restoreBalls(world: World, snapshot: BallSnapshot[], nextId: number): void {
  world.balls = snapshot.map((item) => ({
    id: item.id,
    kind: item.kind,
    team: item.team,
    radius: item.kind === "jack" ? balls.jackRadius : balls.bouleRadius,
    mass: item.kind === "jack" ? balls.jackMass : balls.bouleMass,
    position: { ...item.position },
    velocity: { x: 0, y: 0, z: 0 },
    state: item.state === "out" ? "out" : "rest",
  }));
  world.nextId = nextId;
}
