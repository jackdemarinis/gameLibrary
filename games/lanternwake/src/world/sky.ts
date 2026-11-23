// Night sky dome: a vertical gradient that melts into the fog colour at the horizon,
// dithered pixel stars and a big pale moon with a halo.
import * as THREE from "three";
import { makeRng } from "../engine/rng";
import { textures } from "../engine/pixelTextures";

const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 world = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * world;
    gl_Position.z = gl_Position.w * 0.9999;
  }
`;

const skyFragment = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uGlow;
  uniform vec3 uMoonDir;
  varying vec3 vDir;
  void main() {
    float up = clamp(vDir.y, -0.2, 1.0);
    vec3 color = mix(uHorizon, uTop, smoothstep(-0.02, 0.55, up));
    float moonness = max(dot(normalize(vDir), uMoonDir), 0.0);
    color += uGlow * pow(moonness, 12.0) * 0.6;
    gl_FragColor = vec4(color, 1.0);
  }
`;

export class Sky {
  readonly group = new THREE.Group();
  private readonly material: THREE.ShaderMaterial;
  private readonly moon: THREE.Sprite;
  private readonly moonHalo: THREE.Sprite;
  private readonly moonDir = new THREE.Vector3(-0.45, 0.42, -0.78).normalize();

  constructor() {
    this.material = new THREE.ShaderMaterial({
      vertexShader: skyVertex,
      fragmentShader: skyFragment,
      uniforms: {
        uTop: { value: new THREE.Color(0x05070f) },
        uHorizon: { value: new THREE.Color(0x0c1424) },
        uGlow: { value: new THREE.Color(0x6070a0) },
        uMoonDir: { value: this.moonDir },
      },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(400, 16, 10), this.material);
    dome.renderOrder = -10;
    this.group.add(dome);

    // Stars: chunky points, a few brighter.
    const rng = makeRng(77);
    const positions: number[] = [];
    const colors: number[] = [];
    for (let star = 0; star < 420; star += 1) {
      const theta = rng() * Math.PI * 2;
      const y = 0.08 + Math.pow(rng(), 0.7) * 0.92;
      const radius = Math.sqrt(1 - y * y);
      positions.push(Math.cos(theta) * radius * 380, y * 380, Math.sin(theta) * radius * 380);
      const brightness = 0.35 + rng() * 0.65;
      const warm = rng() > 0.8;
      colors.push(brightness, brightness * (warm ? 0.85 : 0.95), brightness * (warm ? 0.7 : 1.05));
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    starGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    const stars = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false }),
    );
    stars.renderOrder = -9;
    this.group.add(stars);

    this.moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures().glow, color: 0x8090c0, fog: false, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 }));
    this.moonHalo.scale.setScalar(120);
    this.moonHalo.renderOrder = -8;
    this.group.add(this.moonHalo);
    const moonCanvas = document.createElement("canvas");
    moonCanvas.width = 32;
    moonCanvas.height = 32;
    const context = moonCanvas.getContext("2d");
    if (context) {
      const moonRng = makeRng(5);
      for (let y = 0; y < 32; y += 1) {
        for (let x = 0; x < 32; x += 1) {
          const dx = x - 15.5;
          const dy = y - 15.5;
          if (dx * dx + dy * dy > 15 * 15) continue;
          const crater = moonRng() > 0.93 ? 0.8 : 1;
          const shade = (0.82 + (-dx - dy) * 0.006) * crater;
          context.fillStyle = `rgb(${Math.round(225 * shade)},${Math.round(228 * shade)},${Math.round(240 * shade)})`;
          context.fillRect(x, y, 1, 1);
        }
      }
    }
    const moonTexture = new THREE.CanvasTexture(moonCanvas);
    moonTexture.magFilter = THREE.NearestFilter;
    moonTexture.minFilter = THREE.NearestFilter;
    moonTexture.colorSpace = THREE.SRGBColorSpace;
    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTexture, fog: false, depthWrite: false }));
    this.moon.scale.setScalar(26);
    this.moon.renderOrder = -7;
    this.group.add(this.moon);
    this.moon.position.copy(this.moonDir).multiplyScalar(360);
    this.moonHalo.position.copy(this.moonDir).multiplyScalar(365);
  }

  setMood(top: number, horizon: number, moonTint: number): void {
    (this.material.uniforms.uTop.value as THREE.Color).set(top);
    (this.material.uniforms.uHorizon.value as THREE.Color).set(horizon);
    (this.material.uniforms.uGlow.value as THREE.Color).set(moonTint).multiplyScalar(0.6);
    (this.moonHalo.material as THREE.SpriteMaterial).color.set(moonTint);
  }

  /** The dome follows the camera so it never clips. */
  follow(position: THREE.Vector3): void {
    this.group.position.copy(position);
  }
}
