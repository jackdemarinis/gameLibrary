// The lantern-keeper: kinematic character controller, three-hit sword combo,
// dodge roll with i-frames, lantern flare, hurt/death, and the rig animation.
import * as THREE from "three";
import { damp, clamp } from "../engine/rng";
import type { Action } from "../engine/input";
import { angleDelta, comboDamage, inSwingArc, yawTowards } from "../game/rules/combat";
import type { HeroStats } from "../game/rules/progression";
import { HumanoidRig, heroLook } from "../world/humanoidRig";
import { attackPose, deathPose, flarePose, hurtPose, idlePose, locomotionPose, rollPose } from "../world/rigAnimations";
import { SwordTrail } from "../world/swordTrail";
import { artPalette } from "../world/artPalette";
import type { Hittable, PlayContext } from "./context";
import { RAPIER, groupPlayer, type Physics } from "./physics";

/** What the player reads each fixed step (buffered presses + the stick). */
export interface ControlSource {
  move(): { x: number; y: number };
  wasPressed(action: Action): boolean;
}

type PlayerState = "move" | "attack" | "roll" | "hurt" | "flare" | "dead" | "frozen";

const capsuleHalf = 0.5;
const capsuleRadius = 0.34;
const centreToFeet = capsuleHalf + capsuleRadius;
const runSpeed = 5.6;
const attackDurations = [0.42, 0.42, 0.58];
const rollDuration = 0.5;
const flareDuration = 0.8;

export class Player {
  readonly rig = new HumanoidRig(heroLook());
  readonly trail = new SwordTrail(0xffe2a8);
  readonly lanternLight = new THREE.PointLight(artPalette.lanternLight, 9, 15, 1.5);
  /** Feet position (simulation), plus the previous step's for render interpolation. */
  readonly position = new THREE.Vector3();
  private readonly previous = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  yaw = 0;
  hp = 6;
  oil = 100;
  stats: HeroStats = { maxHearts: 3, swordDamage: 2, maxOil: 100, flareCost: 30 };
  state: PlayerState = "move";
  private stateTime = 0;
  private combo = 0;
  private comboQueued = false;
  private readonly hitThisSwing = new Set<Hittable>();
  private rollDir = new THREE.Vector2();
  private invulnerable = 0;
  private grounded = true;
  private flared = false;
  private stepPhase = 0;
  private lastStepSign = 0;
  private animTime = 0;
  private body: RAPIER.RigidBody | null = null;
  private collider: RAPIER.Collider | null = null;
  private controller: RAPIER.KinematicCharacterController | null = null;
  lockTarget: Hittable | null = null;
  private readonly scratch = new THREE.Vector3();
  private readonly scratch2 = new THREE.Vector3();
  moveAmount = 0;

  constructor() {
    this.rig.root.traverse((object) => (object.userData.player = true));
  }

