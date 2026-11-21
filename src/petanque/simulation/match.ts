// Pure pétanque rules: who throws next, end scoring and match flow.
// Simplified from the official rules: fixed circle, jack re-thrown by the same
// team until it lands in the valid zone.

import { match as matchConfig, pitch } from "../config/rules";

export interface PlayerSlot {
  name: string;
  characterId: string;
  team: number;
  isCpu: boolean;
  // Online play: the room clientId steering this player (null = CPU run by the host).
  controllerId?: string | null;
}

export interface MatchConfig {
  players: PlayerSlot[];
  targetScore: number;
}

export type MatchPhase = "jack" | "boules" | "endOver" | "matchOver";

export interface EndResult {
  scoringTeam: number | null;
  points: number;
  scoringBallIds: number[];
  reason: "closest" | "deadJack" | "tie" | "empty";
}

export interface MatchState {
  config: MatchConfig;
  phase: MatchPhase;
  scores: [number, number];
  endNumber: number;
  jackTeam: number;
  currentTeam: number;
  currentPlayer: number;
  boulesLeft: number[];
  rotation: [number, number];
  lastThrowTeam: number | null;
  lastEnd: EndResult | null;
  winner: number | null;
}

// What the rules need to know about the pitch after a throw.
export interface FieldBall {
  id: number;
  team: number;
  distanceToJack: number;
}

export interface FieldSnapshot {
  jackAlive: boolean;
  boules: FieldBall[];
}

export function boulesPerPlayer(config: MatchConfig): number {
  return config.players.length > 2 ? matchConfig.boulesPerPlayerDoubles : matchConfig.boulesPerPlayerSingles;
}

function teamMembers(state: MatchState, team: number): number[] {
  return state.config.players.flatMap((player, index) => (player.team === team ? [index] : []));
}

export function teamBoulesLeft(state: MatchState, team: number): number {
  return teamMembers(state, team).reduce((total, index) => total + state.boulesLeft[index], 0);
}

// Picks the next teammate in rotation who still has boules (or anyone, for the jack).
function pickPlayer(state: MatchState, team: number, needsBoule: boolean): { player: number; rotation: [number, number] } {
  const members = teamMembers(state, team);
  const rotation: [number, number] = [...state.rotation];
  for (let offset = 0; offset < members.length; offset++) {
    const slot = (state.rotation[team] + offset) % members.length;
    const player = members[slot];
    if (!needsBoule || state.boulesLeft[player] > 0) {
      rotation[team] = (slot + 1) % members.length;
      return { player, rotation };
    }
  }
  return { player: members[0], rotation };
}

function startEnd(state: MatchState, jackTeam: number, endNumber: number): MatchState {
  const perPlayer = boulesPerPlayer(state.config);
  const base: MatchState = {
    ...state,
    phase: "jack",
    endNumber,
    jackTeam,
    currentTeam: jackTeam,
    boulesLeft: state.config.players.map(() => perPlayer),
    lastThrowTeam: null,
  };
  const pick = pickPlayer(base, jackTeam, false);
  return { ...base, currentPlayer: pick.player, rotation: pick.rotation };
}

export function createMatch(config: MatchConfig, firstTeam = 0): MatchState {
  const initial: MatchState = {
    config,
    phase: "jack",
    scores: [0, 0],
    endNumber: 1,
    jackTeam: firstTeam,
    currentTeam: firstTeam,
    currentPlayer: 0,
    boulesLeft: [],
    rotation: [0, 0],
    lastThrowTeam: null,
    lastEnd: null,
    winner: null,
  };
  return startEnd(initial, firstTeam, 1);
}

export function isJackPlacementValid(x: number, z: number): boolean {
  const distance = Math.hypot(x, z);
  return (
    distance >= pitch.jackMinDistance &&
    distance <= pitch.jackMaxDistance &&
    Math.abs(x) <= pitch.halfWidth - pitch.jackEdgeMargin
  );
}

