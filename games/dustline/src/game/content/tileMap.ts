import { gameConfig } from "../config/gameConfig";
import type {
  BattleLevelData,
  BreakableLayoutRect,
  EnemyArchetype,
  EnemySpawn,
  LevelTier,
  PickupKind,
  PickupSpawn,
  Point,
  Rect,
  RoomKind,
} from "./levelTypes";

/**
 * Levels are drawn as text maps on one square grid: the same 64px cell as the
 * grass tiles and the fog of war. Every wall, brick and crate fills exactly one
 * cell, so all cover lines up.
 *
 *   #  steel wall (stone on the map edge)    .  floor
 *   b  brick wall (breakable)                B  reinforced brick (breakable, tougher)
 *   c  crate                                 $  gold crate (pays out when broken)
 *   o  coin                                  O  coin stash
 *   +  repair kit                            !  rapid-fire charge
 *   P  player start
 *   r  raider   s  skirmisher   h  bulwark   l  lancer   W  warden (boss)
 */
export const tileSize = gameConfig.gridSize;

const enemyByChar: Record<string, EnemyArchetype> = {
  r: "raider",
  s: "skirmisher",
  h: "bulwark",
  l: "lancer",
  W: "warden",
};

const pickupByChar: Record<string, { kind: PickupKind; value: number }> = {
  o: { kind: "coin", value: 35 },
  O: { kind: "coin", value: 90 },
  "+": { kind: "repair", value: 0 },
  "!": { kind: "rapidFire", value: 0 },
};

/** Archetypes that hold their post instead of walking a beat. */
const stationaryArchetypes = new Set<EnemyArchetype>(["lancer", "warden"]);

export const brickHealth = 68;
export const reinforcedBrickHealth = 115;
export const crateHealth = 34;
export const goldCrateReward = 25;

export interface RoomNote {
  kind: RoomKind;
  label: string;
}

export interface TileLevelSpec {
  id: string;
  name: string;
  briefing: string;
  tier: LevelTier;
  /** Short line for the level-select tile, e.g. "Introduces skirmishers". */
  tagline: string;
  /** The rooms in the order the map is meant to flow, shown on the briefing. */
  rooms: RoomNote[];
  map: readonly string[];
}

const solidChars = new Set(["#", "b", "B", "c", "$"]);

export function isSolidTile(char: string): boolean {
  return solidChars.has(char);
}

/** Turns a text map into level data the simulation and renderer understand. */
export function compileTileLevel(spec: TileLevelSpec): BattleLevelData {
  const rows = spec.map;
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  rows.forEach((row, index) => {
    if (row.length !== width) {
      throw new Error(`${spec.id}: row ${index} is ${row.length} wide, expected ${width}.`);
    }
  });

  const charAt = (column: number, row: number): string =>
    column < 0 || row < 0 || column >= width || row >= height ? "#" : rows[row][column];

  let playerSpawn: Point | null = null;
  const enemySpawns: EnemySpawn[] = [];
  const weakWalls: BreakableLayoutRect[] = [];
  const crates: BreakableLayoutRect[] = [];
  const pickups: PickupSpawn[] = [];
  const counters = new Map<string, number>();
  const nextId = (prefix: string): string => {
    const count = (counters.get(prefix) ?? 0) + 1;
    counters.set(prefix, count);
    return `${spec.id}-${prefix}-${count}`;
  };

  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const char = rows[row][column];
      const cell = cellRect(column, row);
      const center = cellCenter(column, row);

      if (char === "P") {
        playerSpawn = center;
      } else if (char === "b" || char === "B") {
        weakWalls.push({
          id: nextId(char === "B" ? "reinforced" : "brick"),
          ...cell,
          maxHealth: char === "B" ? reinforcedBrickHealth : brickHealth,
        });
      } else if (char === "c" || char === "$") {
        crates.push({
          id: nextId(char === "$" ? "goldCrate" : "crate"),
          ...cell,
          maxHealth: crateHealth,
          ...(char === "$" ? { rewardCredits: goldCrateReward } : {}),
        });
      } else if (pickupByChar[char]) {
        const pickup = pickupByChar[char];
        pickups.push({ id: nextId(pickup.kind), kind: pickup.kind, ...center, value: pickup.value });
      } else if (enemyByChar[char]) {
        const archetype = enemyByChar[char];
        const patrol = stationaryArchetypes.has(archetype) ? [] : autoPatrol(column, row, charAt);
        enemySpawns.push({
          id: nextId(archetype),
          ...center,
          archetype,
          ...(patrol.length ? { patrol } : {}),
        });
      } else if (char !== "#" && char !== ".") {
        throw new Error(`${spec.id}: unknown tile "${char}" at ${column},${row}.`);
      }
    }
  }

  if (!playerSpawn) {
    throw new Error(`${spec.id}: map has no player start (P).`);
  }

  return {
    id: spec.id,
    name: spec.name,
    briefing: spec.briefing,
    tagline: spec.tagline,
    tier: spec.tier,
    rooms: spec.rooms,
    width: width * tileSize,
    height: height * tileSize,
    playerSpawn,
    enemySpawns,
    indestructibleWalls: mergeWallCells(rows),
    weakWalls,
    crates,
    pickups,
  };
}

