// Village Square: a sun-baked cobbled square lined with plane trees and old
// town houses, a café terrace on one side, a fountain and a bell tower at the
// far end. High noon, hard shadows, dappled light under the trees.

import * as THREE from "three";
import { courtPalettes, worldTheme } from "../../config/theme";
import { wiiMaterial } from "../materials";
import { clockTexture, pavingTextures, seeded, waterTexture, woodTexture } from "../textures";
import { addHouseRow, buildCafeTable, buildHouse, townMaterials } from "./buildings";
import {
  addBench,
  addLamp,
  addPlaneTree,
  Batcher,
  createBunting,
  createHills,
  createPaving,
  createSky,
  createTerrain,
  flutter,
  type CourtScene,
  type SpectatorSpot,
} from "./shared";

export function createVillageSquare(): CourtScene {
  const palette = courtPalettes.villageSquare;
  const group = new THREE.Group();
  const batcher = new Batcher();
  const sunDirection = new THREE.Vector3(0.42, 0.82, 0.38).normalize();
  const m = townMaterials(palette);

  group.add(createSky(palette, sunDirection, 0.32));
  group.add(createTerrain(batcher));

  const { map, bump } = pavingTextures("cobble");
  group.add(createPaving(wiiMaterial(palette.paving, { map, bumpMap: bump, bumpScale: 2, sheen: 0.08 }), 30, 18, -44));
  // Kerbs where the square meets the house fronts.
  for (const side of [-1, 1]) {
    batcher.add("kerb", m.stoneDark, new THREE.BoxGeometry(0.3, 0.14, 58), { x: side * 12.4, y: 0.07, z: -13 }, { tile: 1.5 });
    batcher.add("pavement", m.stone, new THREE.BoxGeometry(1.4, 0.12, 58), { x: side * 13.2, y: 0.06, z: -13 }, { tile: 2 });
  }

  // Street fronts on all four sides.
  addHouseRow(batcher, palette, new THREE.Vector3(-13.9, 0, 17), new THREE.Vector3(0, 0, -1), 56, Math.PI / 2, 3, [
    { sign: "CAFÉ DES AMIS", awning: palette.awnings[0] },
    { sign: "BOULANGERIE", awning: palette.awnings[1] },
    { sign: "TABAC", awning: palette.awnings[2] },
  ]);
  addHouseRow(batcher, palette, new THREE.Vector3(13.9, 0, -39), new THREE.Vector3(0, 0, 1), 56, -Math.PI / 2, 5, [
    { sign: "PRIMEUR", awning: palette.awnings[2] },
    { sign: "PHARMACIE", awning: palette.awnings[1] },
  ]);
  addHouseRow(batcher, palette, new THREE.Vector3(-13.9, 0, -40), new THREE.Vector3(1, 0, 0), 10.2, 0, 7, []);
  addHouseRow(batcher, palette, new THREE.Vector3(3.7, 0, -40), new THREE.Vector3(1, 0, 0), 10.2, 0, 9, []);
  addHouseRow(batcher, palette, new THREE.Vector3(13.9, 0, 18), new THREE.Vector3(-1, 0, 0), 28, Math.PI, 11, []);

  // Church front and bell tower closing the far end.
  const church = buildHouse(palette, { width: 7.4, depth: 10, storeys: 3, wall: palette.stone, shutter: palette.shutters[2], seed: 77, shop: null });
  batcher.addObject("town", church, new THREE.Vector3(0, 0, -41), 0);
  const tower = new THREE.Group();
  const towerHeight = 21;
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(3.6, towerHeight, 3.6), m.stone);
  shaft.position.y = towerHeight / 2;
  shaft.userData.tile = 3;
  tower.add(shaft);
  for (let i = 0; i < 3; i++) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.25, 3.8), m.stoneDark);
    band.position.y = 6 + i * 6;
    band.userData.tile = 1.5;
    tower.add(band);
  }
  // Belfry openings on each face and a stepped pyramid cap.
  for (let face = 0; face < 4; face++) {
    const opening = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.6, 0.1), m.recess);
    const angle = (face * Math.PI) / 2;
    opening.position.set(Math.sin(angle) * 1.81, towerHeight - 2.2, Math.cos(angle) * 1.81);
    opening.rotation.y = angle;
    tower.add(opening);
  }
  const cap = new THREE.Mesh(new THREE.ConeGeometry(2.9, 3.6, 4), m.roof);
  cap.position.y = towerHeight + 1.8;
  cap.rotation.y = Math.PI / 4;
  tower.add(cap);
  const clock = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), wiiMaterial(0xffffff, { map: clockTexture(), sheen: 0.2 }));
  clock.position.set(0, towerHeight - 6.5, 1.82);
  tower.add(clock);
  tower.traverse((child) => (child.castShadow = true));
  batcher.addObject("tower", tower, new THREE.Vector3(0, 0, -47), 0);

  // Fountain: octagonal basin, column, upper bowl, animated water.
  const fountainZ = -25;
  const basin = new THREE.Group();
  const rimMesh = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.2, 0.65, 8, 1, true), m.stone);
  rimMesh.position.y = 0.32;
  const lip = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.14, 6, 8), m.stone);
  lip.rotation.x = Math.PI / 2;
  lip.rotation.z = Math.PI / 8;
  lip.position.y = 0.66;
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 1.9, 8), m.stone);
  column.position.y = 1.2;
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.3, 0.35, 12), m.stone);
  bowl.position.y = 2.1;
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), m.stone);
  finial.position.y = 2.55;
  basin.add(rimMesh, lip, column, bowl, finial);
  basin.traverse((child) => (child.castShadow = true));
  batcher.addObject("fountain", basin, new THREE.Vector3(0, 0, fountainZ), 0);
  const waterMap = waterTexture().clone();
  waterMap.needsUpdate = true;
  waterMap.repeat.set(3, 3);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(2.05, 8), wiiMaterial(palette.water, { bumpMap: waterMap, bumpScale: 3, sheen: 1 }));
  pool.rotation.x = -Math.PI / 2;
  pool.rotation.z = Math.PI / 8;
  pool.position.set(0, 0.52, fountainZ);
  group.add(pool);
  const spill = new THREE.Mesh(
    new THREE.CylinderGeometry(0.88, 1.05, 1.5, 16, 1, true),
    new THREE.MeshPhongMaterial({ color: worldTheme.spray, transparent: true, opacity: 0.32, shininess: 80, depthWrite: false, side: THREE.DoubleSide }),
  );
  spill.position.set(0, 1.25, fountainZ);
  group.add(spill);

  // Plane trees down both sides, with benches and lamps between them.
  const wood = wiiMaterial(worldTheme.benchWood, { map: woodTexture(), sheen: 0.2 });
  const glow = new THREE.MeshBasicMaterial({ color: worldTheme.lampGlow });
  let seed = 400;
  for (const side of [-1, 1]) {
    for (const z of [9, 3, -3, -9, -15, -21, -29, -35]) {
      addPlaneTree(batcher, palette, new THREE.Vector3(side * 6.6 + (seeded(seed)() - 0.5) * 0.6, 0, z), 1 + seeded(seed + 1)() * 0.25, seed++);
    }
    for (const z of [-1.5, -7, -12]) addBench(batcher, palette, wood, new THREE.Vector3(side * 3.5, 0, z), side < 0 ? -Math.PI / 2 : Math.PI / 2);
    for (const z of [4, -10, -22]) addLamp(batcher, palette, new THREE.Vector3(side * 4.8, 0, z), glow);
  }

  // Café terrace on the left, under the awnings.
  for (const [x, z, tableSeed] of [[-10.6, 13, 1], [-9.4, 10.8, 2], [-10.6, 7.5, 3], [-9.6, -2, 4], [-10.8, -5, 5], [-9.6, -24, 6], [-10.8, -27, 7]] as const) {
    const table = buildCafeTable(palette, palette.awnings[tableSeed % palette.awnings.length], tableSeed);
    batcher.addObject("cafe", table, new THREE.Vector3(x, 0, z), tableSeed);
  }

  // Bunting criss-crossing the square between the trees.
  const flags: THREE.Mesh[] = [];
  for (const [z1, z2, buntingSeed] of [[3, -3, 1], [-9, -15, 2], [-21, -29, 3]] as const) {
    const bunting = createBunting(new THREE.Vector3(-6.6, 5.4, z1), new THREE.Vector3(6.6, 5.4, z2), palette.bunting, buntingSeed);
    group.add(bunting.group);
    flags.push(...bunting.flags);
  }

  // Hills and a ring of cypresses beyond the rooftops.
  group.add(createHills(worldTheme.hillDistant, worldTheme.hillCrest, 160, 26, 5, [-Math.PI * 0.95, Math.PI * 0.95]));

  group.add(batcher.build());

  const spectatorSpots: SpectatorSpot[] = [];
  for (const side of [-1, 1]) {
    for (const z of [0.4, -4.2, -9.4, -13.6]) {
      spectatorSpots.push({ position: new THREE.Vector3(side * 4.3, 0, z), facing: side < 0 ? -Math.PI / 2 : Math.PI / 2 });
    }
  }
  spectatorSpots.push(
    { position: new THREE.Vector3(-8.2, 0, -3.5), facing: -Math.PI / 2 - 0.2 },
    { position: new THREE.Vector3(8.4, 0, -6), facing: Math.PI / 2 + 0.25 },
    { position: new THREE.Vector3(-1.8, 0, -17.5), facing: Math.PI - 0.2 },
    { position: new THREE.Vector3(2.2, 0, -18), facing: Math.PI + 0.3 },
  );

  return {
    group,
    palette,
    sunDirection,
    spectatorSpots,
    update(_dt, clock) {
      waterMap.offset.set(clock * 0.03, clock * 0.05);
      spill.scale.set(1, 1 + Math.sin(clock * 9) * 0.02, 1);
      flutter(flags, clock);
    },
  };
}
