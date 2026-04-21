import Phaser from "phaser";
import type { SimulationEffect } from "../../game/simulation/battle/types";

export function spawnSimulationEffect(scene: Phaser.Scene, effect: SimulationEffect): void {
  if (effect.shakeIntensity && effect.shakeDurationMs) {
    scene.cameras.main.shake(effect.shakeDurationMs, effect.shakeIntensity, true);
  }

  if (effect.type === "muzzleFlash") {
    spawnMuzzleFlash(scene, effect);
    return;
  }

  if (effect.type === "debris") {
    spawnDebris(scene, effect);
    return;
  }

  const circle = scene.add.circle(effect.x, effect.y, effect.size, effect.color, 0.38);
  circle.setDepth(6);

  scene.tweens.add({
    targets: circle,
    alpha: 0,
    scaleX: effect.type === "explosion" ? 2.4 : 1.8,
    scaleY: effect.type === "explosion" ? 2.4 : 1.8,
    duration: effect.type === "pickup" ? 180 : 220,
    ease: "Quad.easeOut",
    onComplete: () => circle.destroy(),
  });

  if (effect.type === "impact" || effect.type === "explosion") {
    const sparkCount = effect.type === "impact" ? 4 : 6;
    const spread = effect.type === "impact" ? Math.PI * 0.9 : Math.PI * 2;
    const baseRotation = effect.rotation ?? 0;

    for (let index = 0; index < sparkCount; index += 1) {
      const spark = scene.add.rectangle(effect.x, effect.y, 4, effect.type === "impact" ? 10 : 14, effect.color, 0.92);
      spark.setDepth(6);
      spark.rotation =
        effect.type === "impact"
          ? baseRotation + Phaser.Math.FloatBetween(-spread / 2, spread / 2)
          : (Math.PI * 2 * index) / sparkCount;
      const distance = effect.size + Phaser.Math.Between(8, 16);

      scene.tweens.add({
        targets: spark,
        x: effect.x + Math.cos(spark.rotation) * distance,
        y: effect.y + Math.sin(spark.rotation) * distance,
        alpha: 0,
        scaleY: 0.4,
        duration: effect.type === "impact" ? 120 : 170,
        ease: "Quad.easeOut",
        onComplete: () => spark.destroy(),
      });
    }
  }
}

function spawnMuzzleFlash(scene: Phaser.Scene, effect: SimulationEffect): void {
  const flash = scene.add.triangle(
    effect.x,
    effect.y,
    0,
    0,
    effect.size,
    effect.size * 0.26,
    effect.size,
    -effect.size * 0.26,
    effect.color,
    0.96,
  );
  flash.setDepth(7);
  flash.setRotation(effect.rotation ?? 0);

  const core = scene.add.circle(effect.x, effect.y, effect.size * 0.18, 0xfff6cc, 0.9);
  core.setDepth(7);

  scene.tweens.add({
    targets: [flash, core],
    alpha: 0,
    scaleX: 0.5,
    scaleY: 0.5,
    duration: effect.lifetimeMs ?? 70,
    ease: "Quad.easeOut",
    onComplete: () => {
      flash.destroy();
      core.destroy();
    },
  });
}

function spawnDebris(scene: Phaser.Scene, effect: SimulationEffect): void {
  const count = effect.count ?? 6;

  for (let index = 0; index < count; index += 1) {
    const shard = scene.add.rectangle(effect.x, effect.y, Phaser.Math.Between(4, 8), Phaser.Math.Between(4, 10), effect.color, 0.92);
    shard.setDepth(6);
    shard.rotation = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const direction = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const distance = effect.size + Phaser.Math.Between(8, 22);
    const lifetime = effect.lifetimeMs ?? 300;

    scene.tweens.add({
      targets: shard,
      x: effect.x + Math.cos(direction) * distance,
      y: effect.y + Math.sin(direction) * distance,
      alpha: 0,
      angle: Phaser.Math.Between(-120, 120),
      duration: lifetime,
      ease: "Quad.easeOut",
      onComplete: () => shard.destroy(),
    });
  }
}
