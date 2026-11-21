// Ball meshes, the on-ground aim guide and the scoring rings.

import * as THREE from "three";
import { balls, throwing, type ThrowStyle } from "../config/rules";
import { worldTheme } from "../config/theme";
import type { BallKind } from "../simulation/physics";

const steelMaterial = new THREE.MeshPhysicalMaterial({
  color: worldTheme.steel,
  metalness: 1,
  roughness: 0.18,
  clearcoat: 0.4,
  clearcoatRoughness: 0.1,
});
const jackMaterial = new THREE.MeshPhysicalMaterial({ color: worldTheme.jack, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 });
const bandMaterials = [worldTheme.teamA, worldTheme.teamB].map(
  (color) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 0.8, emissive: color, emissiveIntensity: 0.12 }),
);
const bouleGeometry = new THREE.SphereGeometry(balls.bouleRadius, 40, 28);
const jackGeometry = new THREE.SphereGeometry(balls.jackRadius, 28, 20);
const grooveGeometry = new THREE.TorusGeometry(balls.bouleRadius * 0.985, balls.bouleRadius * 0.06, 8, 48);

export function createBallMesh(kind: BallKind, team: number | null): THREE.Object3D {
  if (kind === "jack") {
    const jack = new THREE.Mesh(jackGeometry, jackMaterial);
    jack.castShadow = true;
    return jack;
  }

  const group = new THREE.Group();
  const sphere = new THREE.Mesh(bouleGeometry, steelMaterial);
  sphere.castShadow = true;
  group.add(sphere);

  // Three parallel inlaid grooves in the team colour, like engraved boules.
  const bandMaterial = bandMaterials[team === 1 ? 1 : 0];
  for (const offset of [-0.42, 0, 0.42]) {
    const band = new THREE.Mesh(grooveGeometry, bandMaterial);
    const ringScale = Math.sqrt(1 - offset * offset);
    band.scale.set(ringScale, ringScale, 1);
    band.position.z = offset * balls.bouleRadius;
    group.add(band);
  }
  return group;
}

// Rotates a ball mesh as if it rolled along the ground displacement (dx, dz).
export function rollMesh(mesh: THREE.Object3D, dx: number, dz: number, radius: number): void {
  const distance = Math.hypot(dx, dz);
  if (distance < 1e-6) return;
  const axis = new THREE.Vector3(-dz, 0, dx).normalize();
  const spin = new THREE.Quaternion().setFromAxisAngle(axis, -distance / radius);
  mesh.quaternion.premultiply(spin);
}

export interface AimGuide {
  root: THREE.Group;
  setAim(aimRadians: number, style: ThrowStyle): void;
  setPowerMarker(distance: number | null): void;
  setVisible(visible: boolean): void;
}

export function createAimGuide(): AimGuide {
  const root = new THREE.Group();
  const dotGeometry = new THREE.CircleGeometry(0.045, 12);
  const dotMaterial = new THREE.MeshBasicMaterial({ color: worldTheme.aimRoll, transparent: true, opacity: 0.85, depthWrite: false });
  const dots: THREE.Mesh[] = [];
  for (let distance = throwing.minDistance; distance <= throwing.maxDistance; distance += 0.5) {
    const dot = new THREE.Mesh(dotGeometry, dotMaterial);
    dot.rotation.x = -Math.PI / 2;
    dot.position.set(0, 0.012, -distance);
    const isMetre = Math.abs(distance - Math.round(distance)) < 1e-6;
    dot.scale.setScalar(isMetre ? 1.3 : 0.75);
    dots.push(dot);
  }
  const line = new THREE.Group();
  line.add(...dots);
  root.add(line);

  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.16, 0.24, 32),
    new THREE.MeshBasicMaterial({ color: worldTheme.aimLob, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide }),
  );
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = 0.015;
  line.add(marker);
  marker.visible = false;

  return {
    root,
    setAim(aimRadians, style) {
      line.rotation.y = aimRadians;
      dotMaterial.color.setHex(style === "lob" ? worldTheme.aimLob : worldTheme.aimRoll);
    },
    setPowerMarker(distance) {
      marker.visible = distance !== null;
      if (distance !== null) marker.position.z = -distance;
    },
    setVisible(visible) {
      root.visible = visible;
    },
  };
}

export function createScoreRing(team: number): THREE.Mesh {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(balls.bouleRadius * 1.5, balls.bouleRadius * 2.1, 32),
    new THREE.MeshBasicMaterial({
      color: team === 1 ? worldTheme.teamB : worldTheme.teamA,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  return ring;
}
