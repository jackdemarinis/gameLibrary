// Two timed bars, party-sports style:
//   1. Distance: a needle runs 0 -> full -> 0 on a loop. Press to lock how far.
//   2. Straightness: a needle swings left <-> right through the centre. Press to
//      lock it; the further from centre, the more the throw pulls off line.
// Nothing random: a crooked throw is always a mistimed press.

import { meter as meterConfig } from "../config/rules";

export type MeterPhase = "idle" | "distance" | "direction" | "done";

export interface MeterState {
  phase: MeterPhase;
  // Needle position for the active bar: 0..1 for distance, -1..1 for direction.
  value: number;
  // Seconds since the active bar started.
  time: number;
  power: number;
  accuracyError: number;
}

export function createMeter(): MeterState {
  return { phase: "idle", value: 0, time: 0, power: 0, accuracyError: 0 };
}

export function pressMeter(state: MeterState): MeterState {
  switch (state.phase) {
    case "idle":
      return { ...state, phase: "distance", value: 0, time: 0 };
    case "distance":
      // The straightness needle starts at the left edge.
      return { ...state, phase: "direction", power: state.value, value: -1, time: 0 };
    case "direction":
      return { ...state, phase: "done", accuracyError: directionError(state.value) };
    default:
      return state;
  }
}

// Triangle wave 0 -> 1 -> 0 with period 2 * sweep.
function pingPong(time: number, sweep: number): number {
  const t = (time / sweep) % 2;
  return t <= 1 ? t : 2 - t;
}

export function directionError(value: number): number {
  const off = Math.abs(value);
  if (off <= meterConfig.directionSweetSpot) return 0;
  return Math.sign(value) * Math.min(1, (off - meterConfig.directionSweetSpot) / (1 - meterConfig.directionSweetSpot));
}

export function updateMeter(state: MeterState, dt: number): MeterState {
  if (state.phase === "distance") {
    const time = state.time + dt;
    return { ...state, time, value: pingPong(time, meterConfig.distanceSweepSeconds) };
  }
  if (state.phase === "direction") {
    const time = state.time + dt;
    return { ...state, time, value: pingPong(time, meterConfig.directionSweepSeconds) * 2 - 1 };
  }
  return state;
}
