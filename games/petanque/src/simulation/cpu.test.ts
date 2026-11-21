import { describe, expect, it } from "vitest";
import { balls as ballRules, cpuLevels } from "../config/rules";
import { chooseCpuPlan, cpuThrow } from "./cpu";
import type { Ball } from "./physics";

function ball(id: number, kind: "jack" | "boule", team: number | null, x: number, z: number): Ball {
  return {
    id,
    kind,
    team,
    radius: kind === "jack" ? ballRules.jackRadius : ballRules.bouleRadius,
    mass: kind === "jack" ? ballRules.jackMass : ballRules.bouleMass,
    position: { x, y: 0, z },
    velocity: { x: 0, y: 0, z: 0 },
    state: "rest",
  };
}

// Deterministic "random" that always returns the same value.
const always = (value: number) => () => value;

describe("CPU opponents", () => {
  const jack = ball(1, "jack", null, 0, -8);

  it("points at the jack on an open pitch", () => {
    const { plan } = chooseCpuPlan({ balls: [jack], team: 1, throwingJack: false, level: "hard", random: always(0.5) });
    expect(plan).toBe("point");
  });

  it("hard shoots a rival boule sitting on the jack; easy never does", () => {
    const rival = ball(2, "boule", 0, 0.1, -8.1);
    const context = { balls: [jack, rival], team: 1, throwingJack: false, random: always(0.1) };
    expect(chooseCpuPlan({ ...context, level: "hard" }).plan).toBe("shoot");
    expect(chooseCpuPlan({ ...context, level: "easy" }).plan).toBe("point");
  });

  it("hard lobs over a boule blocking the line", () => {
    const blocker = ball(2, "boule", 1, 0.02, -5);
    const { plan } = chooseCpuPlan({ balls: [jack, blocker], team: 1, throwingJack: false, level: "hard", random: always(0.9) });
    expect(plan).toBe("lobPoint");
  });

  it("throws the jack inside the legal zone", () => {
    for (const value of [0, 0.5, 0.999]) {
      const { target } = chooseCpuPlan({ balls: [], team: 0, throwingJack: true, level: "normal", random: always(value) });
      expect(-target.z).toBeGreaterThanOrEqual(6);
      expect(-target.z).toBeLessThanOrEqual(10);
    }
  });

  it("easy is shakier than hard", () => {
    const worst = (level: "easy" | "hard") =>
      Math.abs(cpuThrow({ balls: [jack], team: 1, throwingJack: false, level, random: always(1) }).aimRadians);
    expect(worst("easy")).toBeGreaterThan(worst("hard"));
    expect(cpuLevels.easy.powerNoise).toBeGreaterThan(cpuLevels.hard.powerNoise);
  });
});
