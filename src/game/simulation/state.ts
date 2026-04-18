export const SAVE_VERSION = 1;

export type Difficulty = "normal";

export interface UpgradeState {
  armor: number;
  optics: number;
  movement: number;
  turret: number;
}

export interface SaveData {
  version: number;
  profileName: string;
  createdAt: string;
  credits: number;
  currentLevelId: string;
  difficulty: Difficulty;
  upgrades: UpgradeState;
  unlockedWeapons: string[];
  completedPrompts: number[];
}

export interface HudSnapshot {
  hull: number;
  maxHull: number;
  credits: number;
  objective: string;
  milestone: string;
}

export function createInitialSave(): SaveData {
  return {
    version: SAVE_VERSION,
    profileName: "new-operator",
    createdAt: new Date().toISOString(),
    credits: 0,
    currentLevelId: "training-yard",
    difficulty: "normal",
    upgrades: {
      armor: 0,
      optics: 0,
      movement: 0,
      turret: 0,
    },
    unlockedWeapons: ["starter-cannon"],
    completedPrompts: [0],
  };
}
