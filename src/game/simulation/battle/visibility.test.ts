import { describe, expect, it } from "vitest";
import { battleVisibilityTileState } from "./types";
import {
  createBattleVisibilitySnapshot,
  createBattleVisibilityState,
  getVisibilityTileStateAtWorldPoint,
  refreshBattleVisibility,
} from "./visibility";

describe("battle visibility", () => {
  it("keeps explored tiles revealed after the player moves onward", () => {
    const state = createBattleVisibilityState({ x: 64, y: 64 }, []);

    let snapshot = createBattleVisibilitySnapshot(state);
    expect(getVisibilityTileStateAtWorldPoint(snapshot, { x: 64, y: 64 })).toBe(
      battleVisibilityTileState.visible,
    );

    refreshBattleVisibility(state, { x: 320, y: 64 }, []);
    snapshot = createBattleVisibilitySnapshot(state);

    expect(getVisibilityTileStateAtWorldPoint(snapshot, { x: 64, y: 64 })).toBe(
      battleVisibilityTileState.explored,
    );
    expect(getVisibilityTileStateAtWorldPoint(snapshot, { x: 320, y: 64 })).toBe(
      battleVisibilityTileState.visible,
    );
  });

  it("blocks tiles behind walls while still revealing the blocking wall face", () => {
    const wall = { x: 128, y: 32, width: 64, height: 192 };
    const state = createBattleVisibilityState({ x: 64, y: 128 }, [wall]);
    const snapshot = createBattleVisibilitySnapshot(state);

    expect(getVisibilityTileStateAtWorldPoint(snapshot, { x: 160, y: 128 })).toBe(
      battleVisibilityTileState.visible,
    );
    expect(getVisibilityTileStateAtWorldPoint(snapshot, { x: 288, y: 128 })).toBe(
      battleVisibilityTileState.unexplored,
    );
  });

  it("skips recomputing the mask when the player has not moved enough", () => {
    const state = createBattleVisibilityState({ x: 64, y: 64 }, []);
    const initialVersion = state.version;

    refreshBattleVisibility(state, { x: 70, y: 68 }, []);

    expect(state.version).toBe(initialVersion);
  });
});
