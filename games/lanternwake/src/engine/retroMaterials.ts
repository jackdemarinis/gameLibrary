// Materials with the late-90s console look: vertices snap to the low-res pixel grid
// (that slight wobble), and foliage can sway in the wind. Built on Lambert so fog and
// the point-light pool work unchanged.
import * as THREE from "three";

export const retroUniforms = {
  uSnap: { value: new THREE.Vector2(240, 135) },
  uTime: { value: 0 },
  /** See-through: geometry between the camera and the hero is screen-door dithered. */
  uCam: { value: new THREE.Vector3(0, 1000, 0) },
  uFocus: { value: new THREE.Vector3(0, 1001, 0) },
  uSeeThrough: { value: 0 },
};

const seeThroughFragment = /* glsl */ `
  {
    vec3 seg = uFocus - uCam;
    float along = clamp(dot(vRetroWorld - uCam, seg) / max(dot(seg, seg), 1e-4), 0.0, 1.0);
    float radial = length(vRetroWorld - (uCam + seg * along));
    float hide = (1.0 - smoothstep(0.8, 1.7, radial)) * (1.0 - smoothstep(0.72, 0.86, along)) * uSeeThrough;
    vec2 cell = mod(floor(gl_FragCoord.xy), 4.0);
    mat4 bayer = mat4(0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0) / 16.0;
    if (hide * 0.85 > bayer[int(cell.x)][int(cell.y)] + 0.03) discard;
  }
`;

export interface RetroOptions {
  /** Sway vertices by their height above the mesh origin (trees, grass, cloth). */
  wind?: number;
}

export function applyRetro<T extends THREE.Material>(material: T, options: RetroOptions = {}): T {
  const wind = options.wind ?? 0;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSnap = retroUniforms.uSnap;
    shader.uniforms.uTime = retroUniforms.uTime;
    shader.uniforms.uCam = retroUniforms.uCam;
    shader.uniforms.uFocus = retroUniforms.uFocus;
    shader.uniforms.uSeeThrough = retroUniforms.uSeeThrough;
    let vertex = `uniform vec2 uSnap;\nuniform float uTime;\nvarying vec3 vRetroWorld;\n${shader.vertexShader}`;
    if (wind > 0) {
      vertex = vertex.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 windOrigin = (modelMatrix * instanceMatrix[3]).xyz;
        #else
          vec3 windOrigin = modelMatrix[3].xyz;
        #endif
        float windPhase = uTime * 1.6 + windOrigin.x * 0.31 + windOrigin.z * 0.23;
        float windLift = max(position.y, 0.0);
        transformed.x += sin(windPhase) * ${wind.toFixed(3)} * windLift;
        transformed.z += cos(windPhase * 0.8) * ${(wind * 0.6).toFixed(3)} * windLift;`,
      );
    }
    vertex = vertex.replace(
      "#include <project_vertex>",
      `#include <project_vertex>
      #ifdef USE_INSTANCING
        vRetroWorld = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
      #else
        vRetroWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
      #endif
      gl_Position.xy = floor(gl_Position.xy / gl_Position.w * uSnap + 0.5) / uSnap * gl_Position.w;`,
    );
    shader.vertexShader = vertex;
    shader.fragmentShader = `uniform vec3 uCam;\nuniform vec3 uFocus;\nuniform float uSeeThrough;\nvarying vec3 vRetroWorld;\n${shader.fragmentShader.replace("void main() {", `void main() {\n${seeThroughFragment}`)}`;
  };
  material.customProgramCacheKey = () => `retro-${wind}`;
  return material;
}

export function lambert(parameters: THREE.MeshLambertMaterialParameters, options: RetroOptions = {}): THREE.MeshLambertMaterial {
  return applyRetro(new THREE.MeshLambertMaterial(parameters), options);
}

export function unlit(parameters: THREE.MeshBasicMaterialParameters, options: RetroOptions = {}): THREE.MeshBasicMaterial {
  return applyRetro(new THREE.MeshBasicMaterial(parameters), options);
}

const cache = new Map<string, THREE.Material>();

/** Share one material per key so draw state and shader programs are reused. */
export function cachedMaterial<T extends THREE.Material>(key: string, create: () => T): T {
  const existing = cache.get(key);
  if (existing) return existing as T;
  const material = create();
  cache.set(key, material);
  return material;
}

/** Rescale a BoxGeometry's UVs so its texture keeps a constant size in world metres. */
export function worldUvBox(width: number, height: number, depth: number, metresPerTile = 1): THREE.BoxGeometry {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const uv = geometry.getAttribute("uv") as THREE.BufferAttribute;
  // Face order: +x, -x, +y, -y, +z, -z; four vertices each.
  const faceSizes: Array<[number, number]> = [
    [depth, height],
    [depth, height],
    [width, depth],
    [width, depth],
    [width, height],
    [width, height],
  ];
  for (let face = 0; face < 6; face += 1) {
    const [u, v] = faceSizes[face];
    for (let corner = 0; corner < 4; corner += 1) {
      const index = face * 4 + corner;
      uv.setXY(index, (uv.getX(index) * u) / metresPerTile, (uv.getY(index) * v) / metresPerTile);
    }
  }
  return geometry;
}

/** Scale every UV of a geometry (for cylinders/cones that should tile their texture). */
export function scaleUv(geometry: THREE.BufferGeometry, u: number, v: number): THREE.BufferGeometry {
  const uv = geometry.getAttribute("uv") as THREE.BufferAttribute | undefined;
  if (!uv) return geometry;
  for (let index = 0; index < uv.count; index += 1) uv.setXY(index, uv.getX(index) * u, uv.getY(index) * v);
  return geometry;
}

/** Nudge vertices randomly (shared vertices move together) for organic low-poly shapes. */
export function jitterGeometry(geometry: THREE.BufferGeometry, amount: number, seed: number): THREE.BufferGeometry {
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  const offsets = new Map<string, [number, number, number]>();
  let state = seed;
  const next = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296 - 0.5;
  };
  for (let index = 0; index < position.count; index += 1) {
    const key = `${position.getX(index).toFixed(3)},${position.getY(index).toFixed(3)},${position.getZ(index).toFixed(3)}`;
    let offset = offsets.get(key);
    if (!offset) {
      offset = [next() * amount, next() * amount, next() * amount];
      offsets.set(key, offset);
    }
    position.setXYZ(index, position.getX(index) + offset[0], position.getY(index) + offset[1], position.getZ(index) + offset[2]);
  }
  geometry.computeVertexNormals();
  return geometry;
}
