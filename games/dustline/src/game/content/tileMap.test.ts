import { describe, expect, it } from "vitest";
import { compileTileLevel, mergeWallCells, tileSize } from "./tileMap";

describe("tile maps", () => {
  const level = compileTileLevel({
    id: "test",
    name: "Test",
    briefing: "",
    tagline: "",
    tier: "easy",
    rooms: [],
    map: [
      "#######",
      "#P.b.r#",
      "#..$..#",
      "#HRo.W#",
      "#######",
    ],
  });

  it("places every entity at the centre of its cell", () => {
    expect(level.playerSpawn).toEqual({ x: tileSize * 1.5, y: tileSize * 1.5 });
    expect(level.width).toBe(7 * tileSize);
    expect(level.height).toBe(5 * tileSize);
    expect(level.weakWalls[0]).toMatchObject({ x: 3 * tileSize, y: tileSize, width: tileSize, height: tileSize });
    expect(level.crates[0].rewardCredits).toBeGreaterThan(0);
    expect(level.pickups.map((pickup) => pickup.kind)).toEqual(["coin"]);
    expect(level.supplyCrates?.map((crate) => crate.drop)).toEqual(["repair", "rapidFire"]);
    expect(level.enemySpawns.map((enemy) => enemy.archetype)).toEqual(["raider", "warden"]);
  });

  it("merges wall cells into a few collision rectangles", () => {
    const rects = mergeWallCells(["####", "#..#", "####"]);
    const area = rects.reduce((sum, rect) => sum + rect.width * rect.height, 0);
    expect(area).toBe(10 * tileSize * tileSize);
    expect(rects.length).toBeLessThanOrEqual(4);
  });

  it("rejects ragged rows and unknown tiles", () => {
    const base = { id: "bad", name: "", briefing: "", tagline: "", tier: "easy" as const, rooms: [] };
    expect(() => compileTileLevel({ ...base, map: ["###", "#P", "###"] })).toThrow();
    expect(() => compileTileLevel({ ...base, map: ["###", "#P?", "###"] })).toThrow();
  });
});
