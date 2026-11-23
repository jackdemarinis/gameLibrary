import { describe, expect, it } from "vitest";
import { createNavGrid, findNextWaypoint } from "./navigation";

describe("navigation", () => {
  it("routes around a wall through the gap instead of straight into it", () => {
    // 5x5 grid of 64px cells with a wall down column 2, open only at the bottom row.
    const grid = createNavGrid(320, 320, 64, [{ x: 128, y: 0, width: 64, height: 256 }]);
    const start = { x: 32, y: 32 };
    const goal = { x: 288, y: 32 };
    const path = [start];
    for (let step = 0; step < 20; step += 1) {
      const next = findNextWaypoint(grid, path[path.length - 1], goal);
      if (!next) break;
      path.push(next);
    }
    expect(path[path.length - 1]).toEqual(goal);
    // Never steps into the wall column except through the bottom-row gap.
    expect(path.filter((point) => point.x === 160).every((point) => point.y === 288)).toBe(true);
  });

  it("returns null when the goal cannot be reached", () => {
    const grid = createNavGrid(192, 64, 64, [{ x: 64, y: 0, width: 64, height: 64 }]);
    expect(findNextWaypoint(grid, { x: 32, y: 32 }, { x: 160, y: 32 })).toBeNull();
  });
});
