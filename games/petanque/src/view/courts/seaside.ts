// Seaside Promenade: a sandstone promenade with palms, pastel houses on one
// side and the sea wall, beach and bay on the other. Low golden-hour sun over
// the water, a lighthouse on the point, boats bobbing, festoon lights.

import * as THREE from "three";
import { courtPalettes, worldTheme } from "../../config/theme";
import { wiiMaterial } from "../materials";
import { awningTexture, barkTexture, foliageTexture, grassTexture, pavingTextures, plasterTexture, seeded, waterTexture, woodTexture } from "../textures";
import { addHouseRow, buildCafeTable, townMaterials } from "./buildings";
import { addBench, Batcher, createBunting, createHills, createPaving, createSky, createTerrain, flutter, type CourtScene, type SpectatorSpot } from "./shared";

const seaLevel = -2.2;
const wallX = 8.4;

function addPalm(batcher: Batcher, position: THREE.Vector3, height: number, seed: number, palette: typeof courtPalettes.seaside): void {
  const random = seeded(seed);
  const bark = wiiMaterial(palette.bark, { map: barkTexture("palm"), sheen: 0.1 });
  const frond = wiiMaterial(palette.leaves, { map: foliageTexture("palm"), alphaTest: 0.4, side: THREE.DoubleSide, sheen: 0.2 });
  const lean = new THREE.Vector3(random() - 0.5, 0, random() - 0.5).normalize().multiplyScalar(0.8 + random() * 0.8);
  const curve = new THREE.QuadraticBezierCurve3(
    position.clone(),
    position.clone().add(new THREE.Vector3(lean.x * 0.2, height * 0.55, lean.z * 0.2)),
    position.clone().add(new THREE.Vector3(lean.x, height, lean.z)),
  );
  const trunk = new THREE.TubeGeometry(curve, 10, 0.17, 7, false);
  // Taper the tube toward the crown.
  const positions = trunk.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const t = Math.floor(i / 8) / 10;
    const centre = curve.getPoint(t);
    const offset = new THREE.Vector3(positions.getX(i), positions.getY(i), positions.getZ(i)).sub(centre).multiplyScalar(1.25 - t * 0.5);
    positions.setXYZ(i, centre.x + offset.x, centre.y + offset.y, centre.z + offset.z);
  }
  trunk.computeVertexNormals();
  batcher.add("palmBark", bark, trunk, { x: 0, y: 0, z: 0 });
  const crown = curve.getPoint(1);
  // Fronds: long bent strips radiating from the crown.
  for (let i = 0; i < 11; i++) {
    const geometry = new THREE.PlaneGeometry(1.1, 3.0, 1, 6);
    const frondPositions = geometry.attributes.position;
    for (let v = 0; v < frondPositions.count; v++) {
      const y = frondPositions.getY(v) + 1.5;
      frondPositions.setXYZ(v, frondPositions.getX(v), y, -0.18 * y * y);
    }
    geometry.computeVertexNormals();
    const yaw = (i / 11) * Math.PI * 2 + random() * 0.3;
    const pitch = -0.9 - random() * 0.5;
    batcher.add("palmFronds", frond, geometry, crown, { rotation: [pitch, yaw, 0] });
  }
  const coconut = wiiMaterial(worldTheme.coconut, { sheen: 0.3 });
  for (let i = 0; i < 4; i++) {
    const angle = random() * Math.PI * 2;
    batcher.add("coconut", coconut, new THREE.SphereGeometry(0.11, 6, 5), {
      x: crown.x + Math.cos(angle) * 0.18,
      y: crown.y - 0.2,
      z: crown.z + Math.sin(angle) * 0.18,
    });
  }
}

function createBoat(seed: number): THREE.Group {
  const random = seeded(seed);
  const boat = new THREE.Group();
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-2, 0.4);
  hullShape.quadraticCurveTo(-1.6, -0.3, 0, -0.35);
  hullShape.quadraticCurveTo(1.8, -0.3, 2.4, 0.5);
  hullShape.lineTo(-2, 0.5);
  const hull = new THREE.Mesh(
    new THREE.ExtrudeGeometry(hullShape, { depth: 1.2, bevelEnabled: false }),
    wiiMaterial(random() < 0.5 ? worldTheme.hull : worldTheme.hullBlue, { sheen: 0.5 }),
  );
  hull.position.z = -0.6;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 5, 5), wiiMaterial(worldTheme.benchWood, { sheen: 0.2 }));
  mast.position.set(0.1, 2.9, 0);
  const sailShape = new THREE.Shape();
  sailShape.moveTo(0, 0);
  sailShape.lineTo(0, 4.2);
  sailShape.lineTo(2.0, 0.2);
  sailShape.closePath();
  const sail = new THREE.Mesh(new THREE.ShapeGeometry(sailShape), wiiMaterial(worldTheme.sail, { side: THREE.DoubleSide, sheen: 0.1 }));
  sail.position.set(0.15, 0.8, 0);
  boat.add(hull, mast, sail);
  boat.traverse((child) => (child.castShadow = true));
  return boat;
}

