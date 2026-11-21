// The "2010 console on an HD telly" filter.
//
// 1. The scene renders at a low internal resolution (480 lines, no MSAA) and
//    the canvas is stretched to the window with bilinear filtering: soft,
//    slightly smeary edges with visible jaggies, like 480p upscaled.
// 2. A wide, hot bloom on bright areas (sky, sun on stone, white shirts).
// 3. One grading pass: warm lift/gain grade, a touch of desaturation, soft
//    "component cable" horizontal blur with a hint of colour bleed, film grain,
//    a vignette, and 6-bit-per-channel output with a 4x4 ordered dither (the
//    console's framebuffer format), which gives faint banding in the sky.

import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import type { CourtPalette } from "../config/theme";

export const internalLines = 480;

const gradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    resolution: { value: new THREE.Vector2(854, 480) },
    time: { value: 0 },
    lift: { value: new THREE.Vector3(0.03, 0.025, 0.02) },
    gain: { value: new THREE.Vector3(1.06, 1.0, 0.9) },
    saturation: { value: 0.92 },
    grain: { value: 0.045 },
    vignette: { value: 0.42 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float time;
    uniform vec3 lift;
    uniform vec3 gain;
    uniform float saturation;
    uniform float grain;
    uniform float vignette;
    varying vec2 vUv;

    float bayer4(vec2 p) {
      vec2 q = mod(floor(p), 4.0);
      int index = int(q.x) + int(q.y) * 4;
      float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
      for (int i = 0; i < 16; i++) if (i == index) return m[i] / 16.0 - 0.5;
      return 0.0;
    }

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 texel = 1.0 / resolution;
      // Soft analogue horizontal blur; red and blue bleed a little apart.
      vec3 centre = texture2D(tDiffuse, vUv).rgb;
      vec3 left = texture2D(tDiffuse, vUv - vec2(texel.x * 0.9, 0.0)).rgb;
      vec3 right = texture2D(tDiffuse, vUv + vec2(texel.x * 0.9, 0.0)).rgb;
      vec3 color = centre * 0.56 + (left + right) * 0.22;
      color.r = mix(color.r, texture2D(tDiffuse, vUv + vec2(texel.x * 1.2, 0.0)).r, 0.25);
      color.b = mix(color.b, texture2D(tDiffuse, vUv - vec2(texel.x * 1.2, 0.0)).b, 0.25);

      // Grade: lift the blacks toward warm brown, tint highlights, mute saturation.
      color = lift + color * (gain - lift);
      float luma = dot(color, vec3(0.299, 0.587, 0.114));
      color = mix(vec3(luma), color, saturation);
      // Gentle S-curve for that crunchy contrast.
      color = mix(color, color * color * (3.0 - 2.0 * color), 0.35);

      // Vignette.
      vec2 centred = vUv - 0.5;
      color *= 1.0 - dot(centred, centred) * vignette * 1.7;

      // Grain, luminance-weighted so the darks get grittier.
      float noise = hash(vUv * resolution + fract(time * 7.13) * 91.7) - 0.5;
      color += noise * grain * (1.15 - luma);

      // 6 bits per channel with ordered dither.
      float levels = 63.0;
      color = floor(color * levels + 0.5 + bayer4(gl_FragCoord.xy)) / levels;
      gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
  `,
};

export interface WiiLook {
  composer: EffectComposer;
  setPalette(palette: CourtPalette): void;
  resize(width: number, height: number): void;
  render(dt: number): void;
}

export function createWiiLook(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): WiiLook {
  // HalfFloat keeps the bloom from clipping; no MSAA, on purpose.
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.85, 0.72);
  composer.addPass(bloom);
  // Tone-map and convert to sRGB before grading so the grade works on display values.
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(gradeShader);
  composer.addPass(grade);

  let time = 0;
  return {
    composer,
    setPalette(palette) {
      grade.uniforms.lift.value.set(...palette.gradeLift);
      grade.uniforms.gain.value.set(...palette.gradeGain);
      grade.uniforms.saturation.value = palette.gradeSaturation;
    },
    resize(width, height) {
      // Fixed 480-line internal buffer, whatever the window size.
      const lines = Math.min(internalLines, Math.max(240, height));
      const internalWidth = Math.round((lines * width) / Math.max(1, height));
      renderer.setPixelRatio(1);
      renderer.setSize(internalWidth, lines, false);
      composer.setPixelRatio(1);
      composer.setSize(internalWidth, lines);
      grade.uniforms.resolution.value.set(internalWidth, lines);
    },
    render(dt) {
      time += dt;
      grade.uniforms.time.value = time;
      composer.render(dt);
    },
  };
}
