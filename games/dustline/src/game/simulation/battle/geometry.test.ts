import { describe, expect, it } from "vitest";
import { moveCircleWithCollisionsDetailed } from "./geometry";

describe("moveCircleWithCollisionsDetailed", () => {
  it("slides along a blocking wall instead of teleporting off it", () => {
    const result = moveCircleWithCollisionsDetailed(
      { x: 100, y: 100 },
      { x: 60, y: 60 },
      28,
      [{ x: 140, y: 60, width: 40, height: 120 }],
    );

    expect(result.blocked).toBe(true);
    expect(result.position.x).toBeLessThanOrEqual(112.1);
    expect(result.position.y).toBeGreaterThan(150);
  });

  it("resolves overlap by pushing the circle to the nearest open side", () => {
    const result = moveCircleWithCollisionsDetailed(
      { x: 150, y: 100 },
      { x: 0, y: 0 },
      20,
      [{ x: 140, y: 60, width: 40, height: 120 }],
    );

    expect(result.position.x).toBeLessThanOrEqual(120);
    expect(result.blocked).toBe(true);
  });
});
