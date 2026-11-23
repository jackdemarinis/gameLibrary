// Height-field building blocks for area layouts: walkable shapes carved into
// rising ground, so every area is a valley bounded by cliffs.
import { fbm, smoothstep } from "../../engine/rng";

/** Signed distance helpers on the ground plane (negative = inside). */
export function circleDistance(x: number, z: number, cx: number, cz: number, radius: number): number {
  return Math.hypot(x - cx, z - cz) - radius;
}

/** Distance to a polyline corridor of half-width `halfWidth`. */
export function corridorDistance(x: number, z: number, points: Array<[number, number]>, halfWidth: number): number {
  let best = Infinity;
  for (let index = 0; index < points.length - 1; index += 1) {
    const [ax, az] = points[index];
    const [bx, bz] = points[index + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best - halfWidth;
}

export function boxDistance(x: number, z: number, cx: number, cz: number, halfX: number, halfZ: number): number {
  const dx = Math.abs(x - cx) - halfX;
  const dz = Math.abs(z - cz) - halfZ;
  return Math.min(Math.max(dx, dz), 0) + Math.hypot(Math.max(dx, 0), Math.max(dz, 0));
}

/**
 * Ground height: gentle bumps inside the walkable region (distance <= 0), rising into
 * cliffs outside it. `rise` is how tall the walls get, `ramp` how wide the slope is.
 */
export function valleyHeight(x: number, z: number, walkDistance: number, options: { bumps?: number; rise?: number; ramp?: number; seed?: number } = {}): number {
  const bumps = options.bumps ?? 0.35;
  const rise = options.rise ?? 7;
  const ramp = options.ramp ?? 5;
  const seed = options.seed ?? 1;
  const ground = (fbm(x * 0.06, z * 0.06, seed) - 0.5) * 2 * bumps;
  if (walkDistance <= 0) return ground * smoothstep(0, -3, walkDistance) + ground * 0.3;
  const wall = smoothstep(0, ramp, walkDistance) * rise + Math.max(0, walkDistance - ramp) * 0.6;
  const craggy = (fbm(x * 0.25, z * 0.25, seed + 9) - 0.5) * 2.2 * smoothstep(0.5, ramp, walkDistance);
  return ground * 0.3 + wall + craggy;
}
