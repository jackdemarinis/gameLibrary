export interface Point {
  x: number;
  y: number;
}

export type EnemyArchetype = "chaser" | "heavy" | "flanker";

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
  kind: "coin";
  x: number;
  y: number;
  value: number;
  radius?: number;
}

export interface BattleLevelData {
  id: string;
  name: string;
  briefing: string;
  playerSpawn: Point;
  enemySpawns: EnemySpawn[];
  indestructibleWalls: Rect[];
  weakWalls: BreakableLayoutRect[];
  crates: BreakableLayoutRect[];
  pickups: PickupSpawn[];
}
