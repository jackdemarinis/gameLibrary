import type { Rect, BattleLevelData } from "../../content/levelTypes";

export type BattleStatus = "active" | "won" | "lost";
export type TankFaction = "player" | "enemy";

export interface Vector2 {
  x: number;
  y: number;
}

export interface TankState {
  id: string;
  faction: TankFaction;
  position: Vector2;
  hullRotation: number;
  turretRotation: number;
  radius: number;
  health: number;
  maxHealth: number;
  moveSpeed: number;
  fireCooldownMs: number;
  fireCooldownRemainingMs: number;
  projectileSpeed: number;
  projectileDamage: number;
  muzzleOffset: number;
  rewardCredits: number;
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
}

export interface SimulationEffect {
  type: "impact" | "explosion" | "pickup";
  x: number;
  y: number;
  color: number;
  size: number;
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
  player: TankState;
  enemies: TankState[];
  projectiles: ProjectileState[];
  pickups: PickupState[];
  credits: number;
  elapsedMs: number;
  status: BattleStatus;
  nextProjectileId: number;
  nextPickupId: number;
}

export interface TankSnapshot {
  id: string;
  faction: TankFaction;
  x: number;
  y: number;
  hullRotation: number;
  turretRotation: number;
  health: number;
  maxHealth: number;
  alive: boolean;
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
  player: TankSnapshot;
  enemies: TankSnapshot[];
  projectiles: ProjectileSnapshot[];
  pickups: PickupSnapshot[];
  walls: readonly Rect[];
  crates: readonly Rect[];
  credits: number;
  elapsedMs: number;
}

export interface BattleHudSnapshot {
  status: BattleStatus;
  title: string;
  summary: string;
  objective: string;
  health: number;
  maxHealth: number;
  credits: number;
  enemiesRemaining: number;
  controls: string[];
}

export interface BattleAdvanceResult {
  effects: SimulationEffect[];
  snapshot: BattleSnapshot;
  hud: BattleHudSnapshot;
}
