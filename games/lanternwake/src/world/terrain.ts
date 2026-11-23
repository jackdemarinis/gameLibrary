// Builds an area's ground: a height-mapped grid split into one mesh per tile kind
// (grass, cobble, cliff...), with per-vertex tint for variation, plus the matching
// triangle data for the physics collider.
import * as THREE from "three";
import type { AreaDef, TileKind } from "../game/content/areaTypes";
import { textures } from "../engine/pixelTextures";
import { cachedMaterial, lambert } from "../engine/retroMaterials";
import { fbm } from "../engine/rng";

export interface TerrainBuild {
  group: THREE.Group;
  colliderVertices: Float32Array;
  colliderIndices: Uint32Array;
}

export function slopeAt(area: AreaDef, x: number, z: number): number {
  const e = 0.5;
  const dx = (area.height(x + e, z) - area.height(x - e, z)) / (2 * e);
  const dz = (area.height(x, z + e) - area.height(x, z - e)) / (2 * e);
  return Math.hypot(dx, dz);
}

function tileMaterial(kind: TileKind): THREE.Material {
  const tex = textures();
  const map: Record<TileKind, THREE.Texture> = {
    grass: tex.grass,
    grassForest: tex.grassForest,
    dirt: tex.dirt,
    cobble: tex.cobble,
    flagstone: tex.flagstone,
    shrineFloor: tex.shrineFloor,
    cliff: tex.cliff,
  };
  return cachedMaterial(`tile-${kind}`, () => lambert({ map: map[kind], vertexColors: true }));
}

export function buildTerrain(area: AreaDef): TerrainBuild {
  const half = area.size / 2;
  const cells = Math.round(area.size / area.cell);
  const step = area.size / cells;
  const verts = cells + 1;
  const heights = new Float32Array(verts * verts);
  for (let iz = 0; iz < verts; iz += 1) {
    for (let ix = 0; ix < verts; ix += 1) heights[iz * verts + ix] = area.height(-half + ix * step, -half + iz * step);
  }
  const heightAtVertex = (ix: number, iz: number) => heights[iz * verts + ix];

  // Smooth normals from the height grid.
  const normalAt = (ix: number, iz: number): THREE.Vector3 => {
    const left = heightAtVertex(Math.max(0, ix - 1), iz);
    const right = heightAtVertex(Math.min(cells, ix + 1), iz);
    const up = heightAtVertex(ix, Math.max(0, iz - 1));
    const down = heightAtVertex(ix, Math.min(cells, iz + 1));
    return new THREE.Vector3(left - right, 2 * step, up - down).normalize();
  };

  interface Bucket {
    positions: number[];
    normals: number[];
    uvs: number[];
    colors: number[];
    indices: number[];
  }
  const buckets = new Map<TileKind, Bucket>();
  const bucket = (kind: TileKind): Bucket => {
    let existing = buckets.get(kind);
    if (!existing) {
      existing = { positions: [], normals: [], uvs: [], colors: [], indices: [] };
      buckets.set(kind, existing);
    }
    return existing;
  };

  for (let iz = 0; iz < cells; iz += 1) {
    for (let ix = 0; ix < cells; ix += 1) {
      const cx = -half + (ix + 0.5) * step;
      const cz = -half + (iz + 0.5) * step;
      const centreHeight = area.height(cx, cz);
      const corners = [heightAtVertex(ix, iz), heightAtVertex(ix + 1, iz), heightAtVertex(ix, iz + 1), heightAtVertex(ix + 1, iz + 1)];
      const cellSlope = (Math.max(...corners) - Math.min(...corners)) / step;
      const kind = area.paint(cx, cz, centreHeight, cellSlope);
      const target = bucket(kind);
      const base = target.positions.length / 3;
      const vertical = kind === "cliff";
      for (const [ox, oz] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ]) {
        const vx = ix + ox;
        const vz = iz + oz;
        const x = -half + vx * step;
        const z = -half + vz * step;
        const y = heightAtVertex(vx, vz);
        target.positions.push(x, y, z);
        const normal = normalAt(vx, vz);
        target.normals.push(normal.x, normal.y, normal.z);
        if (vertical) target.uvs.push((x + z) / 4, y / 4);
        else target.uvs.push(x / 2, z / 2);
        const tint = 0.78 + fbm(x * 0.15, z * 0.15, 7) * 0.32 - Math.max(0, -y) * 0.05;
        target.colors.push(tint, tint, tint * (kind === "grass" ? 0.95 : 1));
      }
      target.indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    }
  }

  const group = new THREE.Group();
  for (const [kind, data] of buckets) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(data.positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(data.normals, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(data.uvs, 2));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(data.colors, 3));
    geometry.setIndex(data.indices);
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, tileMaterial(kind));
    mesh.name = `terrain-${kind}`;
    group.add(mesh);
  }

  // Collider: the shared height grid as one trimesh.
  const colliderVertices = new Float32Array(verts * verts * 3);
  for (let iz = 0; iz < verts; iz += 1) {
    for (let ix = 0; ix < verts; ix += 1) {
      const index = (iz * verts + ix) * 3;
      colliderVertices[index] = -half + ix * step;
      colliderVertices[index + 1] = heightAtVertex(ix, iz);
      colliderVertices[index + 2] = -half + iz * step;
    }
  }
  const colliderIndices = new Uint32Array(cells * cells * 6);
  let write = 0;
  for (let iz = 0; iz < cells; iz += 1) {
    for (let ix = 0; ix < cells; ix += 1) {
      const a = iz * verts + ix;
      const b = a + 1;
      const c = a + verts;
      const d = c + 1;
      colliderIndices.set([a, c, b, b, c, d], write);
      write += 6;
    }
  }
  return { group, colliderVertices, colliderIndices };
}

/** Terrain height sampled exactly as the mesh/collider triangulate it (bilinear-ish per cell). */
export function makeGroundSampler(area: AreaDef): (x: number, z: number) => number {
  const half = area.size / 2;
  const cells = Math.round(area.size / area.cell);
  const step = area.size / cells;
  return (x: number, z: number) => {
    const fx = Math.max(0, Math.min(cells - 1e-4, (x + half) / step));
    const fz = Math.max(0, Math.min(cells - 1e-4, (z + half) / step));
    const ix = Math.floor(fx);
    const iz = Math.floor(fz);
    const tx = fx - ix;
    const tz = fz - iz;
    const x0 = -half + ix * step;
    const z0 = -half + iz * step;
    const h00 = area.height(x0, z0);
    const h10 = area.height(x0 + step, z0);
    const h01 = area.height(x0, z0 + step);
    const h11 = area.height(x0 + step, z0 + step);
    // Matches the (a, c, b) / (b, c, d) split: the diagonal runs from b (1,0) to c (0,1).
    if (tx + tz <= 1) return h00 + (h10 - h00) * tx + (h01 - h00) * tz;
    return h11 + (h01 - h11) * (1 - tx) + (h10 - h11) * (1 - tz);
  };
}
