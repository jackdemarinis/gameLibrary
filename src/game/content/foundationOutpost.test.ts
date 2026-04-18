import { describe, expect, it } from "vitest";
import { gameConfig } from "../config/gameConfig";
import { foundationOutpost } from "./foundationOutpost";

describe("foundation outpost", () => {
  it("stays inside the configured world bounds", () => {
    expect(foundationOutpost.playerSpawn.x).toBeGreaterThan(0);
    expect(foundationOutpost.playerSpawn.y).toBeGreaterThan(0);
    expect(foundationOutpost.playerSpawn.x).toBeLessThan(gameConfig.worldWidth);
    expect(foundationOutpost.playerSpawn.y).toBeLessThan(gameConfig.worldHeight);

    foundationOutpost.walls.forEach((wall) => {
      expect(wall.x).toBeGreaterThanOrEqual(0);
      expect(wall.y).toBeGreaterThanOrEqual(0);
      expect(wall.x + wall.width).toBeLessThanOrEqual(gameConfig.worldWidth);
      expect(wall.y + wall.height).toBeLessThanOrEqual(gameConfig.worldHeight);
    });
  });

  it("provides authored combat landmarks for the preview", () => {
    expect(foundationOutpost.enemySpawns).toHaveLength(2);
    expect(foundationOutpost.walls.length).toBeGreaterThanOrEqual(5);
    expect(foundationOutpost.crates.length).toBeGreaterThanOrEqual(3);
  });
});