  /** Create the physics body in a freshly loaded area. */
  spawn(physics: Physics, x: number, y: number, z: number, yaw: number): void {
    this.position.set(x, y, z);
    this.previous.copy(this.position);
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.state = "move";
    this.stateTime = 0;
    this.lockTarget = null;
    this.body = physics.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y + centreToFeet, z));
    this.collider = physics.world.createCollider(
      RAPIER.ColliderDesc.capsule(capsuleHalf, capsuleRadius).setCollisionGroups(groupPlayer),
      this.body,
    );
    const controller = physics.world.createCharacterController(0.03);
    controller.setSlideEnabled(true);
    controller.enableAutostep(0.45, 0.25, false);
    controller.enableSnapToGround(0.35);
    controller.setMaxSlopeClimbAngle((48 * Math.PI) / 180);
    controller.setMinSlopeSlideAngle((55 * Math.PI) / 180);
    controller.setApplyImpulsesToDynamicBodies(true);
    controller.setCharacterMass(55);
    this.controller = controller;
    this.rig.snapTo(idlePose(0));
  }

  /** Move instantly (respawns, debug tools). */
  teleport(x: number, y: number, z: number): void {
    this.position.set(x, y, z);
    this.previous.copy(this.position);
    this.velocity.set(0, 0, 0);
    this.body?.setTranslation({ x, y: y + centreToFeet, z }, true);
    this.body?.setNextKinematicTranslation({ x, y: y + centreToFeet, z });
  }

  get alive(): boolean {
    return this.state !== "dead";
  }

  isInvulnerable(): boolean {
    return this.invulnerable > 0 || this.state === "dead" || (this.state === "roll" && this.stateTime > 0.03 && this.stateTime < rollDuration * 0.85);
  }

  freeze(frozen: boolean): void {
    if (frozen && this.state !== "dead") this.enter("frozen");
    else if (!frozen && this.state === "frozen") this.enter("move");
  }

  private enter(state: PlayerState): void {
    this.state = state;
    this.stateTime = 0;
  }

  receiveHit(halfHearts: number, from: THREE.Vector3, knock: number, context: PlayContext): void {
    if (this.isInvulnerable() || this.state === "frozen") return;
    this.hp = Math.max(0, this.hp - halfHearts);
    const away = this.scratch.copy(this.position).sub(from).setY(0);
    if (away.lengthSq() < 1e-4) away.set(Math.sin(this.yaw + Math.PI), 0, Math.cos(this.yaw + Math.PI));
    away.normalize().multiplyScalar(knock);
    this.velocity.x = away.x;
    this.velocity.z = away.z;
    this.velocity.y = 3;
    this.invulnerable = 1.1;
    context.play("hurt");
    context.shake(0.5);
    context.flash(0xff3020, 0.35);
    context.hitStop(0.07);
    if (this.hp <= 0) {
      this.enter("dead");
      this.lockTarget = null;
    } else {
      this.enter("hurt");
    }
  }

  heal(halfHearts: number): void {
    this.hp = Math.min(this.stats.maxHearts * 2, this.hp + halfHearts);
  }

  /** Fixed-step simulation. */
  step(dt: number, input: ControlSource, cameraYaw: number, context: PlayContext): void {
    if (!this.body || !this.collider || !this.controller) return;
    this.previous.copy(this.position);
    this.stateTime += dt;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.oil = Math.min(this.stats.maxOil, this.oil + dt * 2.2);

    const stick = input.move();
    const forwardX = Math.sin(cameraYaw);
    const forwardZ = Math.cos(cameraYaw);
    // Screen-right on the ground is (-forwardZ, forwardX) for this yaw convention.
    const wishX = forwardX * stick.y - forwardZ * stick.x;
    const wishZ = forwardZ * stick.y + forwardX * stick.x;
    const wishLength = Math.hypot(wishX, wishZ);
    this.moveAmount = wishLength;

    if (this.lockTarget && (!this.lockTarget.alive || this.lockTarget.position().distanceTo(this.position) > 20)) this.lockTarget = null;

    let targetSpeedX = 0;
    let targetSpeedZ = 0;
    let accel = 14;

    switch (this.state) {
      case "move": {
        const speed = runSpeed * wishLength * (this.lockTarget ? 0.8 : 1);
        if (wishLength > 0.05) {
          targetSpeedX = (wishX / wishLength) * speed;
          targetSpeedZ = (wishZ / wishLength) * speed;
          if (!this.lockTarget) this.turnTowards(Math.atan2(wishX, wishZ), 14, dt);
        }
        if (this.lockTarget) this.turnTowards(yawTowards(this.position, this.lockTarget.position()), 16, dt);
        if (input.wasPressed("attack")) this.startAttack(0, context);
        else if (input.wasPressed("roll")) this.startRoll(wishX, wishZ, wishLength, context);
        else if (input.wasPressed("flare")) this.startFlare(context);
        break;
      }
      case "attack": {
        const duration = attackDurations[this.combo];
        const progress = this.stateTime / duration;
        if (progress > 0.3 && this.combo < 2 && input.wasPressed("attack")) this.comboQueued = true;
        if (progress < 0.25 && wishLength > 0.2 && !this.lockTarget) this.turnTowards(Math.atan2(wishX, wishZ), 10, dt);
        if (this.lockTarget && progress < 0.3) this.turnTowards(yawTowards(this.position, this.lockTarget.position()), 18, dt);
        const lunge = progress > 0.18 && progress < 0.5 ? (this.combo === 2 ? 5 : 3.4) : 0;
        targetSpeedX = Math.sin(this.yaw) * lunge;
        targetSpeedZ = Math.cos(this.yaw) * lunge;
        accel = 30;
        if (progress > 0.28 && progress < 0.6) this.sweepHits(context);
        if (progress > 0.55 && input.wasPressed("roll")) {
          this.startRoll(wishX, wishZ, wishLength, context);
          break;
        }
        if (progress >= 1) {
          if (this.comboQueued && this.combo < 2) this.startAttack(this.combo + 1, context);
          else this.enter("move");
        }
        break;
      }
      case "roll": {
        const progress = this.stateTime / rollDuration;
        const speed = progress < 0.75 ? 8.8 : 8.8 * (1 - (progress - 0.75) * 3);
        targetSpeedX = this.rollDir.x * speed;
        targetSpeedZ = this.rollDir.y * speed;
        accel = 40;
        if (progress >= 1) this.enter("move");
        break;
      }
      case "hurt":
        accel = 4;
        if (this.stateTime > 0.38) this.enter("move");
        break;
      case "flare": {
        const progress = this.stateTime / flareDuration;
        if (!this.flared && progress > 0.28) {
          this.flared = true;
          this.flareBurst(context);
        }
        if (progress >= 1) this.enter("move");
        break;
      }
      case "dead":
      case "frozen":
        accel = 10;
        break;
    }

    const blend = damp(accel, dt);
    this.velocity.x += (targetSpeedX - this.velocity.x) * blend;
    this.velocity.z += (targetSpeedZ - this.velocity.z) * blend;
    this.velocity.y = this.grounded && this.velocity.y <= 0 ? -2 : this.velocity.y - 22 * dt;

    const desired = { x: this.velocity.x * dt, y: this.velocity.y * dt, z: this.velocity.z * dt };
    this.controller.computeColliderMovement(this.collider, desired);
    const moved = this.controller.computedMovement();
    this.grounded = this.controller.computedGrounded();
    if (this.grounded && this.velocity.y < 0) this.velocity.y = 0;
    const centre = this.body.translation();
    this.body.setNextKinematicTranslation({ x: centre.x + moved.x, y: centre.y + moved.y, z: centre.z + moved.z });
    this.position.set(centre.x + moved.x, centre.y + moved.y - centreToFeet, centre.z + moved.z);
    // Safety net: never sink through the terrain.
    const floor = context.ground(this.position.x, this.position.z);
    if (this.position.y < floor - 1.5) {
      this.position.y = floor + 0.1;
      this.body.setNextKinematicTranslation({ x: this.position.x, y: floor + 0.1 + centreToFeet, z: this.position.z });
    }
  }

  private turnTowards(targetYaw: number, rate: number, dt: number): void {
    this.yaw += angleDelta(this.yaw, targetYaw) * damp(rate, dt);
  }

  private startAttack(combo: number, context: PlayContext): void {
    this.combo = combo;
    this.comboQueued = false;
    this.hitThisSwing.clear();
    this.enter("attack");
    context.play("swing");
  }

  private startRoll(wishX: number, wishZ: number, wishLength: number, context: PlayContext): void {
    if (wishLength > 0.2) {
      this.rollDir.set(wishX / wishLength, wishZ / wishLength);
      this.yaw = Math.atan2(wishX, wishZ);
    } else {
      this.rollDir.set(Math.sin(this.yaw), Math.cos(this.yaw));
    }
    this.enter("roll");
    context.play("roll");
    context.dust.emit({ count: 8, position: this.position.clone().setY(this.position.y + 0.1), spread: 0.4, speed: 1.5, up: 0.6, gravity: 2, life: 0.6, size: 0.12, color: 0x6a5a48 });
  }

  private startFlare(context: PlayContext): void {
    if (this.oil < this.stats.flareCost) {
      context.toast("Your lantern needs oil. It refills slowly, or find a flask.");
      return;
    }
    this.oil -= this.stats.flareCost;
    this.flared = false;
    this.enter("flare");
  }

  /** The flare: a bright burst that stuns Shades, damages foes nearby and lights braziers. */
  private flareBurst(context: PlayContext): void {
    context.play("flare");
    context.flash(0xffe0a0, 0.45);
    context.shake(0.25);
    const centre = this.scratch2.copy(this.position).setY(this.position.y + 2.1);
    context.glow.emit({ count: 70, position: centre, spread: 0.3, speed: 9, up: 1.5, drag: 3, life: 0.9, size: 0.14, color: 0xffd27a, colorJitter: 0.2 });
    context.glow.emit({ count: 30, position: centre, spread: 2.5, speed: 1, up: 2, drag: 1, life: 1.4, size: 0.1, color: 0xfff0c0 });
    this.flarePulse = 1;
    context.flareAt(this.position);
    for (const target of context.hittables()) {
      if (!target.alive) continue;
      const distance = target.position().distanceTo(this.position);
      const flareTarget = target as Hittable & { onFlare?: (distance: number, context: PlayContext) => void };
      flareTarget.onFlare?.(distance, context);
    }
  }

  /** Brief lantern light boost after a flare (read by the game for the light). */
  flarePulse = 0;

  private sweepHits(context: PlayContext): void {
    const reach = this.combo === 2 ? 2.4 : 2.1;
    const arc = this.combo === 2 ? 1.5 : 2.6;
    const damage = comboDamage(this.stats.swordDamage, this.combo);
    for (const target of context.hittables()) {
      if (!target.alive || this.hitThisSwing.has(target)) continue;
      const at = target.position();
      if (Math.abs(at.y - this.position.y) > 2.6) continue;
      if (!inSwingArc(this.position, this.yaw, at, reach, arc, target.radius)) continue;
      this.hitThisSwing.add(target);
      const knock = this.combo === 2 ? 9 : 5;
      if (target.takeHit(damage, this.position, knock)) {
        context.play("hit");
        context.hitStop(this.combo === 2 ? 0.09 : 0.05);
        context.shake(this.combo === 2 ? 0.35 : 0.18);
        const spark = this.scratch.copy(at).lerp(this.position, 0.35).setY(this.position.y + 1.1);
        context.glow.emit({ count: 14, position: spark, spread: 0.1, speed: 5, up: 2, gravity: 9, drag: 2, life: 0.35, size: 0.07, color: 0xffe6a0 });
      }
    }
  }

  /** Per-frame visuals: interpolated placement, animation, lantern light, trail. */
  render(dt: number, alpha: number, context: PlayContext): void {
    this.animTime += dt;
    this.flarePulse = Math.max(0, this.flarePulse - dt * 1.6);
    const root = this.rig.root;
    root.position.lerpVectors(this.previous, this.position, alpha);
    root.rotation.y = this.yaw;
    const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    const run = clamp((horizontalSpeed - 2) / 3.5, 0, 1);

    let target;
    let rate = 14;
    switch (this.state) {
      case "attack":
        target = attackPose(this.combo, clamp(this.stateTime / attackDurations[this.combo], 0, 1));
        rate = 40;
        break;
      case "roll":
        target = rollPose(clamp(this.stateTime / rollDuration, 0, 1));
        rate = 60;
        break;
      case "hurt":
        target = hurtPose(clamp(this.stateTime / 0.38, 0, 1));
        rate = 30;
        break;
      case "flare":
        target = flarePose(clamp(this.stateTime / flareDuration, 0, 1));
        rate = 24;
        break;
      case "dead":
        target = deathPose(clamp(this.stateTime / 1.2, 0, 1));
        rate = 20;
        break;
      default:
        if (horizontalSpeed > 0.4) {
          this.stepPhase += dt * (6.5 + run * 4.5) * Math.min(1, horizontalSpeed / 2.5);
          target = locomotionPose(this.stepPhase, run);
          const sign = Math.sign(Math.sin(this.stepPhase));
          if (sign !== this.lastStepSign) {
            this.lastStepSign = sign;
            context.play("step");
            if (run > 0.5) context.dust.emit({ count: 2, position: this.position.clone().setY(this.position.y + 0.05), spread: 0.2, speed: 0.6, up: 0.4, gravity: 1, life: 0.5, size: 0.08, color: 0x5a4d3e });
          }
        } else {
          target = idlePose(this.animTime);
        }
    }
    this.rig.blendTo(target, rate, dt);
    this.rig.apply(dt, this.animTime, run);
    // Blink while invulnerable after a hit.
    root.visible = !(this.invulnerable > 0 && this.state !== "dead" && Math.floor(this.invulnerable * 16) % 2 === 0);

    if (this.rig.lantern) {
      this.rig.lantern.core.getWorldPosition(this.lanternLight.position);
      const flicker = 1 + Math.sin(this.animTime * 11) * 0.04 + Math.sin(this.animTime * 23) * 0.03;
      const oilFactor = 0.55 + 0.45 * (this.oil / this.stats.maxOil);
      this.lanternLight.intensity = (8 * oilFactor + this.flarePulse * 40) * flicker;
      this.lanternLight.distance = 13 + this.flarePulse * 12;
      this.rig.lantern.glow.scale.setScalar(0.7 + this.flarePulse * 2.5);
    }

    const blade = this.rig.held?.getObjectByName("blade");
    if (blade && this.rig.held) {
      const tipOffset = (this.rig.held.userData.tipOffset as number) ?? -0.87;
      const base = this.rig.held.localToWorld(this.scratch.set(0, -0.12, 0));
      const tip = this.rig.held.localToWorld(this.scratch2.set(0, tipOffset, 0));
      const progress = this.state === "attack" ? this.stateTime / attackDurations[this.combo] : 0;
      this.trail.update(dt, base, tip, this.state === "attack" && progress > 0.2 && progress < 0.62);
    }
  }

  removeBody(physics: Physics): void {
    if (this.controller) physics.world.removeCharacterController(this.controller);
    if (this.body) physics.world.removeRigidBody(this.body);
    this.body = null;
    this.collider = null;
    this.controller = null;
  }

  toggleLock(candidates: Hittable[], cameraYaw: number): void {
    if (this.lockTarget) {
      this.lockTarget = null;
      return;
    }
    let best: Hittable | null = null;
    let bestScore = Infinity;
    for (const candidate of candidates) {
      if (!candidate.alive) continue;
      const at = candidate.position();
      const distance = at.distanceTo(this.position);
      if (distance > 16) continue;
      const facing = Math.abs(angleDelta(cameraYaw, yawTowards(this.position, at)));
      const score = distance + facing * 6;
      if (score < bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    this.lockTarget = best;
  }

  get deathTime(): number {
    return this.state === "dead" ? this.stateTime : 0;
  }
}