function createLighthouse(palette: typeof courtPalettes.seaside): THREE.Group {
  const lighthouse = new THREE.Group();
  const rock = wiiMaterial(worldTheme.rock, { flatShading: true, sheen: 0.05 });
  const base = new THREE.Mesh(new THREE.IcosahedronGeometry(6, 1), rock);
  base.scale.set(1.6, 0.55, 1.2);
  lighthouse.add(base);
  const white = wiiMaterial(worldTheme.lighthouse, { sheen: 0.25 });
  const red = wiiMaterial(worldTheme.lighthouseBand, { sheen: 0.25 });
  for (let i = 0; i < 5; i++) {
    const segment = new THREE.Mesh(new THREE.CylinderGeometry(1.6 - (i + 1) * 0.12, 1.6 - i * 0.12, 3, 14), i % 2 ? red : white);
    segment.position.y = 2.5 + i * 3;
    lighthouse.add(segment);
  }
  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.25, 14), wiiMaterial(palette.ironwork, { sheen: 0.4 }));
  gallery.position.y = 17.1;
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 1.6, 10), new THREE.MeshBasicMaterial({ color: worldTheme.lampGlow }));
  lamp.position.y = 18;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), red);
  dome.position.y = 18.8;
  lighthouse.add(gallery, lamp, dome);
  return lighthouse;
}

function createGull(): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([-0.6, 0.15, 0, 0, 0, 0.1, 0, 0, -0.1, 0.6, 0.15, 0, 0, 0, -0.1, 0, 0, 0.1], 3));
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: worldTheme.gull, side: THREE.DoubleSide }));
}

