import { describe, expect, it } from "vitest";
import { meter as meterConfig } from "../config/rules";
import { createMeter, directionError, pressMeter, updateMeter } from "./meter";

describe("two-bar throw meter", () => {
  it("locks distance on the second press and straightness on the third", () => {
    let state = pressMeter(createMeter());
    state = updateMeter(state, meterConfig.distanceSweepSeconds * 0.5);
    state = pressMeter(state);
    expect(state.phase).toBe("direction");
    expect(state.power).toBeCloseTo(0.5, 5);
    // Half a sweep from the left edge is dead centre.
    state = updateMeter(state, meterConfig.directionSweepSeconds * 0.5);
    state = pressMeter(state);
    expect(state.phase).toBe("done");
    expect(state.accuracyError).toBe(0);
  });

  it("distance needle bounces back down instead of cancelling", () => {
    let state = pressMeter(createMeter());
    state = updateMeter(state, meterConfig.distanceSweepSeconds * 1.25);
    expect(state.phase).toBe("distance");
    expect(state.value).toBeCloseTo(0.75, 5);
  });

  it("straightness error grows with distance from centre and keeps its side", () => {
    expect(directionError(0.03)).toBe(0);
    expect(directionError(1)).toBe(1);
    expect(directionError(-1)).toBe(-1);
    expect(directionError(0.5)).toBeGreaterThan(directionError(0.3));
    expect(directionError(-0.5)).toBeLessThan(0);
  });

  it("is deterministic: same timing, same throw", () => {
    const run = () => {
      let state = pressMeter(createMeter());
      state = pressMeter(updateMeter(state, 0.8));
      return pressMeter(updateMeter(state, 0.4));
    };
    expect(run()).toEqual(run());
  });
});
