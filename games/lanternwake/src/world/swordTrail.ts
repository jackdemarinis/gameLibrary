// A ribbon that follows the blade during swings: the last few base/tip positions
// stitched into a strip that fades toward its tail.
import * as THREE from "three";

const segments = 10;

export class SwordTrail {
  readonly mesh: THREE.Mesh;
  private readonly bases: THREE.Vector3[] = [];
  private readonly tips: THREE.Vector3[] = [];
  private readonly positions: Float32Array;
  private readonly alphas: Float32Array;
  private readonly geometry = new THREE.BufferGeometry();
  private strength = 0;

  constructor(color: number) {
    this.positions = new Float32Array(segments * 2 * 3);
    this.alphas = new Float32Array(segments * 2);
    this.geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute("alpha", new THREE.BufferAttribute(this.alphas, 1).setUsage(THREE.DynamicDrawUsage));
    const indices: number[] = [];
    for (let index = 0; index < segments - 1; index += 1) {
      const a = index * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    this.geometry.setIndex(indices);
    const material = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) } },
      vertexShader: `attribute float alpha; varying float vAlpha; void main(){ vAlpha = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 uColor; varying float vAlpha; void main(){ gl_FragColor = vec4(uColor, vAlpha); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
  }

  /** Feed the blade's current world base/tip; `active` while the swing is live. */
  update(dt: number, base: THREE.Vector3, tip: THREE.Vector3, active: boolean): void {
    this.strength += ((active ? 1 : 0) - this.strength) * Math.min(1, dt * (active ? 30 : 10));
    if (active || this.bases.length === 0) {
      this.bases.unshift(base.clone());
      this.tips.unshift(tip.clone());
    } else {
      this.bases.unshift(this.bases[0].clone());
      this.tips.unshift(this.tips[0].clone());
    }
    if (this.bases.length > segments) {
      this.bases.length = segments;
      this.tips.length = segments;
    }
    for (let index = 0; index < segments; index += 1) {
      const b = this.bases[Math.min(index, this.bases.length - 1)];
      const t = this.tips[Math.min(index, this.tips.length - 1)];
      this.positions.set([b.x, b.y, b.z], index * 6);
      this.positions.set([t.x, t.y, t.z], index * 6 + 3);
      const fade = (1 - index / (segments - 1)) * this.strength;
      this.alphas[index * 2] = fade * 0.15;
      this.alphas[index * 2 + 1] = fade * 0.75;
    }
    this.geometry.getAttribute("position").needsUpdate = true;
    this.geometry.getAttribute("alpha").needsUpdate = true;
    this.mesh.visible = this.strength > 0.02;
  }
}