export function createSeaside(): CourtScene {
  const palette = courtPalettes.seaside;
  const group = new THREE.Group();
  const batcher = new Batcher();
  // Low sun over the bay, ahead and to the right of the thrower.
  const sunDirection = new THREE.Vector3(0.78, 0.2, -0.6).normalize();
  const m = townMaterials(palette);

  group.add(createSky(palette, sunDirection, 0.42));
  group.add(createTerrain(batcher));

  const { map, bump } = pavingTextures("slab");
  group.add(createPaving(wiiMaterial(palette.paving, { map, bumpMap: bump, bumpScale: 1.5, sheen: 0.1 }), 2 * wallX, 18, -60));
  // Pavement strip in front of the houses on the left.
  batcher.add("pavement", m.stone, new THREE.BoxGeometry(2, 0.12, 80), { x: -9.6, y: 0.06, z: -20 }, { tile: 2 });

  // Sea wall with a stone cap and a white-painted railing.
  batcher.add("seaWall", m.stoneDark, new THREE.BoxGeometry(0.7, 0.75 - seaLevel, 80), { x: wallX + 0.35, y: (0.75 + seaLevel) / 2, z: -20 }, { tile: 2.5 });
  batcher.add("seaWallCap", m.stone, new THREE.BoxGeometry(0.9, 0.14, 80), { x: wallX + 0.35, y: 0.8, z: -20 }, { tile: 1.5 });
  const railing = wiiMaterial(worldTheme.railing, { sheen: 0.5 });
  for (let z = 18; z > -60; z -= 1.6) {
    batcher.add("railing", railing, new THREE.CylinderGeometry(0.035, 0.04, 1.0, 6), { x: wallX + 0.35, y: 1.37, z });
  }
  for (const y of [1.3, 1.82]) {
    batcher.add("railing", railing, new THREE.CylinderGeometry(0.03, 0.03, 80, 6), { x: wallX + 0.35, y, z: -20 }, { rotation: [Math.PI / 2, 0, 0] });
  }

  // Beach below the wall, foam line, and the sea.
  const sandMap = plasterTexture().clone();
  sandMap.needsUpdate = true;
  sandMap.repeat.set(8, 60);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(26, 200), wiiMaterial(worldTheme.sand, { map: sandMap, sheen: 0.02 }));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(wallX + 13, seaLevel + 0.05, -30);
  sand.receiveShadow = true;
  group.add(sand);
  const waterMap = waterTexture().clone();
  waterMap.needsUpdate = true;
  waterMap.repeat.set(120, 120);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(1200, 1200),
    wiiMaterial(palette.water, { bumpMap: waterMap, bumpScale: 4, sheen: 1 }),
  );
  (sea.material as THREE.MeshPhongMaterial).shininess = 160;
  (sea.material as THREE.MeshPhongMaterial).specular.setScalar(0.9);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(wallX + 620, seaLevel, -30);
  sea.receiveShadow = true;
  group.add(sea);
  const foamMap = waterTexture().clone();
  foamMap.needsUpdate = true;
  foamMap.repeat.set(1, 40);
  const foam = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 200),
    new THREE.MeshBasicMaterial({ color: worldTheme.foam, alphaMap: foamMap, transparent: true, opacity: 0.75, depthWrite: false }),
  );
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(wallX + 21, seaLevel + 0.08, -30);
  group.add(foam);

  // The point: hills across the bay and the lighthouse on its rock.
  group.add(createHills(worldTheme.headland, worldTheme.hillCrest, 230, 30, 9, [0.05, Math.PI * 0.75]));
  group.add(createHills(worldTheme.headlandFar, worldTheme.headland, 320, 44, 13, [-Math.PI * 0.6, 0.25]));
  const lighthouse = createLighthouse(palette);
  lighthouse.position.set(70, seaLevel, -95);
  lighthouse.traverse((child) => (child.castShadow = true));
  group.add(lighthouse);
  const boats = [createBoat(1), createBoat(2), createBoat(3), createBoat(4)];
  const boatSpots = [[34, -30, 0.4], [52, -12, 2.1], [46, -62, 1.2], [90, -40, -0.6]];
  boats.forEach((boat, index) => {
    const [x, z, yaw] = boatSpots[index];
    boat.position.set(x, seaLevel, z);
    boat.rotation.y = yaw;
    group.add(boat);
  });

  // Pastel houses with shops along the left.
  addHouseRow(batcher, palette, new THREE.Vector3(-10.6, 0, 18), new THREE.Vector3(0, 0, -1), 78, Math.PI / 2, 21, [
    { sign: "GLACES", awning: palette.awnings[0] },
    { sign: "CAFÉ DU PORT", awning: palette.awnings[2] },
    { sign: "POISSONNERIE", awning: palette.awnings[1] },
  ]);
  for (const [z, tableSeed] of [[10, 11], [7.6, 12], [-6, 13], [-9, 14], [-30, 15]] as const) {
    batcher.addObject("cafe", buildCafeTable(palette, palette.awnings[tableSeed % 3], tableSeed), new THREE.Vector3(-7.6, 0, z), tableSeed);
  }

  // Bandstand at the far end of the promenade.
  const bandstand = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.4, 0.6, 8), m.stone);
  deck.position.y = 0.3;
  bandstand.add(deck);
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 3, 6), railing);
    post.position.set(Math.cos(angle) * 2.9, 2.1, Math.sin(angle) * 2.9);
    bandstand.add(post);
  }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.7, 1.8, 8), wiiMaterial(worldTheme.bandstandRoof, { map: awningTexture(worldTheme.bandstandRoof), sheen: 0.2 }));
  roof.position.y = 4.5;
  bandstand.add(roof);
  bandstand.traverse((child) => (child.castShadow = true));
  batcher.addObject("bandstand", bandstand, new THREE.Vector3(-1.5, 0, -33), 0);

  // Palms on both sides, benches facing the terrain.
  let seed = 900;
  for (const z of [12, 4, -4, -12, -20, -28, -40]) addPalm(batcher, new THREE.Vector3(-5.6, 0, z + 1), 6.5 + seeded(seed)() * 2, seed++, palette);
  for (const z of [10, 1, -8, -17, -26, -38]) addPalm(batcher, new THREE.Vector3(6.6, 0, z), 6 + seeded(seed)() * 2.5, seed++, palette);
  const wood = wiiMaterial(worldTheme.benchWood, { map: woodTexture(), sheen: 0.2 });
  for (const z of [-1.5, -7, -12]) {
    addBench(batcher, palette, wood, new THREE.Vector3(-3.5, 0, z), -Math.PI / 2);
    addBench(batcher, palette, wood, new THREE.Vector3(3.5, 0, z), Math.PI / 2);
  }
  // Planters of rough grass at the palm feet.
  const planter = wiiMaterial(palette.leavesDark, { map: grassTexture(), sheen: 0.05 });
  for (const x of [-5.6, 6.6]) batcher.add("planter", planter, new THREE.CylinderGeometry(0.9, 0.9, 0.12, 10), { x, y: 0.06, z: -4 });

  // Festoon lights strung along the sea-side lamp posts.
  const iron = wiiMaterial(palette.ironwork, { sheen: 0.5 });
  const bulbs = new THREE.MeshBasicMaterial({ color: worldTheme.bulb });
  const posts = [14, 6, -2, -10, -18, -26, -34];
  for (const z of posts) {
    batcher.add("lampPosts", iron, new THREE.CylinderGeometry(0.05, 0.08, 4.2, 6), { x: 7.6, y: 2.1, z });
    batcher.add("lampPosts", iron, new THREE.SphereGeometry(0.12, 6, 4), { x: 7.6, y: 4.25, z });
  }
  for (let i = 0; i < posts.length - 1; i++) {
    const from = new THREE.Vector3(7.6, 4.1, posts[i]);
    const to = new THREE.Vector3(7.6, 4.1, posts[i + 1]);
    const curve = new THREE.QuadraticBezierCurve3(from, from.clone().lerp(to, 0.5).add(new THREE.Vector3(0, -0.8, 0)), to);
    batcher.add("festoonWire", iron, new THREE.TubeGeometry(curve, 12, 0.01, 3, false), { x: 0, y: 0, z: 0 }, { castShadow: false });
    for (let b = 1; b < 10; b++) {
      batcher.add("festoonBulbs", bulbs, new THREE.SphereGeometry(0.06, 6, 4), curve.getPoint(b / 10).add(new THREE.Vector3(0, -0.08, 0)), { castShadow: false });
    }
  }

  // Bunting from the houses to the palms.
  const flags: THREE.Mesh[] = [];
  for (const [z, buntingSeed] of [[2, 31], [-14, 32]] as const) {
    const bunting = createBunting(new THREE.Vector3(-10.6, 5.2, z), new THREE.Vector3(7.6, 4.1, z - 6), palette.bunting, buntingSeed);
    group.add(bunting.group);
    flags.push(...bunting.flags);
  }

  const gulls = Array.from({ length: 6 }, () => createGull());
  for (const gull of gulls) group.add(gull);

  group.add(batcher.build());

  const spectatorSpots: SpectatorSpot[] = [];
  for (const side of [-1, 1]) {
    for (const z of [0.4, -4.2, -9.4, -13.6]) {
      spectatorSpots.push({ position: new THREE.Vector3(side * 4.3, 0, z), facing: side < 0 ? -Math.PI / 2 : Math.PI / 2 });
    }
  }
  spectatorSpots.push(
    { position: new THREE.Vector3(7.4, 0, -5), facing: Math.PI / 2 + 0.3 },
    { position: new THREE.Vector3(-7.2, 0, -2.5), facing: -Math.PI / 2 - 0.3 },
    { position: new THREE.Vector3(-1.5, 0, -18), facing: Math.PI - 0.25 },
    { position: new THREE.Vector3(2, 0, -18.5), facing: Math.PI + 0.25 },
  );

  return {
    group,
    palette,
    sunDirection,
    spectatorSpots,
    update(_dt, clock) {
      waterMap.offset.set(clock * 0.004, clock * 0.011);
      foamMap.offset.set(0, clock * 0.02);
      (foam.material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.sin(clock * 0.9) * 0.2;
      boats.forEach((boat, index) => {
        boat.position.y = seaLevel + Math.sin(clock * 1.1 + index * 1.7) * 0.12;
        boat.rotation.z = Math.sin(clock * 0.9 + index) * 0.06;
        boat.rotation.x = Math.sin(clock * 0.7 + index * 2) * 0.04;
      });
      gulls.forEach((gull, index) => {
        const angle = clock * (0.18 + index * 0.03) + index * 1.3;
        gull.position.set(18 + Math.cos(angle) * (14 + index * 3), 14 + index * 1.5 + Math.sin(clock * 0.8 + index) * 1.2, -30 + Math.sin(angle) * (16 + index * 2));
        gull.rotation.y = -angle;
        gull.scale.y = 1 + Math.sin(clock * 6 + index) * 0.6;
      });
      flutter(flags, clock);
    },
  };
}
