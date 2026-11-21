// Messages Pétanque Park clients relay to each other through the room server.
// The host's browser is the referee: it alone runs the rules and sends `outcome`.

import type { CpuLevel, ThrowStyle } from "../config/rules";
import type { CourtId } from "../content/courts";
import type { MatchState } from "../simulation/match";
import type { MeterPhase } from "../simulation/meter";
import type { BallSnapshot, ThrowInput } from "../simulation/physics";

export interface LobbySlot {
  // null = CPU, otherwise the room clientId that controls this player.
  controllerId: string | null;
  name: string;
  characterId: string;
  team: number;
  // CPU slots only.
  cpuLevel?: CpuLevel;
}

export interface LobbyState {
  playerCount: 2 | 4;
  targetScore: number;
  courtId?: CourtId;
  slots: LobbySlot[];
}

export type OutcomeEvent = "start" | "jackRetry" | "jackSet" | "turn" | "endOver" | "matchOver" | "newEnd";

export interface Outcome {
  event: OutcomeEvent;
  match: MatchState;
  balls: BallSnapshot[];
  nextBallId: number;
  toast: { text: string; team: number | null } | null;
}

export type GamePayload =
  | { kind: "lobby"; lobby: LobbyState }
  | { kind: "lobbyEdit"; name?: string; characterId?: string }
  | { kind: "aim"; aimRadians: number; style: ThrowStyle; meterPhase: MeterPhase; meterValue: number; meterPower: number }
  | { kind: "throw"; playerIndex: number; throwNumber: number; input: ThrowInput }
  | { kind: "outcome"; outcome: Outcome };

export function isGamePayload(value: unknown): value is GamePayload {
  return typeof value === "object" && value !== null && typeof (value as { kind?: unknown }).kind === "string";
}
