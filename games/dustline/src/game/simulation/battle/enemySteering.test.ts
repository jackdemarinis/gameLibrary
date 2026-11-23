import { describe, expect, it } from "vitest";
import { battleLevelOrder } from "../../content/levelCatalog";
import { createInitialSave } from "../state";
import { BattleSimulation } from "./BattleSimulation";
import type { BattleState } from "./types";

describe("enemy steering", () => {
  it("turns smoothly instead of snapping back and forth (every level, 20s each)", () => {
    let flips = 0;
    let turningTicks = 0;
    let totalTurn = 0;

    for (const level of battleLevelOrder) {
      const simulation = new BattleSimulation(level, createInitialSave({ difficulty: "normal" }));
      const state = (simulation as unknown as { state: BattleState }).state;
      const last = new Map<string, { rotation: number; delta: number }>();

      for (let elapsed = 0; elapsed < 20000; elapsed += 16) {
        // An invulnerable player driving a slow square keeps the enemies busy.
        state.player.health = 1e9;
        const [dx, dy] = [[1, 0], [0, 1], [-1, 0], [0, -1]][Math.floor(elapsed / 2500) % 4];
        simulation.advance(16, { movementX: dx, movementY: dy, aim: { x: 0, y: 0 }, firing: false });

        for (const enemy of state.enemies) {
          if (!enemy.alive) continue;
          const previous = last.get(enemy.id);
          let delta = 0;
          if (previous) {
            delta = Math.atan2(Math.sin(enemy.hullRotation - previous.rotation), Math.cos(enemy.hullRotation - previous.rotation));
            if (Math.abs(delta) > 0.001) {
              turningTicks += 1;
              totalTurn += Math.abs(delta);
            }
            const swung = Math.abs(delta) > 0.08 && Math.abs(previous.delta) > 0.08;
            if (swung && Math.sign(delta) !== Math.sign(previous.delta)) flips += 1;
          }
          last.set(enemy.id, { rotation: enemy.hullRotation, delta });
        }
      }
    }

    // Before smoothing: ~950 flips and ~0.7 rad of hull swing per turning frame.
    expect(flips).toBeLessThan(200);
    expect(totalTurn / Math.max(1, turningTicks)).toBeLessThan(0.1);
  }, 60000);
});
