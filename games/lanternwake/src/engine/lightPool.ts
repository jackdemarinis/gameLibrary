// A fixed set of point lights handed each frame to the light sources nearest the
// player. The light count never changes, so shaders never recompile mid-game.
import * as THREE from "three";

export interface LightSource {
  position: THREE.Vector3;
  color: THREE.Color;
  intensity: number;
  distance: number;
  /** 0..1 flicker strength (fire), 0 for steady light. */
  flicker: number;
  enabled: boolean;
}

export class LightPool {
  private readonly lights: THREE.PointLight[] = [];
  private readonly sources: LightSource[] = [];
  private time = 0;

  constructor(scene: THREE.Scene, count: number) {
    for (let index = 0; index < count; index += 1) {
      const light = new THREE.PointLight(0xffffff, 0, 10, 1.6);
      this.lights.push(light);
      scene.add(light);
    }
  }

  add(source: LightSource): LightSource {
    this.sources.push(source);
    return source;
  }

  remove(source: LightSource): void {
    const index = this.sources.indexOf(source);
    if (index >= 0) this.sources.splice(index, 1);
  }

  clear(): void {
    this.sources.length = 0;
  }

  update(dt: number, focus: THREE.Vector3): void {
    this.time += dt;
    const ranked = this.sources
      .filter((source) => source.enabled)
      .map((source) => ({ source, score: source.position.distanceToSquared(focus) / (source.distance * source.distance) }))
      .sort((a, b) => a.score - b.score);
    this.lights.forEach((light, index) => {
      const entry = ranked[index];
      if (!entry) {
        light.intensity = 0;
        return;
      }
      const { source } = entry;
      const seed = source.position.x * 1.7 + source.position.z * 2.3;
      const flicker =
        1 - source.flicker * (0.5 + 0.5 * Math.sin(this.time * 13 + seed)) * 0.25 - source.flicker * Math.max(0, Math.sin(this.time * 31 + seed * 3)) * 0.1;
      light.position.copy(source.position);
      light.color.copy(source.color);
      light.distance = source.distance;
      light.intensity = source.intensity * flicker;
    });
  }
}
