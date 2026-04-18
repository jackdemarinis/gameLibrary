import Phaser from "phaser";
import type { SimulationEffect } from "../../game/simulation/battle/types";

export function spawnSimulationEffect(scene: Phaser.Scene, effect: SimulationEffect): void {
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
    for (let index = 0; index < 5; index += 1) {
      const spark = scene.add.rectangle(effect.x, effect.y, 4, 12, effect.color, 0.92);
      spark.setDepth(6);
      spark.rotation = (Math.PI * 2 * index) / 5;

      scene.tweens.add({
        targets: spark,
        x: effect.x + Math.cos(spark.rotation) * (effect.size + 10),
        y: effect.y + Math.sin(spark.rotation) * (effect.size + 10),
        alpha: 0,
        scaleY: 0.4,
        duration: 160,
        ease: "Quad.easeOut",
        onComplete: () => spark.destroy(),
      });
    }
  }
}
