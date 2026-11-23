import type { EnemyArchetype, PickupKind, Rect, BattleLevelData, SupplyDrop } from "../../content/levelTypes";
import type { WeaponKind } from "../../content/weaponCatalog";
import type { NavGrid } from "./navigation";

export type BattleStatus = "active" | "won" | "lost";
export type TankFaction = "player" | "enemy";
export type BreakableObstacleKind = "crate" | "weakWall" | "supplyCrate" | "spawner";
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
  /** The cannon it carries; drives shell behaviour, art and sound. */
  weapon: WeaponKind;
  /** Shells per volley and the fan they spread across. */
  shotCount: number;
  spreadRadians: number;
  /** Random wobble per shell, how far shells fly, their size, wall bounces and tanks pierced. */
  aimJitterRadians: number;
  projectileRangePx: number;
  projectileRadius: number;
  projectileBounces: number;
  projectilePierce: number;
  /** Next grid waypoint when chasing around corners, and when to recompute it. */
  navWaypoint: Vector2 | null;
  navRefreshMs: number;
  /** Corner-stuck detection: where the tank last made progress, and for how long it hasn't. */
  progressAnchor: Vector2;
  stuckMs: number;
  /** While set, the tank backs off to this open cell centre to get unstuck. */
  unstickTarget: Vector2 | null;
  unstickRemainingMs: number;
  /** Engage behaviour, kept until the range clearly changes (stops flip-flopping at the edges). */
  engageMode: "chase" | "strafe" | "backOff";
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
  /** Current random strafe leg and when it ends (see buildStrafeTarget). */
  strafeLeg: number;
  strafeLegEndMs: number;
  alive: boolean;
}

export interface SpawnerState {
  roster: EnemyArchetype[];
  rosterIndex: number;
  cooldownMs: number;
  /** Ids of the enemies it produced that are still alive. */
  liveSpawnIds: string[];
}

export interface BreakableObstacleState {
  id: string;
  kind: BreakableObstacleKind;
  rect: Rect;
  health: number;
  maxHealth: number;
  rewardCredits: number;
  rewardScore: number;
  /** Supply crates: the power-up left behind when broken. */
  drop: SupplyDrop | null;
  /** Spawners only. */
  spawner: SpawnerState | null;
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
  kind: WeaponKind;
  /** Wall rebounds left (ricochet shells). */
  bouncesLeft: number;
  /** Extra tanks it can still pass through (laser bolts), and the ones it already hit. */
  pierceLeft: number;
  hitTankIds: string[];
  /** How long it has been flying (seeker missiles fly straight at first). */
  ageMs: number;
}

/** One cannon in the player's inventory, with upgrades already applied. */
export interface PlayerWeapon {
  kind: WeaponKind;
  name: string;
  shortName: string;
  level: number;
  damage: number;
  cooldownMs: number;
  projectileSpeed: number;
  rangePx: number;
  shotCount: number;
  spreadRadians: number;
  jitterRadians: number;
  bounces: number;
  pierce: number;
  radius: number;
  recoilKick: number;
}

export interface PickupState {
  id: string;
  kind: PickupKind;
  position: Vector2;
  radius: number;
  value: number;
  scoreValue: number;
}

/** What the audio layer plays for an effect. The simulation decides; the scene just plays it. */
export type SoundCue =
  | "playerShot"
  | "enemyShot"
  | "heavyShot"
  | "autoShot"
  | "scatterShot"
  | "ricochetShot"
  | "laserShot"
  | "missileShot"
  | "ricochet"
  | "weaponSwitch"
  | "hitEnemy"
  | "hitWall"
  | "hitCrate"
  | "hitMetal"
  | "playerHurt"
  | "tankDestroyed"
  | "playerDestroyed"
  | "missionFailed"
  | "crateBreak"
  | "wallBreak"
  | "spawnerDestroyed"
  | "spawn"
  | "coin"
  | "repair"
  | "rapidFire"
  | "freeze";

export interface SimulationEffect {
  /** "sound" plays its cue with no visual. */
  type: "impact" | "explosion" | "pickup" | "muzzleFlash" | "debris" | "sound";
  sound?: SoundCue;
  /** Muzzle flashes: which cannon fired, so the blast sprite matches it. */
  weapon?: WeaponKind;
  faction?: TankFaction;
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
  worldWidth: number;
  worldHeight: number;
  navGrid: NavGrid;
  /** Time left on the player's rapid-fire charge. */
  rapidFireRemainingMs: number;
  obstacles: Rect[];
  breakableObstacles: BreakableObstacleState[];
  visibility: BattleVisibilityState;
  player: TankState;
  /** The player's cannons (inventory slots 1..n) and which one is in hand. */
  playerLoadout: PlayerWeapon[];
  activeWeaponIndex: number;
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
  /** Enemies and spawners stand still while this runs down. */
  freezeRemainingMs: number;
  nextSpawnId: number;
  difficulty: DifficultyTuning;
}

export interface DifficultyTuning {
  enemyHealthMultiplier: number;
  enemyDamageMultiplier: number;
  enemyFireCooldownMultiplier: number;
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
  weapon: WeaponKind;
  showHealthBar: boolean;
  /** Held by a freeze power-up: the renderer tints it icy. */
  frozen: boolean;
  aiState: EnemyAiStateName | null;
  alive: boolean;
}

export interface BreakableObstacleSnapshot extends Rect {
  id: string;
  kind: BreakableObstacleKind;
  health: number;
  maxHealth: number;
  /** Gold crates pay out; the renderer paints them differently. */
  rewardCredits: number;
  /** Supply crates show which power-up is inside. */
  drop: SupplyDrop | null;
}

export interface ProjectileSnapshot {
  id: string;
  faction: TankFaction;
  kind: WeaponKind;
  x: number;
  y: number;
  /** Direction of travel, for the shell sprite. */
  rotation: number;
  radius: number;
}

export interface HudWeaponSlot {
  slot: number;
  kind: WeaponKind;
  shortName: string;
  level: number;
  active: boolean;
}

export interface PickupSnapshot {
  id: string;
  x: number;
  y: number;
  radius: number;
  kind: PickupKind;
}

export interface BattleSnapshot {
  status: BattleStatus;
  visibility: BattleVisibilitySnapshot;
  player: TankSnapshot;
  enemies: TankSnapshot[];
  projectiles: ProjectileSnapshot[];
  pickups: PickupSnapshot[];
  worldWidth: number;
  worldHeight: number;
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
  /** Whole seconds of rapid fire left (0 = none). */
  rapidFireSeconds: number;
  /** Whole seconds of enemy freeze left (0 = none). */
  freezeSeconds: number;
  spawnersRemaining: number;
  weapons: HudWeaponSlot[];
  controls: string[];
}

export interface BattleAdvanceResult {
  effects: SimulationEffect[];
  snapshot: BattleSnapshot;
  hud: BattleHudSnapshot;
}
