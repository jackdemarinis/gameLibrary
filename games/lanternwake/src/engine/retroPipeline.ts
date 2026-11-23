// Renders the scene into a small 16:9 target, then a post pass soft-tonemaps it,
// quantises to 15-bit colour with ordered dithering and adds a vignette. The canvas
// keeps that low resolution and CSS scales it up with crisp pixels.
import * as THREE from "three";
import { retroUniforms } from "./retroMaterials";

export const renderWidth = 480;
export const renderHeight = 270;

const postVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const postFragment = /* glsl */ `
  uniform sampler2D tScene;
  uniform vec2 uRes;
  uniform float uFade;
  uniform vec4 uFlash;
  uniform float uLevels;
  varying vec2 vUv;

  const float bayer[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);

  void main() {
    vec3 color = texture2D(tScene, vUv).rgb;
    // Soft shoulder so lantern hot-spots roll off instead of clipping.
    color = color / (1.0 + color * 0.22);
    color = pow(max(color, vec3(0.0)), vec3(1.0 / 2.2));
    // Grade: cool the shadows a touch, warm the highlights.
    float luma = dot(color, vec3(0.299, 0.587, 0.114));
    color = mix(color * vec3(0.92, 0.97, 1.12), color * vec3(1.06, 1.0, 0.9), smoothstep(0.15, 0.7, luma));
    color = mix(color, uFlash.rgb, uFlash.a);
    vec2 pixel = floor(vUv * uRes);
    int index = int(mod(pixel.y, 4.0)) * 4 + int(mod(pixel.x, 4.0));
    float threshold = (bayer[index] + 0.5) / 16.0 - 0.5;
    color = floor(color * uLevels + threshold + 0.5) / uLevels;
    vec2 centred = vUv - 0.5;
    color *= 1.0 - 0.55 * pow(length(centred * vec2(1.0, 0.8)) * 1.25, 2.6);
    color *= 1.0 - uFade;
    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  }
`;

export class RetroPipeline {
  readonly renderer: THREE.WebGLRenderer;
  readonly canvas: HTMLCanvasElement;
  private readonly target: THREE.WebGLRenderTarget;
  private readonly postScene = new THREE.Scene();
  private readonly postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly postMaterial: THREE.ShaderMaterial;

  constructor(parent: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(renderWidth, renderHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.canvas = this.renderer.domElement;
    this.canvas.className = "retroCanvas";
    parent.appendChild(this.canvas);

    this.target = new THREE.WebGLRenderTarget(renderWidth, renderHeight, {
      type: THREE.HalfFloatType,
      magFilter: THREE.NearestFilter,
      minFilter: THREE.NearestFilter,
      depthBuffer: true,
    });
    this.postMaterial = new THREE.ShaderMaterial({
      vertexShader: postVertex,
      fragmentShader: postFragment,
      uniforms: {
        tScene: { value: this.target.texture },
        uRes: { value: new THREE.Vector2(renderWidth, renderHeight) },
        uFade: { value: 0 },
        uFlash: { value: new THREE.Vector4(1, 0.2, 0.15, 0) },
        uLevels: { value: 31 },
      },
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMaterial);
    quad.frustumCulled = false;
    this.postScene.add(quad);
    retroUniforms.uSnap.value.set(renderWidth / 2, renderHeight / 2);
  }

  /** 0 = clear, 1 = black. */
  set fade(value: number) {
    this.postMaterial.uniforms.uFade.value = Math.max(0, Math.min(1, value));
  }

  get fade(): number {
    return this.postMaterial.uniforms.uFade.value as number;
  }

  /** Full-screen colour wash (damage flashes, flare bursts). */
  flash(color: THREE.Color, amount: number): void {
    const flash = this.postMaterial.uniforms.uFlash.value as THREE.Vector4;
    flash.set(color.r, color.g, color.b, Math.max(0, Math.min(1, amount)));
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCamera);
  }
}
