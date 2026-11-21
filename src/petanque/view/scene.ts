// The 3D stage: renderer, camera, lights and the current court, drawn through
// the 2010-console filter in wiiLook.ts. Courts live in view/courts/.

import * as THREE from "three";
import type { CourtId } from "../content/courts";
import { createSeaside } from "./courts/seaside";
import type { CourtScene, SpectatorSpot } from "./courts/shared";
import { createVillageSquare } from "./courts/villageSquare";
import { rimUniforms } from "./materials";
import { createWiiLook } from "./wiiLook";

export type { SpectatorSpot } from "./courts/shared";

export interface StageView {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  courtId: CourtId;
  spectatorSpots: SpectatorSpot[];
  setCourt(id: CourtId): void;
  update(dt: number): void;
  render(dt: number): void;
  resize(): void;
}

const courtBuilders: Record<CourtId, () => CourtScene> = {
  villageSquare: createVillageSquare,
  seaside: createSeaside,
};

export function createStage(container: HTMLElement): StageView {
  // No antialiasing: the jaggies are part of the look; the filter softens them.
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
  renderer.shadowMap.enabled = true;
  // Hard-edged PCF at a modest resolution: crisp, slightly stair-stepped shadows.
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.domElement.classList.add("ppCanvas");
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.05, 1500);
  camera.position.set(0, 2, 4);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 0.8);
  const sun = new THREE.DirectionalLight(0xffffff, 2.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -24;
  sun.shadow.camera.right = 24;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -30;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 140;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(hemi, sun, sun.target);

  const look = createWiiLook(renderer, scene, camera);

  let court: CourtScene | null = null;
  const builtCourts = new Map<CourtId, CourtScene>();

  const stage: StageView = {
    renderer,
    scene,
    camera,
    courtId: "villageSquare",
    spectatorSpots: [],
    setCourt(id) {
      if (court && stage.courtId === id) return;
      if (court) scene.remove(court.group);
      let next = builtCourts.get(id);
      if (!next) {
        next = courtBuilders[id]();
        builtCourts.set(id, next);
      }
      court = next;
      stage.courtId = id;
      stage.spectatorSpots = next.spectatorSpots;
      scene.add(next.group);
      const palette = next.palette;
      scene.fog = new THREE.Fog(palette.fog, palette.fogNear, palette.fogFar);
      hemi.color.setHex(palette.hemiSky);
      hemi.groundColor.setHex(palette.hemiGround);
      hemi.intensity = palette.hemiIntensity;
      sun.color.setHex(palette.sun);
      sun.intensity = palette.sunIntensity;
      const focus = new THREE.Vector3(0, 0, -7);
      sun.position.copy(next.sunDirection).multiplyScalar(60).add(focus);
      sun.target.position.copy(focus);
      rimUniforms.rimColor.value.setHex(palette.rim);
      look.setPalette(palette);
    },
    resize() {
      const width = container.clientWidth;
      const height = container.clientHeight;
      look.resize(width, height);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
    },
    render(dt) {
      look.render(dt);
    },
    update(dt) {
      clock += dt;
      court?.update(dt, clock);
    },
  };
  let clock = 0;

  stage.setCourt("villageSquare");
  stage.resize();
  return stage;
}
