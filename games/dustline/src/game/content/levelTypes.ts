export interface Point {
  x: number;
  y: number;
}

/** Raider: standard. Skirmisher: fast and light. Bulwark: slow twin-barrel armour.
 *  Lancer: long-range sniper. Warden: the boss, fires a three-shell spread. */
export type EnemyArchetype = "raider" | "skirmisher" | "bulwark" | "lancer" | "warden";

/** What a room is for in the flow of a map. */
export type RoomKind = "staging" | "skirmish" | "chokepoint" | "vault" | "hard" | "command";

/** How hard a map is, shown as a badge on level select. */
export type LevelTier = "easy" | "medium" | "bonus" | "hard" | "boss";

export type PickupKind = "coin" | "repair" | "rapidFire";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EnemySpawn {
  id: string;
  x: number;
  y: number;
  archetype: EnemyArchetype;
  patrol?: Point[];
}

export interface BreakableLayoutRect extends Rect {
  id: string;
  maxHealth: number;
  rewardCredits?: number;
}

export interface PickupSpawn {
  id: string;
  kind: PickupKind;
  x: number;
  y: number;
  value: number;
  radius?: number;
}

export interface BattleLevelData {
  id: string;
  name: string;
  briefing: string;
  /** Short line for level select. */
  tagline?: string;
  tier?: LevelTier;
  /** Room-by-room flow, in order, for the briefing screen. */
  rooms?: { kind: RoomKind; label: string }[];
  /** World size in px. Defaults to gameConfig.worldWidth/worldHeight. */
  width?: number;
  height?: number;
  playerSpawn: Point;
  enemySpawns: EnemySpawn[];
  indestructibleWalls: Rect[];
  weakWalls: BreakableLayoutRect[];
  crates: BreakableLayoutRect[];
  pickups: PickupSpawn[];
}
