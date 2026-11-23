// What gameplay objects can see and do while an area is running.
import type * as THREE from "three";
import type { ParticleSystem } from "../engine/particles";
import type { LightPool } from "../engine/lightPool";
import type { Sound } from "../engine/sfx";
import type { PickupKind } from "../game/content/areaTypes";
import type { Physics } from "./physics";

export interface Hittable {
  readonly alive: boolean;
  readonly radius: number;
  position(): THREE.Vector3;
  /** Returns true when the hit landed (not blocked or immune). */
  takeHit(damage: number, from: THREE.Vector3, knock: number): boolean;
}

export interface PlayContext {
  readonly physics: Physics;
  readonly fxRoot: THREE.Object3D;
  readonly glow: ParticleSystem;
  readonly dust: ParticleSystem;
  readonly lights: LightPool;
  readonly flags: Set<string>;
  time: number;
  ground(x: number, z: number): number;
  play(sound: Sound): void;
  shake(amount: number): void;
  flash(color: number, amount: number): void;
  hitStop(seconds: number): void;
  addXp(amount: number, at: THREE.Vector3): void;
  spawnPickup(kind: PickupKind, at: THREE.Vector3): void;
  banner(title: string, subtitle?: string): void;
  toast(text: string): void;
  setFlag(flag: string): void;
  clearFlag(flag: string): void;
  /** Everything the sword can hit this frame. */
  hittables(): Hittable[];
  playerPosition(): THREE.Vector3;
  damagePlayer(halfHearts: number, from: THREE.Vector3, knock: number): void;
  playerInvulnerable(): boolean;
  spawnFoe(kind: "shade", x: number, z: number): void;
  onFoeDefeated(kind: string, at: THREE.Vector3): void;
  /** The lantern flare burst here (lights braziers). */
  flareAt(at: THREE.Vector3): void;
}
