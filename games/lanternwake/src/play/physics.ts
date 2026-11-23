// Rapier physics: one world per loaded area, stepped at a fixed 60 Hz.
import RAPIER from "@dimforge/rapier3d-compat";
import type { ColliderSpec } from "../world/props";

export { RAPIER };

let ready: Promise<void> | null = null;

export function initPhysics(): Promise<void> {
  if (!ready) ready = RAPIER.init();
  return ready;
}

/** Collision layers (membership bit, and what each layer collides with). */
export const layer = {
  world: 0x0001,
  player: 0x0002,
  foe: 0x0004,
  prop: 0x0008,
  debris: 0x0010,
};

export function groups(membership: number, filter: number): number {
  return (membership << 16) | filter;
}

export const groupWorld = groups(layer.world, 0xffff);
export const groupPlayer = groups(layer.player, layer.world | layer.foe | layer.prop);
export const groupFoe = groups(layer.foe, layer.world | layer.player | layer.foe | layer.prop);
export const groupProp = groups(layer.prop, layer.world | layer.player | layer.foe | layer.prop | layer.debris);
export const groupDebris = groups(layer.debris, layer.world | layer.prop);
/** Camera and line-of-sight rays only see static world geometry. */
export const groupWorldOnly = groups(0xffff, layer.world);

export const fixedStep = 1 / 60;

export class Physics {
  readonly world: RAPIER.World;
  private accumulator = 0;

  constructor() {
    this.world = new RAPIER.World({ x: 0, y: -22, z: 0 });
    this.world.timestep = fixedStep;
  }

  /** Static collider from a prop's collider spec, placed by the prop's transform. */
  addStatic(spec: ColliderSpec, x: number, y: number, z: number, rotY: number, scale = 1): RAPIER.Collider {
    const cos = Math.cos(rotY);
    const sin = Math.sin(rotY);
    // Rotate the local offset by the prop's yaw (three.js Y rotation).
    const lx = spec.x * scale;
    const lz = spec.z * scale;
    const wx = x + lx * cos + lz * sin;
    const wz = z - lx * sin + lz * cos;
    let desc: RAPIER.ColliderDesc | null;
    if (spec.shape === "box") {
      desc = RAPIER.ColliderDesc.cuboid(spec.hx * scale, spec.hy * scale, spec.hz * scale);
      const half = (rotY + spec.rotY) / 2;
      desc.setRotation({ x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) });
    } else if (spec.shape === "cylinder") {
      desc = RAPIER.ColliderDesc.cylinder(spec.halfHeight * scale, spec.radius * scale);
    } else {
      const points = new Float32Array(spec.points.length);
      for (let index = 0; index < spec.points.length; index += 3) {
        const px = spec.points[index] * scale;
        const pz = spec.points[index + 2] * scale;
        points[index] = px * cos + pz * sin;
        points[index + 1] = spec.points[index + 1] * scale;
        points[index + 2] = -px * sin + pz * cos;
      }
      desc = RAPIER.ColliderDesc.convexHull(points);
    }
    if (!desc) throw new Error("Could not build collider");
    desc.setTranslation(wx, y + spec.y * scale, wz).setCollisionGroups(groupWorld).setFriction(0.8);
    return this.world.createCollider(desc);
  }

  addTrimesh(vertices: Float32Array, indices: Uint32Array): void {
    const desc = RAPIER.ColliderDesc.trimesh(vertices, indices).setCollisionGroups(groupWorld).setFriction(0.9);
    this.world.createCollider(desc);
  }

  /** Advance in fixed steps; returns how many steps ran. */
  step(dt: number, beforeStep: (step: number) => void): number {
    this.accumulator = Math.min(this.accumulator + dt, fixedStep * 5);
    let steps = 0;
    while (this.accumulator >= fixedStep) {
      beforeStep(fixedStep);
      this.world.step();
      this.accumulator -= fixedStep;
      steps += 1;
    }
    return steps;
  }

  /** Distance along a ray to the first static surface, or `max`. */
  castWorld(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, max: number): number {
    const ray = new RAPIER.Ray({ x: ox, y: oy, z: oz }, { x: dx, y: dy, z: dz });
    const hit = this.world.castRay(ray, max, true, undefined, groupWorldOnly);
    return hit ? hit.timeOfImpact : max;
  }

  free(): void {
    this.world.free();
  }
}
