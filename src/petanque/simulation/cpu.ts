// CPU opponents. Pure: give it the pitch, a difficulty and a random source,
// get back a throw. Difficulty only changes how well it reads the pitch and
// how steady its hand is (see cpuLevels in config/rules.ts).

import { cpuLevels, pitch, throwing, type CpuLevel, type ThrowStyle } from "../config/rules";
import { distanceToPower, horizontalDistance, isLive, type Ball, type ThrowInput, type Vec3 } from "./physics";

const degrees = Math.PI / 180;

export interface CpuContext {
  balls: readonly Ball[];
  team: number;
  throwingJack: boolean;
  level: CpuLevel;
  random?: () => number;
}

export type CpuPlan = "jack" | "point" | "shoot" | "lobPoint";

function clampAim(value: number): number {
  const limit = throwing.maxAimDegrees * degrees;
  return Math.max(-limit, Math.min(limit, value));
}

function aimAt(target: Vec3): number {
  return Math.atan2(-target.x, -target.z);
}

// A boule sitting in front of the jack, close to the straight line to it.
function blocksLine(ball: Ball, jack: Vec3): boolean {
  const jackDistance = Math.hypot(jack.x, jack.z);
  const along = (ball.position.x * jack.x + ball.position.z * jack.z) / jackDistance;
  if (along < 1 || along > jackDistance - 0.25) return false;
  const across = Math.abs(ball.position.x * jack.z - ball.position.z * jack.x) / jackDistance;
  return across < 0.17;
}

export function chooseCpuPlan(context: CpuContext): { plan: CpuPlan; target: Vec3 } {
  const random = context.random ?? Math.random;
  const profile = cpuLevels[context.level];
  const jack = context.balls.find((ball) => ball.kind === "jack" && isLive(ball));

  if (context.throwingJack || !jack) {
    const span = pitch.jackMaxDistance - pitch.jackMinDistance;
    const distance = pitch.jackMinDistance + span * (0.2 + random() * 0.6);
    return { plan: "jack", target: { x: 0, y: 0, z: -distance } };
  }

  const boules = context.balls
    .filter((ball) => ball.kind === "boule" && isLive(ball) && ball.team !== null)
    .map((ball) => ({ ball, distance: horizontalDistance(ball.position, jack.position) }))
    .sort((a, b) => a.distance - b.distance);
  const rivalBest = boules.find((entry) => entry.ball.team !== context.team);
  const mineBest = boules.find((entry) => entry.ball.team === context.team);
  const rivalHoldsPoint = !!rivalBest && (!mineBest || rivalBest.distance < mineBest.distance);

  // A rival boule glued to the jack: knock it away with a high toss.
  if (rivalHoldsPoint && rivalBest!.distance < (profile.readsPitch ? 0.5 : 0.32) && random() < profile.shootChance) {
    return { plan: "shoot", target: { ...rivalBest!.ball.position } };
  }

  // Better players lob over a boule blocking the rolling line.
  if (profile.readsPitch && boules.some((entry) => blocksLine(entry.ball, jack.position))) {
    return { plan: "lobPoint", target: { ...jack.position } };
  }
  return { plan: "point", target: { ...jack.position } };
}

export function cpuThrow(context: CpuContext): ThrowInput {
  const random = context.random ?? Math.random;
  const profile = cpuLevels[context.level];
  const noise = () => random() * 2 - 1;
  const { plan, target } = chooseCpuPlan(context);
  const style: ThrowStyle = plan === "shoot" || plan === "lobPoint" ? "lob" : "roll";
  // Pointing aims to stop a hair short; a shot needs to land on the boule.
  const distance = Math.hypot(target.x, target.z) - (plan === "point" ? 0.05 : 0);
  return {
    aimRadians: clampAim(aimAt(target) + noise() * profile.aimNoiseDegrees * degrees),
    power: Math.max(0, Math.min(1, distanceToPower(distance) + noise() * profile.powerNoise)),
    style,
    accuracyError: 0,
  };
}
