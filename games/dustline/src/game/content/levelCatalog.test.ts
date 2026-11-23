import { describe, expect, it } from "vitest";
import { battleConfig } from "../config/battleConfig";
import { gameConfig } from "../config/gameConfig";
import { battleLevelOrder, getNextBattleLevelId } from "./levelCatalog";
import type { Point, Rect } from "./levelTypes";

const tankRadius = Math.max(battleConfig.player.radius, battleConfig.enemy.radius);
const radiusOf = (archetype: keyof typeof battleConfig.enemy.archetypes): number =>
  battleConfig.enemy.archetypes[archetype].radius;


function circleHitsRect(point: Point, radius: number, rect: Rect): boolean {
  const nearestX = Math.max(rect.x, Math.min(point.x, rect.x + rect.width));
  const nearestY = Math.max(rect.y, Math.min(point.y, rect.y + rect.height));
  return (point.x - nearestX) ** 2 + (point.y - nearestY) ** 2 < radius ** 2;
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

describe("level catalog", () => {
  it("chains every level to the next and loops back to the first", () => {
    battleLevelOrder.forEach((level, index) => {
      const expected = battleLevelOrder[(index + 1) % battleLevelOrder.length].id;
      expect(getNextBattleLevelId(level.id)).toBe(expected);
    });
  });

  it("uses unique level ids", () => {
    const ids = battleLevelOrder.map((level) => level.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  describe.each(battleLevelOrder.map((level) => [level.name, level] as const))("%s", (_name, level) => {
    const solids: Rect[] = [...level.indestructibleWalls, ...level.weakWalls, ...level.crates];

    it("uses unique entity ids", () => {
      const ids = [
        ...level.enemySpawns.map((enemy) => enemy.id),
        ...level.weakWalls.map((wall) => wall.id),
        ...level.crates.map((crate) => crate.id),
        ...level.pickups.map((pickup) => pickup.id),
      ];
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("keeps everything inside the world", () => {
      for (const rect of solids) {
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.y).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.width).toBeLessThanOrEqual(level.width ?? gameConfig.worldWidth);
        expect(rect.y + rect.height).toBeLessThanOrEqual(level.height ?? gameConfig.worldHeight);
      }
    });

    it("puts every barrier on the grid as whole square cells", () => {
      const cell = gameConfig.gridSize;
      for (const rect of solids) {
        expect(rect.x % cell, `${rect.x},${rect.y}`).toBe(0);
        expect(rect.y % cell, `${rect.x},${rect.y}`).toBe(0);
        expect(rect.width % cell).toBe(0);
        expect(rect.height % cell).toBe(0);
      }
      for (const breakable of [...level.weakWalls, ...level.crates]) {
        expect([breakable.width, breakable.height]).toEqual([cell, cell]);
      }
    });

    it("describes its room flow", () => {
      expect(level.rooms?.length ?? 0).toBeGreaterThanOrEqual(3);
      expect(level.tagline).toBeTruthy();
    });

    it("spawns the player and enemies clear of walls and crates", () => {
      const spawns = [
        { ...level.playerSpawn, radius: battleConfig.player.radius },
        ...level.enemySpawns.map((enemy) => ({ x: enemy.x, y: enemy.y, radius: radiusOf(enemy.archetype) })),
      ];
      for (const spawn of spawns) {
        const blocker = solids.find((rect) => circleHitsRect(spawn, spawn.radius, rect));
        expect(blocker, `spawn at ${spawn.x},${spawn.y}`).toBeUndefined();
      }
    });

    it("keeps patrol routes clear of solid cover", () => {
      for (const enemy of level.enemySpawns) {
        const route = enemy.patrol ?? [];
        for (let index = 1; index < route.length; index += 1) {
          const from = route[index - 1];
          const to = route[index];
          for (let step = 0; step <= 20; step += 1) {
            const sample = { x: from.x + ((to.x - from.x) * step) / 20, y: from.y + ((to.y - from.y) * step) / 20 };
            const blocker = solids.find((rect) => circleHitsRect(sample, tankRadius, rect));
            expect(blocker, `${enemy.id} patrol at ${sample.x},${sample.y}`).toBeUndefined();
          }
        }
      }
    });

    it("places pickups where they can be collected", () => {
      for (const pickup of level.pickups) {
        const blocker = solids.find((rect) => circleHitsRect(pickup, pickup.radius ?? 12, rect));
        expect(blocker, pickup.id).toBeUndefined();
      }
    });

    it("does not stack crates or weak walls on top of solid walls", () => {
      for (const breakable of [...level.weakWalls, ...level.crates]) {
        const overlap = level.indestructibleWalls.find((wall) => rectsOverlap(wall, breakable));
        expect(overlap, breakable.id).toBeUndefined();
      }
    });
  });
});
