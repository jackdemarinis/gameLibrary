// Materials in the style of 2010-era console hardware: per-pixel Blinn-Phong
// with a tight specular "sheen" on skin, plastic and cloth, plus a fresnel rim
// light, the trick nearly every sports-party game of the time used to lift
// characters off the background. No PBR, no environment maps.

import * as THREE from "three";

export interface WiiMaterialOptions {
  map?: THREE.Texture | null;
  bumpMap?: THREE.Texture | null;
  bumpScale?: number;
  // 0 = matte, 1 = glossy plastic.
  sheen?: number;
  rim?: number;
  transparent?: boolean;
  alphaTest?: number;
  side?: THREE.Side;
  vertexColors?: boolean;
  emissive?: number;
  emissiveIntensity?: number;
  flatShading?: boolean;
}

// The rim colour is shared by every material and set per court.
export const rimUniforms = {
  rimColor: { value: new THREE.Color(0xfff3dd) },
};

export function wiiMaterial(color: number, options: WiiMaterialOptions = {}): THREE.MeshPhongMaterial {
  const sheen = options.sheen ?? 0.25;
  const material = new THREE.MeshPhongMaterial({
    color,
    map: options.map ?? null,
    bumpMap: options.bumpMap ?? null,
    bumpScale: options.bumpScale ?? 1,
    specular: new THREE.Color().setScalar(0.04 + sheen * 0.32),
    shininess: 8 + sheen * 70,
    transparent: options.transparent ?? false,
    alphaTest: options.alphaTest ?? 0,
    side: options.side ?? THREE.FrontSide,
    vertexColors: options.vertexColors ?? false,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 1,
    flatShading: options.flatShading ?? false,
  });
  const rim = options.rim ?? 0;
  if (rim > 0) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.rimColor = rimUniforms.rimColor;
      shader.uniforms.rimStrength = { value: rim };
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform vec3 rimColor;\nuniform float rimStrength;")
        .replace(
          "#include <opaque_fragment>",
          `{
            float facing = 1.0 - saturate(dot(normalize(vViewPosition), normal));
            outgoingLight += rimColor * pow(facing, 3.0) * rimStrength * diffuseColor.rgb;
          }
          #include <opaque_fragment>`,
        );
    };
    material.customProgramCacheKey = () => "wiiRim";
  }
  return material;
}

export function shadowed<T extends THREE.Object3D>(object: T, cast = true, receive = true): T {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = cast;
      child.receiveShadow = receive;
    }
  });
  return object;
}

// Vertex-colour gradient (bottom -> top) baked into a geometry: cheap fake AO.
export function paintGradient(geometry: THREE.BufferGeometry, bottom: number, top: number, minY: number, maxY: number): THREE.BufferGeometry {
  const position = geometry.attributes.position;
  const colors: number[] = [];
  const low = new THREE.Color(bottom);
  const high = new THREE.Color(top);
  const mixed = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const t = THREE.MathUtils.clamp((position.getY(i) - minY) / (maxY - minY), 0, 1);
    mixed.copy(low).lerp(high, t);
    colors.push(mixed.r, mixed.g, mixed.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}
