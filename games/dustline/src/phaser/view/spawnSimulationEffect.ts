import Phaser from "phaser";
import { pixelTheme } from "../../game/config/theme";
import type { SimulationEffect } from "../../game/simulation/battle/types";
import { artPixel, ensureMuzzleBlastTextures, muzzleBlastFrames } from "./dustlinePixelArt";

const effectDepth = 6;

/** Snaps to the 4px art grid so effects stay as crisp as the sprites. */
function snap(value: number): number {
  return Math.round(value / artPixel) * artPixel;
}

/** Square, axis-aligned pixel that flies out and blinks away in steps. */
function spawnPixel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  size: number,
  color: number,
  targetX: number,
  targetY: number,
  durationMs: number,
): void {
  const pixel = scene.add.rectangle(snap(x), snap(y), size, size, color, 1).setDepth(effectDepth);

  scene.tweens.add({
    targets: pixel,
    x: { value: snap(targetX), ease: "Quad.easeOut" },
    y: { value: snap(targetY), ease: "Quad.easeOut" },
    alpha: { value: 0, ease: "Stepped", easeParams: [3] },
    duration: durationMs,
    onComplete: () => pixel.destroy(),
  });
}

/** A hollow square ring that grows in art-pixel steps. */
function spawnRing(scene: Phaser.Scene, x: number, y: number, size: number, color: number, durationMs: number): void {
  const ring = scene.add.rectangle(snap(x), snap(y), snap(size), snap(size));
  ring.setStrokeStyle(artPixel, color, 1).setDepth(effectDepth);

  scene.tweens.add({
    targets: ring,
    scaleX: { value: 2.2, ease: "Stepped", easeParams: [4] },
    scaleY: { value: 2.2, ease: "Stepped", easeParams: [4] },
    alpha: { value: 0, ease: "Stepped", easeParams: [3] },
    duration: durationMs,
    onComplete: () => ring.destroy(),
  });
}

export function spawnSimulationEffect(scene: Phaser.Scene, effect: SimulationEffect): void {
  if (effect.shakeIntensity && effect.shakeDurationMs) {
    scene.cameras.main.shake(effect.shakeDurationMs, effect.shakeIntensity, true);
  }

  switch (effect.type) {
    case "sound":
      return;
    case "muzzleFlash":
      spawnMuzzleFlash(scene, effect);
      return;
    case "debris":
      spawnBurst(scene, effect, effect.count ?? 6, effect.lifetimeMs ?? 300, Math.PI * 2, [effect.color]);
      return;
    case "impact":
      spawnBurst(scene, effect, 4, 140, Math.PI * 0.9, [effect.color, pixelTheme.white]);
      return;
    case "pickup":
      spawnRing(scene, effect.x, effect.y, effect.size, effect.color, 200);
      return;
    case "explosion":
    default:
      spawnRing(scene, effect.x, effect.y, effect.size, effect.color, 260);
      spawnBurst(scene, effect, 10, 320, Math.PI * 2, [effect.color, pixelTheme.white, pixelTheme.coinDark, pixelTheme.outline]);
  }
}

function spawnBurst(
  scene: Phaser.Scene,
  effect: SimulationEffect,
  count: number,
  durationMs: number,
  spread: number,
  colors: number[],
): void {
  const baseRotation = effect.rotation ?? 0;

  for (let index = 0; index < count; index += 1) {
    const angle =
      spread >= Math.PI * 2
        ? (Math.PI * 2 * index) / count + Phaser.Math.FloatBetween(-0.3, 0.3)
        : baseRotation + Phaser.Math.FloatBetween(-spread / 2, spread / 2);
    const distance = effect.size + Phaser.Math.Between(8, 24);
    const size = index % 3 === 0 ? artPixel * 2 : artPixel;

    spawnPixel(
      scene,
      effect.x,
      effect.y,
      size,
      colors[index % colors.length],
      effect.x + Math.cos(angle) * distance,
      effect.y + Math.sin(angle) * distance,
      durationMs,
    );
  }
}

/**
 * Muzzle blast: a three-frame pixel sprite (flare, full burst, cooling smoke)
 * out of the barrel, shaped for the cannon that fired.
 */
function spawnMuzzleFlash(scene: Phaser.Scene, effect: SimulationEffect): void {
  const weapon = effect.weapon ?? "cannon";
  const frames = ensureMuzzleBlastTextures(scene, weapon, effect.faction ?? "player");
  // Simulation rotation 0 points down (+y); the blast art points along +x.
  const worldAngle = (effect.rotation ?? 0) + Math.PI / 2;
  const round = weapon === "ricochet" || weapon === "laser";
  const blast = scene.add
    .image(effect.x, effect.y, frames[0])
    .setOrigin(round ? 0.5 : 0.1, 0.5)
    .setRotation(worldAngle)
    .setDepth(effectDepth + 1);
  const frameMs = (effect.lifetimeMs ?? 90) / muzzleBlastFrames;

  for (let frame = 1; frame <= muzzleBlastFrames; frame += 1) {
    scene.time.delayedCall(frameMs * frame, () => {
      if (frame === muzzleBlastFrames) {
        blast.destroy();
      } else if (blast.active) {
        blast.setTexture(frames[frame]);
      }
    });
  }
}
