import { describe, expect, it } from "vitest";
import { physics } from "../config/rules";
import { addBall, createWorld, forceSettle, isSettled, powerToDistance, simulateRestDistance, speedForDistance, stepWorld, throwBall } from "./physics";

function settle(world: ReturnType<typeof createWorld>): void {
  for (let step = 0; step < physics.maxSimSeconds / physics.stepSeconds && !isSettled(world); step++) {
    stepWorld(world);
  }
}

describe("petanque physics", () => {
  it("rests near the distance the power asked for, for both styles", () => {
    for (const style of ["roll", "lob"] as const) {
      const world = createWorld();
      const ball = throwBall(world, "boule", 0, { aimRadians: 0, power: 0.5, style, accuracyError: 0 });
      settle(world);
      expect(ball.state).toBe("rest");
      expect(-ball.position.z).toBeCloseTo(powerToDistance(0.5), 1);
    }
  });

  it("needs more speed to roll farther", () => {
    expect(speedForDistance(9, "roll")).toBeGreaterThan(speedForDistance(5, "roll"));
    expect(simulateRestDistance(speedForDistance(7, "lob"), "lob")).toBeCloseTo(7, 2);
  });

  it("a lob rolls a shorter share of its distance than a roll", () => {
    const rollWorld = createWorld();
    const lobWorld = createWorld();
    const roll = throwBall(rollWorld, "boule", 0, { aimRadians: 0, power: 0.6, style: "roll", accuracyError: 0 });
    const lob = throwBall(lobWorld, "boule", 0, { aimRadians: 0, power: 0.6, style: "lob", accuracyError: 0 });
    let rollLanding = 0;
    let lobLanding = 0;
    for (let step = 0; step < 5000; step++) {
      stepWorld(rollWorld);
      stepWorld(lobWorld);
      if (!rollLanding && roll.state !== "air") rollLanding = -roll.position.z;
      if (!lobLanding && lob.state !== "air") lobLanding = -lob.position.z;
    }
    expect(lobLanding).toBeGreaterThan(rollLanding);
  });

  it("knocks a resting jack forward on impact", () => {
    const world = createWorld();
    const jack = addBall(world, "jack", null, { x: 0, y: 0.045, z: -5 }, { x: 0, y: 0, z: 0 });
    jack.state = "rest";
    addBall(world, "boule", 0, { x: 0, y: 0.09, z: -3 }, { x: 0, y: 0, z: -4 }).state = "rolling";
    settle(world);
    expect(jack.position.z).toBeLessThan(-5.2);
  });

  it("marks balls that leave the pitch as out", () => {
    const world = createWorld();
    const ball = throwBall(world, "boule", 0, { aimRadians: 0.6, power: 1, style: "roll", accuracyError: 0 });
    settle(world);
    expect(ball.state).toBe("out");
  });
});

describe("petanque physics stacking", () => {
  it("a boule dropped straight onto another rolls off and settles quickly", () => {
    const world = createWorld();
    const bottom = addBall(world, "boule", 0, { x: 0, y: 0.09, z: -6 }, { x: 0, y: 0, z: 0 });
    bottom.state = "rest";
    const top = addBall(world, "boule", 1, { x: 0, y: 1.2, z: -6 }, { x: 0, y: 0, z: 0 });
    let seconds = 0;
    while (!isSettled(world) && seconds < 6) {
      stepWorld(world);
      seconds += physics.stepSeconds;
    }
    expect(isSettled(world)).toBe(true);
    expect(top.position.y).toBeCloseTo(top.radius, 5);
  });

  it("forceSettle grounds and separates everything", () => {
    const world = createWorld();
    addBall(world, "boule", 0, { x: 0, y: 0.5, z: -6 }, { x: 1, y: 0, z: 0 });
    addBall(world, "boule", 1, { x: 0.05, y: 0.09, z: -6 }, { x: 0, y: 0, z: 0 });
    forceSettle(world);
    expect(isSettled(world)).toBe(true);
    const [a, b] = world.balls;
    expect(Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z)).toBeGreaterThanOrEqual(a.radius + b.radius - 1e-3);
  });
});
