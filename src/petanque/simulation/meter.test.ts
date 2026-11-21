import { describe, expect, it } from "vitest";
import { meter as meterConfig } from "../config/rules";
import { createMeter, pressMeter, updateMeter } from "./meter";

describe("swing meter", () => {
  it("locks power on the second press and accuracy on the third", () => {
    let state = pressMeter(createMeter());
    state = updateMeter(state, meterConfig.fillSeconds * 0.5);
    state = pressMeter(state);
    expect(state.phase).toBe("accuracy");
    expect(state.power).toBeCloseTo(0.5, 5);
    state = updateMeter(state, meterConfig.returnSeconds * 0.5);
    state = pressMeter(state);
    expect(state.phase).toBe("done");
    expect(state.accuracyError).toBe(0);
  });

  it("cancels when power is never locked", () => {
    let state = pressMeter(createMeter());
    for (let i = 0; i < 300; i++) state = updateMeter(state, 0.01);
    expect(state.phase).toBe("cancelled");
  });

  it("gives full error when accuracy is never pressed", () => {
    let state = pressMeter(createMeter());
    state = pressMeter(updateMeter(state, 0.2));
    for (let i = 0; i < 300; i++) state = updateMeter(state, 0.01);
    expect(state).toMatchObject({ phase: "done", accuracyError: -1 });
  });
});
