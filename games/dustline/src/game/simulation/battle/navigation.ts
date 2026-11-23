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

/** Centre of the grid cell a point is in. */
export function cellCentre(grid: NavGrid, point: Vector2): Vector2 {
  const column = Math.min(grid.columns - 1, Math.max(0, Math.floor(point.x / grid.tileSize)));
  const row = Math.min(grid.rows - 1, Math.max(0, Math.floor(point.y / grid.tileSize)));
  return { x: column * grid.tileSize + grid.tileSize / 2, y: row * grid.tileSize + grid.tileSize / 2 };
}

/**
 * Open neighbouring cell centres around a point (4-way), nearest-first, for
 * backing out of a wedge.
 */
export function openNeighbourCentres(grid: NavGrid, point: Vector2): Vector2[] {
  const column = Math.floor(point.x / grid.tileSize);
  const row = Math.floor(point.y / grid.tileSize);
  const result: Vector2[] = [];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const c = column + dx;
    const r = row + dy;
    if (c < 0 || r < 0 || c >= grid.columns || r >= grid.rows || grid.blocked[r * grid.columns + c]) continue;
    result.push({ x: c * grid.tileSize + grid.tileSize / 2, y: r * grid.tileSize + grid.tileSize / 2 });
  }
  return result.sort(
    (a, b) => Math.hypot(a.x - point.x, a.y - point.y) - Math.hypot(b.x - point.x, b.y - point.y),
  );
}

/**
 * Breadth-first search from start to goal on the grid. Returns the centre of the
 * next cell to drive to, or null when already in the goal cell or unreachable.
 */
export function findNextWaypoint(grid: NavGrid, start: Vector2, goal: Vector2): Vector2 | null {
  return findPath(grid, start, goal)[0] ?? null;
}

/**
 * Breadth-first search from start to goal. Returns the cell centres to drive
 * through, in order, excluding the start cell. Empty when already in the goal
 * cell or the goal is unreachable.
 */
export function findPath(grid: NavGrid, start: Vector2, goal: Vector2): Vector2[] {
  const toIndex = (point: Vector2): number => {
    const column = Math.min(grid.columns - 1, Math.max(0, Math.floor(point.x / grid.tileSize)));
    const row = Math.min(grid.rows - 1, Math.max(0, Math.floor(point.y / grid.tileSize)));
    return row * grid.columns + column;
  };
  const startIndex = toIndex(start);
  const goalIndex = toIndex(goal);
  if (startIndex === goalIndex) {
    return [];
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
    return [];
  }

  const path: Vector2[] = [];
  for (let step = goalIndex; step !== startIndex; step = cameFrom[step]) {
    path.push({
      x: (step % grid.columns) * grid.tileSize + grid.tileSize / 2,
      y: Math.floor(step / grid.columns) * grid.tileSize + grid.tileSize / 2,
    });
  }
  return path.reverse();
}
