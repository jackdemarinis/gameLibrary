// Third-person orbit camera driven by the mouse/right stick (the hero faces wherever
// it looks), lock-on framing, wall collision against static geometry, and trauma shake.
import * as THREE from "three";
import { clamp, damp } from "../engine/rng";
import { angleDelta, yawTowards } from "../game/rules/combat";
import type { Physics } from "./physics";

export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(52, 16 / 9, 0.1, 600);
  yaw = 0;
  pitch = 0.32;
  private distance = 6.6;
  private currentDistance = 6.6;
  private trauma = 0;
  private readonly focus = new THREE.Vector3();
  private time = 0;

  snap(target: THREE.Vector3, yaw: number): void {
    this.yaw = yaw;
    this.pitch = 0.32;
    this.focus.copy(target).setY(target.y + 1.5);
    this.currentDistance = this.distance;
    this.place(this.focus, null);
  }

  shake(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  update(dt: number, target: THREE.Vector3, look: { x: number; y: number }, lock: THREE.Vector3 | null, physics: Physics | null): void {
    this.time += dt;
    this.yaw -= look.x;
    this.pitch = clamp(this.pitch + look.y, -0.25, 1.1);

    if (lock) {
      // Frame both: swing behind the hero, looking at the target.
      const toward = yawTowards(target, lock);
      this.yaw += angleDelta(this.yaw, toward) * damp(5, dt);
      this.pitch += (0.36 - this.pitch) * damp(3, dt);
    }

    const desiredFocus = new THREE.Vector3(target.x, target.y + 1.5, target.z);
    if (lock) desiredFocus.lerp(new THREE.Vector3(lock.x, lock.y + 1.2, lock.z), 0.25);
    this.focus.lerp(desiredFocus, damp(10, dt));
    this.place(this.focus, physics, dt);

    this.trauma = Math.max(0, this.trauma - dt * 1.8);
    const shake = this.trauma * this.trauma;
    if (shake > 0) {
      this.camera.position.x += Math.sin(this.time * 47) * shake * 0.35;
      this.camera.position.y += Math.sin(this.time * 53 + 1) * shake * 0.3;
      this.camera.rotation.z += Math.sin(this.time * 41 + 2) * shake * 0.04;
    }
  }

  private place(focus: THREE.Vector3, physics: Physics | null, dt = 1): void {
    const direction = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    let wanted = this.distance + this.pitch * 1.5;
    if (physics) {
      const hit = physics.castWorld(focus.x, focus.y, focus.z, direction.x, direction.y, direction.z, wanted + 0.3);
      wanted = Math.max(1.2, Math.min(wanted, hit - 0.3));
    }
    // Pull in instantly when blocked, ease back out.
    this.currentDistance = wanted < this.currentDistance ? wanted : this.currentDistance + (wanted - this.currentDistance) * damp(3, dt);
    this.camera.position.copy(focus).addScaledVector(direction, this.currentDistance);
    this.camera.lookAt(focus);
  }
}
