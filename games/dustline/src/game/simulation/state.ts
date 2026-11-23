import { initialWeaponId, weaponOrder, type WeaponKind } from "../content/weaponCatalog";

export const SAVE_VERSION = 4;
export const initialLevelId = "training-yard";
export { initialWeaponId };

export const difficultyOrder = ["rookie", "normal", "ace"] as const;
export type Difficulty = (typeof difficultyOrder)[number];

export interface DifficultyDefinition {
  key: Difficulty;
  label: string;
  summary: string;
}

export const difficultyDefinitions: readonly DifficultyDefinition[] = [
  {
    key: "rookie",
    label: "Rookie",
    summary: "Softer enemy armor and lighter return fire.",
  },
  {
    key: "normal",
    label: "Normal",
    summary: "Baseline campaign tuning.",
  },
  {
    key: "ace",
    label: "Ace",
    summary: "Harder enemy armor, tighter windows, higher risk.",
  },
];

export interface UpgradeState {
  maxHealth: number;
  movementSpeed: number;
  visibilityRadius: number;
  fireRate: number;
  turretRotationSpeed: number;
}

export interface SaveData {
  version: number;
  profileName: string;
  createdAt: string;
  credits: number;
  totalScore: number;
  currentLevelId: string;
  difficulty: Difficulty;
  hasSelectedDifficulty: boolean;
  upgrades: UpgradeState;
  /** Cannons the player owns, in catalog order. */
  unlockedWeapons: WeaponKind[];
  /** Damage level bought for each cannon (0 = base). */
  weaponLevels: Record<WeaponKind, number>;
  unlockedLevelIds: string[];
  completedLevelIds: string[];
}

export interface HudSnapshot {
  hull: number;
  maxHull: number;
  credits: number;
  objective: string;
  milestone: string;
}

export function createInitialUpgrades(): UpgradeState {
  return {
    maxHealth: 0,
    movementSpeed: 0,
    visibilityRadius: 0,
    fireRate: 0,
    turretRotationSpeed: 0,
  };
}

export function createInitialWeaponLevels(): Record<WeaponKind, number> {
  return Object.fromEntries(weaponOrder.map((kind) => [kind, 0])) as Record<WeaponKind, number>;
}

export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === "string" && difficultyOrder.includes(value as Difficulty);
}

export function normalizeDifficulty(value: unknown): Difficulty {
  return isDifficulty(value) ? value : "normal";
}

export function getDifficultyDefinition(difficulty: Difficulty): DifficultyDefinition {
  return (
    difficultyDefinitions.find((definition) => definition.key === difficulty) ??
    difficultyDefinitions[1]
  );
}

export function createInitialSave(
  overrides: Partial<Pick<SaveData, "difficulty" | "currentLevelId">> = {},
): SaveData {
  const difficulty = normalizeDifficulty(overrides.difficulty);

  return {
    version: SAVE_VERSION,
    profileName: "new-operator",
    createdAt: new Date().toISOString(),
    credits: 0,
    totalScore: 0,
    currentLevelId: overrides.currentLevelId ?? initialLevelId,
    difficulty,
    hasSelectedDifficulty: overrides.difficulty !== undefined,
    upgrades: createInitialUpgrades(),
    unlockedWeapons: [initialWeaponId],
    weaponLevels: createInitialWeaponLevels(),
    unlockedLevelIds: [initialLevelId],
    completedLevelIds: [],
  };
}
