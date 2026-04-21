import { battleConfig } from "../../config/battleConfig";
import type { Rect } from "../../content/levelTypes";
import {
  battleVisibilityTileState,
  type BattleVisibilityTileState,
  type BattleVisibilitySnapshot,
  type BattleVisibilitySettings,
  type BattleVisibilityState,
  type Vector2,
} from "./types";
import { hasLineOfSight } from "./vision";

export function createBattleVisibilityState(
  origin: Vector2,
  obstacles: readonly Rect[],
  settingsOverride: Partial<Pick<BattleVisibilitySettings, "radiusTiles">> = {},
): BattleVisibilityState {
  const tileSize = battleConfig.visibility.tileSize;
  const settings = {
    tileSize,
    columns: Math.ceil(battleConfig.visibility.worldWidth / tileSize),
    rows: Math.ceil(battleConfig.visibility.worldHeight / tileSize),
    radiusTiles: settingsOverride.radiusTiles ?? battleConfig.visibility.radiusTiles,
    refreshDistance: battleConfig.visibility.refreshDistance,
  };
  const state: BattleVisibilityState = {
    settings,
    tileStates: new Uint8Array(settings.columns * settings.rows),
    lastOrigin: { ...origin },
    version: 0,
  };

  refreshBattleVisibility(state, origin, obstacles, true);
  return state;
}

export function refreshBattleVisibility(
  state: BattleVisibilityState,
  origin: Vector2,
  obstacles: readonly Rect[],
  force = false,
): boolean {
  if (!force && !shouldRefreshVisibility(state, origin)) {
    return false;
  }

  const nextVisible = collectVisibleTileMask(state, origin, obstacles);
  let changed = false;

  for (let index = 0; index < state.tileStates.length; index += 1) {
    const currentState = state.tileStates[index];
    const nextState = nextVisible[index]
      ? battleVisibilityTileState.visible
      : currentState === battleVisibilityTileState.visible ||
          currentState === battleVisibilityTileState.explored
        ? battleVisibilityTileState.explored
        : battleVisibilityTileState.unexplored;

    if (nextState !== currentState) {
      state.tileStates[index] = nextState;
      changed = true;
    }
  }

  state.lastOrigin = { ...origin };

  if (changed) {
    state.version += 1;
  }

  return changed;
}

export function createBattleVisibilitySnapshot(
  state: BattleVisibilityState,
): BattleVisibilitySnapshot {
  return {
    tileSize: state.settings.tileSize,
    columns: state.settings.columns,
    rows: state.settings.rows,
    version: state.version,
    tileStates: new Uint8Array(state.tileStates),
  };
}

export function getVisibilityTileStateAtWorldPoint(
  snapshot: BattleVisibilitySnapshot,
  point: Vector2,
): BattleVisibilityTileState {
  const column = clampToGrid(Math.floor(point.x / snapshot.tileSize), snapshot.columns);
  const row = clampToGrid(Math.floor(point.y / snapshot.tileSize), snapshot.rows);
  return snapshot.tileStates[row * snapshot.columns + column] as BattleVisibilityTileState;
}

function shouldRefreshVisibility(state: BattleVisibilityState, origin: Vector2): boolean {
  const movedDistance = Math.hypot(origin.x - state.lastOrigin.x, origin.y - state.lastOrigin.y);

  if (movedDistance >= state.settings.refreshDistance) {
    return true;
  }

  const currentColumn = Math.floor(origin.x / state.settings.tileSize);
  const currentRow = Math.floor(origin.y / state.settings.tileSize);
  const lastColumn = Math.floor(state.lastOrigin.x / state.settings.tileSize);
  const lastRow = Math.floor(state.lastOrigin.y / state.settings.tileSize);

  return currentColumn !== lastColumn || currentRow !== lastRow;
}

function collectVisibleTileMask(
  state: BattleVisibilityState,
  origin: Vector2,
  obstacles: readonly Rect[],
): Uint8Array {
  const mask = new Uint8Array(state.tileStates.length);
  const radius = state.settings.radiusTiles * state.settings.tileSize;
  const radiusSquared = radius * radius;
  const minColumn = clampToGrid(Math.floor((origin.x - radius) / state.settings.tileSize), state.settings.columns);
  const maxColumn = clampToGrid(Math.floor((origin.x + radius) / state.settings.tileSize), state.settings.columns);
  const minRow = clampToGrid(Math.floor((origin.y - radius) / state.settings.tileSize), state.settings.rows);
  const maxRow = clampToGrid(Math.floor((origin.y + radius) / state.settings.tileSize), state.settings.rows);

  for (let row = minRow; row <= maxRow; row += 1) {
    for (let column = minColumn; column <= maxColumn; column += 1) {
      const center = getTileCenter(state, column, row);
      const dx = center.x - origin.x;
      const dy = center.y - origin.y;

      if (dx * dx + dy * dy > radiusSquared) {
        continue;
      }

      if (!hasLineOfSight(origin, center, obstacles)) {
        continue;
      }

      mask[row * state.settings.columns + column] = 1;
    }
  }

  const originColumn = clampToGrid(Math.floor(origin.x / state.settings.tileSize), state.settings.columns);
  const originRow = clampToGrid(Math.floor(origin.y / state.settings.tileSize), state.settings.rows);
  mask[originRow * state.settings.columns + originColumn] = 1;

  return mask;
}

function getTileCenter(
  state: BattleVisibilityState,
  column: number,
  row: number,
): Vector2 {
  const offset = state.settings.tileSize / 2;
  return {
    x: column * state.settings.tileSize + offset,
    y: row * state.settings.tileSize + offset,
  };
}
function clampToGrid(value: number, max: number): number {
  return Math.max(0, Math.min(value, max - 1));
}
