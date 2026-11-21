// Classic three-press swing meter:
//   press 1 starts the bar, press 2 locks power, press 3 sets accuracy as the
//   marker sweeps back toward the sweet spot near zero.

import { meter as meterConfig } from "../config/rules";

export type MeterPhase = "idle" | "power" | "accuracy" | "done" | "cancelled";

export interface MeterState {
  phase: MeterPhase;
  value: number;
  rising: boolean;
  power: number;
  accuracyError: number;
}

export function createMeter(): MeterState {
  return { phase: "idle", value: 0, rising: true, power: 0, accuracyError: 0 };
}

export function pressMeter(state: MeterState): MeterState {
  switch (state.phase) {
    case "idle":
      return { ...state, phase: "power", value: 0, rising: true };
    case "power":
      return { ...state, phase: "accuracy", power: state.value };
    case "accuracy":
      return { ...state, phase: "done", accuracyError: accuracyFromValue(state.value) };
    default:
      return state;
  }
}

export function accuracyFromValue(value: number): number {
  if (Math.abs(value) <= meterConfig.sweetSpotHalfWidth) {
    return 0;
  }
  return Math.max(-1, Math.min(1, value / meterConfig.accuracyWindow));
}

export function updateMeter(state: MeterState, dt: number): MeterState {
  if (state.phase === "power") {
    const fillRate = 1 / meterConfig.fillSeconds;
    if (state.rising) {
      const value = state.value + fillRate * dt;
      return value >= 1 ? { ...state, value: 1, rising: false } : { ...state, value };
    }
    const value = state.value - fillRate * dt;
    // Never pressed for power: the swing is abandoned.
    return value <= 0 ? { ...state, phase: "cancelled", value: 0 } : { ...state, value };
  }

  if (state.phase === "accuracy") {
    const value = state.value - dt / meterConfig.returnSeconds;
    if (value <= meterConfig.overshoot) {
      return { ...state, phase: "done", value: meterConfig.overshoot, accuracyError: -1 };
    }
    return { ...state, value };
  }

  return state;
}