function cellRect(column: number, row: number): Rect {
  return { x: column * tileSize, y: row * tileSize, width: tileSize, height: tileSize };
}

function cellCenter(column: number, row: number): Point {
  return { x: column * tileSize + tileSize / 2, y: row * tileSize + tileSize / 2 };
}

/**
 * A short beat back and forth along the enemy's longest open line (up to three
 * cells each way), so rooms feel alive without hand-placed waypoints.
 */
function autoPatrol(column: number, row: number, charAt: (column: number, row: number) => string): Point[] {
  const reach = (dx: number, dy: number): number => {
    let steps = 0;
    while (steps < 3 && !isSolidTile(charAt(column + dx * (steps + 1), row + dy * (steps + 1)))) {
      // Keep one cell of clearance on both sides so a tank never scrapes a wall.
      const sideA = charAt(column + dx * (steps + 1) + dy, row + dy * (steps + 1) + dx);
      const sideB = charAt(column + dx * (steps + 1) - dy, row + dy * (steps + 1) - dx);
      if (isSolidTile(sideA) && isSolidTile(sideB)) break;
      steps += 1;
    }
    return steps;
  };

  const horizontal = { back: reach(-1, 0), forward: reach(1, 0) };
  const vertical = { back: reach(0, -1), forward: reach(0, 1) };
  const useHorizontal = horizontal.back + horizontal.forward >= vertical.back + vertical.forward;
  const span = useHorizontal ? horizontal : vertical;
  if (span.back + span.forward < 2) {
    return [];
  }

  const [dx, dy] = useHorizontal ? [1, 0] : [0, 1];
  return [
    cellCenter(column - dx * span.back, row - dy * span.back),
    cellCenter(column + dx * span.forward, row + dy * span.forward),
  ];
}

/**
 * Collision only needs the outline, so wall cells merge into as few rectangles
 * as possible: horizontal runs first, then identical runs stacked vertically.
 * The renderer still draws one square plate per cell.
 */
export function mergeWallCells(rows: readonly string[]): Rect[] {
  const runs: { column: number; row: number; length: number }[] = [];
  rows.forEach((line, row) => {
    let column = 0;
    while (column < line.length) {
      if (line[column] !== "#") {
        column += 1;
        continue;
      }
      const start = column;
      while (column < line.length && line[column] === "#") column += 1;
      runs.push({ column: start, row, length: column - start });
    }
  });

  const open = new Map<string, Rect>();
  const rects: Rect[] = [];
  runs.forEach((run) => {
    const key = `${run.column}:${run.length}`;
    const existing = open.get(key);
    if (existing && existing.y + existing.height === run.row * tileSize) {
      existing.height += tileSize;
      return;
    }
    const rect = { x: run.column * tileSize, y: run.row * tileSize, width: run.length * tileSize, height: tileSize };
    open.set(key, rect);
    rects.push(rect);
  });
  return rects;
}
