// Combat geometry and damage maths on the ground plane (x, z). Pure and unit-tested.

export interface Flat {
  x: number;
  z: number;
}

/** Facing yaw for a direction; yaw 0 faces +z, matching the rigs. */
export function yawTowards(from: Flat, to: Flat): number {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

export function flatDistance(a: Flat, b: Flat): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** Smallest signed difference between two angles, in (-pi, pi]. */
export function angleDelta(from: number, to: number): number {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta <= -Math.PI) delta += Math.PI * 2;
  return delta;
}

/** True when `target` (with its radius) sits inside the swing's reach and arc. */
export function inSwingArc(
  origin: Flat,
  facingYaw: number,
  target: Flat,
  reach: number,
  arcRadians: number,
  targetRadius = 0,
): boolean {
  const distance = flatDistance(origin, target);
  if (distance > reach + targetRadius) return false;
  if (distance < 0.35 + targetRadius) return true;
  return Math.abs(angleDelta(facingYaw, yawTowards(origin, target))) <= arcRadians / 2;
}

/** The three-hit combo: the finisher hits harder. */
export function comboDamage(baseDamage: number, comboIndex: number): number {
  return comboIndex >= 2 ? Math.round(baseDamage * 1.5) : baseDamage;
}

/** Unit push direction from `from` to `to` scaled by strength (falls back to +z when overlapping). */
export function knockback(from: Flat, to: Flat, strength: number): Flat {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dz);
  if (length < 1e-4) return { x: 0, z: strength };
  return { x: (dx / length) * strength, z: (dz / length) * strength };
}

/** Health after a hit, never below zero. */
export function applyDamage(health: number, damage: number): number {
  return Math.max(0, health - Math.max(0, damage));
}