export function afterJackThrow(state: MatchState, valid: boolean): MatchState {
  if (!valid) {
    return state;
  }
  // The jack-throwing team also throws the first boule; the jack thrower keeps the turn.
  return { ...state, phase: "boules" };
}

export function consumeBoule(state: MatchState): MatchState {
  const boulesLeft = [...state.boulesLeft];
  boulesLeft[state.currentPlayer] = Math.max(0, boulesLeft[state.currentPlayer] - 1);
  return { ...state, boulesLeft, lastThrowTeam: state.currentTeam };
}

export function teamHoldingPoint(field: FieldSnapshot): number | null | "tie" {
  if (field.boules.length === 0) {
    return null;
  }
  const sorted = [...field.boules].sort((a, b) => a.distanceToJack - b.distanceToJack);
  const best = sorted[0];
  const rival = sorted.find((ball) => ball.team !== best.team);
  if (rival && Math.abs(rival.distanceToJack - best.distanceToJack) < 1e-4) {
    return "tie";
  }
  return best.team;
}

export function scoreEnd(state: MatchState, field: FieldSnapshot): EndResult {
  if (!field.jackAlive) {
    const leftA = teamBoulesLeft(state, 0);
    const leftB = teamBoulesLeft(state, 1);
    if (leftA > 0 && leftB === 0) return { scoringTeam: 0, points: leftA, scoringBallIds: [], reason: "deadJack" };
    if (leftB > 0 && leftA === 0) return { scoringTeam: 1, points: leftB, scoringBallIds: [], reason: "deadJack" };
    return { scoringTeam: null, points: 0, scoringBallIds: [], reason: "deadJack" };
  }

  const holder = teamHoldingPoint(field);
  if (holder === null) return { scoringTeam: null, points: 0, scoringBallIds: [], reason: "empty" };
  if (holder === "tie") return { scoringTeam: null, points: 0, scoringBallIds: [], reason: "tie" };

  const rivalBest = Math.min(
    ...field.boules.filter((ball) => ball.team !== holder).map((ball) => ball.distanceToJack),
  );
  const scoring = field.boules
    .filter((ball) => ball.team === holder && ball.distanceToJack < rivalBest)
    .sort((a, b) => a.distanceToJack - b.distanceToJack);
  return { scoringTeam: holder, points: scoring.length, scoringBallIds: scoring.map((ball) => ball.id), reason: "closest" };
}

function finishEnd(state: MatchState, field: FieldSnapshot): MatchState {
  const result = scoreEnd(state, field);
  const scores: [number, number] = [...state.scores];
  if (result.scoringTeam !== null) {
    scores[result.scoringTeam] += result.points;
  }
  const winnerIndex = scores.findIndex((score) => score >= state.config.targetScore);
  return {
    ...state,
    scores,
    lastEnd: result,
    phase: winnerIndex >= 0 ? "matchOver" : "endOver",
    winner: winnerIndex >= 0 ? winnerIndex : null,
  };
}

export function afterBouleThrow(state: MatchState, field: FieldSnapshot): MatchState {
  const leftA = teamBoulesLeft(state, 0);
  const leftB = teamBoulesLeft(state, 1);

  if (!field.jackAlive || (leftA === 0 && leftB === 0)) {
    return finishEnd(state, field);
  }

  const holder = teamHoldingPoint(field);
  const last = state.lastThrowTeam ?? state.currentTeam;
  let nextTeam: number;

  if (holder === "tie") {
    nextTeam = last;
  } else if (holder === null) {
    nextTeam = 1 - last;
  } else {
    nextTeam = 1 - holder;
  }

  if (teamBoulesLeft(state, nextTeam) === 0) {
    nextTeam = 1 - nextTeam;
  }

  const pick = pickPlayer(state, nextTeam, true);
  return { ...state, currentTeam: nextTeam, currentPlayer: pick.player, rotation: pick.rotation };
}

export function nextEnd(state: MatchState): MatchState {
  const jackTeam = state.lastEnd?.scoringTeam ?? state.jackTeam;
  return { ...startEnd(state, jackTeam, state.endNumber + 1), lastEnd: state.lastEnd };
}
