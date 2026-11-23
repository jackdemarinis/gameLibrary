// One pooled point-sprite system for embers, sparks, wisps and dust. Each particle is a
// chunky square pixel (no size attenuation fuzz), additive or normal blended.
import * as THREE from "three";

interface Particle {
  life: number;
  maxLife: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  gravity: number;
  drag: number;
  size: number;
  r: number;
  g: number;
  b: number;
}

export interface EmitOptions {
  count: number;
  position: THREE.Vector3;
  spread?: number;
  speed?: number;
  up?: number;
  gravity?: number;
  drag?: number;
  life?: number;
  size?: number;
  color: THREE.Color | number;
  colorJitter?: number;
}

const vertexShader = /* glsl */ `
  attribute float size;
  attribute vec3 tint;
  attribute float alpha;
  varying vec3 vTint;
  varying float vAlpha;
  uniform vec2 uSnap;
  void main() {
    vTint = tint;
    vAlpha = alpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_Position.xy = floor(gl_Position.xy / gl_Position.w * uSnap + 0.5) / uSnap * gl_Position.w;
    gl_PointSize = max(1.0, size * 260.0 / -mv.z);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vTint;
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4(vTint, vAlpha);
  }
`;

export class ParticleSystem {
  readonly points: THREE.Points;
  private readonly particles: Particle[] = [];
  private readonly capacity: number;
  private readonly positions: Float32Array;
  private readonly sizes: Float32Array;
  private readonly tints: Float32Array;
  private readonly alphas: Float32Array;
  private readonly geometry = new THREE.BufferGeometry();
  private readonly scratch = new THREE.Color();

  constructor(capacity: number, additive: boolean, snap: { value: THREE.Vector2 }) {
    this.capacity = capacity;
    this.positions = new Float32Array(capacity * 3);
    this.sizes = new Float32Array(capacity);
    this.tints = new Float32Array(capacity * 3);
    this.alphas = new Float32Array(capacity);
    this.geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute("size", new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute("tint", new THREE.BufferAttribute(this.tints, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute("alpha", new THREE.BufferAttribute(this.alphas, 1).setUsage(THREE.DynamicDrawUsage));
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: { uSnap: snap },
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geometry, material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  emit(options: EmitOptions): void {
    const base = options.color instanceof THREE.Color ? options.color : this.scratch.set(options.color);
    const spread = options.spread ?? 0.2;
    const speed = options.speed ?? 1;
    for (let index = 0; index < options.count; index += 1) {
      if (this.particles.length >= this.capacity) this.particles.shift();
      const angle = Math.random() * Math.PI * 2;
      const radial = Math.random();
      const jitter = options.colorJitter ?? 0.1;
      const life = (options.life ?? 0.8) * (0.6 + Math.random() * 0.6);
      this.particles.push({
        life,
        maxLife: life,
        x: options.position.x + Math.cos(angle) * spread * radial,
        y: options.position.y + (Math.random() - 0.5) * spread,
        z: options.position.z + Math.sin(angle) * spread * radial,
        vx: Math.cos(angle) * speed * (0.3 + Math.random()),
        vy: (options.up ?? 1) * (0.5 + Math.random()),
        vz: Math.sin(angle) * speed * (0.3 + Math.random()),
        gravity: options.gravity ?? 0,
        drag: options.drag ?? 1.5,
        size: (options.size ?? 0.08) * (0.7 + Math.random() * 0.6),
        r: base.r * (1 - jitter + Math.random() * jitter * 2),
        g: base.g * (1 - jitter + Math.random() * jitter * 2),
        b: base.b * (1 - jitter + Math.random() * jitter * 2),
      });
    }
  }

  update(dt: number): void {
    let write = 0;
    for (let read = 0; read < this.particles.length; read += 1) {
      const particle = this.particles[read];
      particle.life -= dt;
      if (particle.life <= 0) continue;
      const drag = Math.exp(-particle.drag * dt);
      particle.vx *= drag;
      particle.vz *= drag;
      particle.vy = particle.vy * drag - particle.gravity * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.z += particle.vz * dt;
      this.particles[write] = particle;
      write += 1;
    }
    this.particles.length = write;
    for (let index = 0; index < this.capacity; index += 1) {
      const particle = this.particles[index];
      if (!particle) {
        this.alphas[index] = 0;
        this.sizes[index] = 0;
        continue;
      }
      const fade = particle.life / particle.maxLife;
      this.positions[index * 3] = particle.x;
      this.positions[index * 3 + 1] = particle.y;
      this.positions[index * 3 + 2] = particle.z;
      this.sizes[index] = particle.size * (0.5 + fade * 0.5);
      this.tints[index * 3] = particle.r;
      this.tints[index * 3 + 1] = particle.g;
      this.tints[index * 3 + 2] = particle.b;
      this.alphas[index] = Math.min(1, fade * 1.6);
    }
    for (const name of ["position", "size", "tint", "alpha"]) this.geometry.getAttribute(name).needsUpdate = true;
  }

  clear(): void {
    this.particles.length = 0;
  }
}
