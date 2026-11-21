import type { EnemyArchetype, Rect, BattleLevelData } from "../../content/levelTypes";

export type BattleStatus = "active" | "won" | "lost";
export type TankFaction = "player" | "enemy";
export type BreakableObstacleKind = "crate" | "weakWall";
export type EnemyAiStateName = "idle" | "patrol" | "investigate" | "engage" | "reposition";
export const battleVisibilityTileState = {
  unexplored: 0,
  explored: 1,
  visible: 2,
} as const;
export type BattleVisibilityTileState =
  (typeof battleVisibilityTileState)[keyof typeof battleVisibilityTileState];

export interface Vector2 {
  x: number;
  y: number;
}

export interface BattleVisibilitySettings {
  tileSize: number;
  columns: number;
  rows: number;
  radiusTiles: number;
  refreshDistance: number;
}

export interface BattleResultSummary {
  status: BattleStatus;
  levelId: string;
  levelName: string;
  creditsEarned: number;
  pointsEarned: number;
  totalScore: number;
  damageTaken: number;
  completionTimeMs: number;
}

export interface BattleVisibilityState {
  settings: BattleVisibilitySettings;
  tileStates: Uint8Array;
  lastOrigin: Vector2;
  version: number;
}

export interface BattleVisibilitySnapshot {
  tileSize: number;
  columns: number;
  rows: number;
  version: number;
  tileStates: Uint8Array;
}

export interface TankState {
  id: string;
  faction: TankFaction;
  archetype: EnemyArchetype | null;
  position: Vector2;
  hullRotation: number;
  turretRotation: number;
  radius: number;
  health: number;
  maxHealth: number;
  moveSpeed: number;
  turretTurnSpeed: number;
  fireCooldownMs: number;
  fireCooldownRemainingMs: number;
  projectileSpeed: number;
  projectileDamage: number;
  muzzleOffset: number;
  recoilKick: number;
  recoilRecoveryPerSecond: number;
  recoilOffset: number;
  recentDamageMs: number;
  rewardCredits: number;
  rewardScore: number;
  sightRange: number;
  nearbyRange: number;
  preferredRange: number;
  engageRange: number;
  aimInaccuracyRadians: number;
  repositionDistance: number;
  patrolPoints: Vector2[];
  aiState: EnemyAiStateName | null;
  aiStateElapsedMs: number;
  patrolIndex: number;
  lastKnownPlayerPosition: Vector2 | null;
  repositionTarget: Vector2 | null;
  behaviorSeed: number;
  alive: boolean;
}

export interface BreakableObstacleState {
  id: string;
  kind: BreakableObstacleKind;
  rect: Rect;
  health: number;
  maxHealth: number;
  rewardCredits: number;
  rewardScore: number;
  alive: boolean;
}

export interface ProjectileState {
  id: string;
  ownerId: string;
  faction: TankFaction;
  position: Vector2;
  velocity: Vector2;
  radius: number;
  damage: number;
  ttlMs: number;
}

export interface PickupState {
  id: string;
  kind: "coin";
  position: Vector2;
  radius: number;
  value: number;
  scoreValue: number;
}

export interface SimulationEffect {
  type: "impact" | "explosion" | "pickup" | "muzzleFlash" | "debris";
  x: number;
  y: number;
  color: number;
  size: number;
  rotation?: number;
  count?: number;
  lifetimeMs?: number;
  shakeDurationMs?: number;
  shakeIntensity?: number;
}

export interface BattleInput {
  movementX: number;
  movementY: number;
  aim: Vector2;
  firing: boolean;
}

export interface BattleState {
  level: BattleLevelData;
  obstacles: Rect[];
  breakableObstacles: BreakableObstacleState[];
  visibility: BattleVisibilityState;
  player: TankState;
  enemies: TankState[];
  projectiles: ProjectileState[];
  pickups: PickupState[];
  credits: number;
  startingCredits: number;
  creditsEarned: number;
  totalScore: number;
  startingTotalScore: number;
  pointsEarned: number;
  damageTaken: number;
  elapsedMs: number;
  status: BattleStatus;
  nextProjectileId: number;
  nextPickupId: number;
}

export interface TankSnapshot {
  id: string;
  faction: TankFaction;
  archetype: EnemyArchetype | null;
  x: number;
  y: number;
  hullRotation: number;
  turretRotation: number;
  health: number;
  maxHealth: number;
  recoilOffset: number;
  showHealthBar: boolean;
  aiState: EnemyAiStateName | null;
  alive: boolean;
}

export interface BreakableObstacleSnapshot extends Rect {
  id: string;
  kind: BreakableObstacleKind;
  health: number;
  maxHealth: number;
}

export interface ProjectileSnapshot {
  id: string;
  faction: TankFaction;
  x: number;
  y: number;
  radius: number;
}

export interface PickupSnapshot {
  id: string;
  x: number;
  y: number;
  radius: number;
  kind: "coin";
}

export interface BattleSnapshot {
  status: BattleStatus;
  visibility: BattleVisibilitySnapshot;
  player: TankSnapshot;
  enemies: TankSnapshot[];
  projectiles: ProjectileSnapshot[];
  pickups: PickupSnapshot[];
  indestructibleWalls: readonly Rect[];
  breakableObstacles: readonly BreakableObstacleSnapshot[];
  credits: number;
  totalScore: number;
  elapsedMs: number;
}

export interface BattleHudSnapshot {
  title: string;
  summary: string;
  objective: string;
  health: number;
  maxHealth: number;
  credits: number;
  totalScore: number;
  enemiesRemaining: number;
  controls: string[];
}

export interface BattleAdvanceResult {
  effects: SimulationEffect[];
  snapshot: BattleSnapshot;
  hud: BattleHudSnapshot;
}
