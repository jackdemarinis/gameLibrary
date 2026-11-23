import type { Rect } from "../../content/levelTypes";
import type { Vector2 } from "./types";

/** Blocked/open cells on the level grid, used for enemy pathfinding around rooms. */
export interface NavGrid {
  tileSize: number;
  columns: number;
  rows: number;
  blocked: Uint8Array;
}

export function createNavGrid(worldWidth: number, worldHeight: number, tileSize: number, obstacles: readonly Rect[]): NavGrid {
  const columns = Math.ceil(worldWidth / tileSize);
  const rows = Math.ceil(worldHeight / tileSize);
  const grid: NavGrid = { tileSize, columns, rows, blocked: new Uint8Array(columns * rows) };
  rebuildNavGrid(grid, obstacles);
  return grid;
}

export function rebuildNavGrid(grid: NavGrid, obstacles: readonly Rect[]): void {
  grid.blocked.fill(0);
  obstacles.forEach((rect) => {
    const startColumn = Math.max(0, Math.floor(rect.x / grid.tileSize));
    const endColumn = Math.min(grid.columns - 1, Math.ceil((rect.x + rect.width) / grid.tileSize) - 1);
    const startRow = Math.max(0, Math.floor(rect.y / grid.tileSize));
    const endRow = Math.min(grid.rows - 1, Math.ceil((rect.y + rect.height) / grid.tileSize) - 1);
    for (let row = startRow; row <= endRow; row += 1) {
      for (let column = startColumn; column <= endColumn; column += 1) {
        grid.blocked[row * grid.columns + column] = 1;
      }
    }
  });
}

/**
 * Breadth-first search from start to goal on the grid. Returns the centre of the
 * next cell to drive to, or null when already in the goal cell or unreachable.
 */
export function findNextWaypoint(grid: NavGrid, start: Vector2, goal: Vector2): Vector2 | null {
  const toIndex = (point: Vector2): number => {
    const column = Math.min(grid.columns - 1, Math.max(0, Math.floor(point.x / grid.tileSize)));
    const row = Math.min(grid.rows - 1, Math.max(0, Math.floor(point.y / grid.tileSize)));
    return row * grid.columns + column;
  };
  const startIndex = toIndex(start);
  const goalIndex = toIndex(goal);
  if (startIndex === goalIndex) {
    return null;
  }

  const cameFrom = new Int32Array(grid.columns * grid.rows).fill(-1);
  cameFrom[startIndex] = startIndex;
  const queue = [startIndex];
  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head];
    if (current === goalIndex) break;
    const column = current % grid.columns;
    const row = Math.floor(current / grid.columns);
    const neighbours = [
      column > 0 ? current - 1 : -1,
      column < grid.columns - 1 ? current + 1 : -1,
      row > 0 ? current - grid.columns : -1,
      row < grid.rows - 1 ? current + grid.columns : -1,
    ];
    neighbours.forEach((next) => {
      if (next >= 0 && cameFrom[next] === -1 && !grid.blocked[next]) {
        cameFrom[next] = current;
        queue.push(next);
      }
    });
  }

  if (cameFrom[goalIndex] === -1) {
    return null;
  }

  let step = goalIndex;
  while (cameFrom[step] !== startIndex) {
    step = cameFrom[step];
  }
  return {
    x: (step % grid.columns) * grid.tileSize + grid.tileSize / 2,
    y: Math.floor(step / grid.columns) * grid.tileSize + grid.tileSize / 2,
  };
}
