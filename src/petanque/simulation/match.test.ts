import { describe, expect, it } from "vitest";
import { afterBouleThrow, afterJackThrow, consumeBoule, createMatch, isJackPlacementValid, nextEnd, scoreEnd, type MatchConfig } from "./match";

const singles: MatchConfig = {
  targetScore: 7,
  players: [
    { name: "A", characterId: "margot", team: 0, isCpu: false },
    { name: "B", characterId: "ziggy", team: 1, isCpu: false },
  ],
};

const doubles: MatchConfig = {
  targetScore: 13,
  players: [
    { name: "A1", characterId: "margot", team: 0, isCpu: false },
    { name: "B1", characterId: "ziggy", team: 1, isCpu: false },
    { name: "A2", characterId: "noor", team: 0, isCpu: false },
    { name: "B2", characterId: "bruno", team: 1, isCpu: false },
  ],
};

describe("petanque match rules", () => {
  it("validates the jack zone", () => {
    expect(isJackPlacementValid(0, -7)).toBe(true);
    expect(isJackPlacementValid(0, -4)).toBe(false);
    expect(isJackPlacementValid(0, -11)).toBe(false);
    expect(isJackPlacementValid(1.8, -7)).toBe(false);
  });

  it("gives the turn to the team that is not holding the point", () => {
    let state = afterJackThrow(createMatch(singles), true);
    expect(state.currentTeam).toBe(0);
    state = consumeBoule(state);
    state = afterBouleThrow(state, { jackAlive: true, boules: [{ id: 1, team: 0, distanceToJack: 0.3 }] });
    expect(state.currentTeam).toBe(1);
    state = consumeBoule(state);
    state = afterBouleThrow(state, {
      jackAlive: true,
      boules: [
        { id: 1, team: 0, distanceToJack: 0.3 },
        { id: 2, team: 1, distanceToJack: 0.6 },
      ],
    });
    expect(state.currentTeam).toBe(1);
  });

  it("scores every boule closer than the opponent's best", () => {
    const state = createMatch(singles);
    const result = scoreEnd(state, {
      jackAlive: true,
      boules: [
        { id: 1, team: 0, distanceToJack: 0.1 },
        { id: 2, team: 0, distanceToJack: 0.2 },
        { id: 3, team: 1, distanceToJack: 0.25 },
        { id: 4, team: 0, distanceToJack: 0.4 },
      ],
    });
    expect(result).toMatchObject({ scoringTeam: 0, points: 2, scoringBallIds: [1, 2] });
  });

  it("ends the end when all boules are thrown and hands the jack to the scorers", () => {
    let state = afterJackThrow(createMatch(singles), true);
    const field = { jackAlive: true, boules: [{ id: 9, team: 1, distanceToJack: 0.2 }] };
    for (let throwIndex = 0; throwIndex < 6; throwIndex++) {
      state = afterBouleThrow(consumeBoule(state), field);
    }
    expect(state.phase).toBe("endOver");
    expect(state.scores).toEqual([0, 1]);
    const next = nextEnd(state);
    expect(next.jackTeam).toBe(1);
    expect(next.boulesLeft).toEqual([3, 3]);
  });

  it("rotates teammates in doubles", () => {
    let state = afterJackThrow(createMatch(doubles), true);
    const throwers: string[] = [];
    const teamZeroAhead = { jackAlive: true, boules: [{ id: 1, team: 0, distanceToJack: 0.1 }] };
    for (let throwIndex = 0; throwIndex < 4; throwIndex++) {
      throwers.push(doubles.players[state.currentPlayer].name);
      state = afterBouleThrow(consumeBoule(state), teamZeroAhead);
    }
    expect(throwers).toEqual(["A1", "B1", "B2", "B1"]);
  });

  it("declares a winner at the target score", () => {
    let state = { ...afterJackThrow(createMatch(singles), true), scores: [6, 0] as [number, number] };
    state = { ...state, boulesLeft: [0, 1], currentTeam: 1, currentPlayer: 1 };
    state = afterBouleThrow(consumeBoule(state), { jackAlive: true, boules: [{ id: 1, team: 0, distanceToJack: 0.1 }] });
    expect(state.phase).toBe("matchOver");
    expect(state.winner).toBe(0);
  });
});
