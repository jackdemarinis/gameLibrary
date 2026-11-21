import { battleConfig } from "../config/battleConfig";
import { battleLevelOrder, getBattleLevelById } from "../content/levelCatalog";
import { getWeaponDefinition } from "../content/weaponCatalog";
import {
  SAVE_VERSION,
  createInitialSave,
  createInitialUpgrades,
  initialLevelId,
  initialWeaponId,
  normalizeDifficulty,
  type SaveData,
  type UpgradeState,
} from "./state";

const SAVE_KEY = "dustline-brigade/save";

export interface SaveStore {
  key: string;
  load(): SaveData | null;
  loadOrCreate(): SaveData;
  write(data: SaveData): void;
  clear(): void;
}

export function createSaveStore(storage: Storage): SaveStore {
  return {
    key: SAVE_KEY,
    load() {
      const raw = storage.getItem(SAVE_KEY);

      if (!raw) {
        return null;
      }

      try {
        const parsed = JSON.parse(raw) as unknown;

        return normalizeSaveData(parsed);
      } catch {
        return null;
      }
    },
    loadOrCreate() {
      const existing = this.load();

      if (existing) {
        const serialized = JSON.stringify(existing);

        if (storage.getItem(SAVE_KEY) !== serialized) {
          storage.setItem(SAVE_KEY, serialized);
        }

        return existing;
      }

      const save = createInitialSave();
      this.write(save);
      return save;
    },
    write(data) {
      storage.setItem(SAVE_KEY, JSON.stringify(data));
    },
    clear() {
      storage.removeItem(SAVE_KEY);
    },
  };
}

function normalizeSaveData(value: unknown): SaveData | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const hasRecognizableSaveFields = [
    "version",
    "profileName",
    "credits",
    "totalScore",
    "currentLevelId",
    "difficulty",
    "hasSelectedDifficulty",
    "upgrades",
    "unlockedWeapons",
    "unlockedLevelIds",
    "completedLevelIds",
    "completedPrompts",
  ].some((key) => key in candidate);

  if (!hasRecognizableSaveFields) {
    return null;
  }

  const currentLevelId = normalizeLevelId(candidate.currentLevelId);
  const completedLevelIds = normalizeCompletedLevelIds(candidate.completedLevelIds, candidate, currentLevelId);
  const unlockedLevelIds = normalizeUnlockedLevelIds(candidate.unlockedLevelIds, currentLevelId, completedLevelIds);
  const unlockedWeapons = normalizeUnlockedWeapons(candidate.unlockedWeapons);
  const upgrades = normalizeUpgrades(candidate.upgrades);

  return {
    version: SAVE_VERSION,
    profileName:
      typeof candidate.profileName === "string" && candidate.profileName.trim().length > 0
        ? candidate.profileName
        : "new-operator",
    createdAt:
      typeof candidate.createdAt === "string" && candidate.createdAt.length > 0
        ? candidate.createdAt
        : new Date().toISOString(),
    credits: normalizeCredits(candidate.credits),
    totalScore: normalizeScore(candidate.totalScore),
    currentLevelId,
    difficulty: normalizeDifficulty(candidate.difficulty),
    hasSelectedDifficulty: normalizeHasSelectedDifficulty(candidate),
    upgrades,
    unlockedWeapons,
    unlockedLevelIds,
    completedLevelIds,
  };
}

function normalizeCredits(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function normalizeScore(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function normalizeHasSelectedDifficulty(candidate: Record<string, unknown>): boolean {
  if (typeof candidate.hasSelectedDifficulty === "boolean") {
    return candidate.hasSelectedDifficulty;
  }

  return "difficulty" in candidate;
}

function normalizeLevelId(value: unknown): string {
  if (typeof value !== "string") {
    return initialLevelId;
  }

  return getBattleLevelById(value).id;
}

function normalizeCompletedLevelIds(
  completedLevelIds: unknown,
  candidate: Record<string, unknown>,
  currentLevelId: string,
): string[] {
  const explicit = normalizeLevelIdArray(completedLevelIds);

  if (explicit.length > 0) {
    return explicit;
  }

  const legacyCompletedPrompts = Array.isArray(candidate.completedPrompts)
    ? candidate.completedPrompts.filter((entry): entry is number => typeof entry === "number")
    : [];
  const currentLevelIndex = battleLevelOrder.findIndex((level) => level.id === currentLevelId);

  if (legacyCompletedPrompts.includes(4) && currentLevelIndex >= 1) {
    return battleLevelOrder.slice(0, currentLevelIndex).map((level) => level.id);
  }

  if (currentLevelIndex >= 1) {
    return battleLevelOrder.slice(0, currentLevelIndex).map((level) => level.id);
  }

  return [];
}

function normalizeUnlockedLevelIds(
  unlockedLevelIds: unknown,
  currentLevelId: string,
  completedLevelIds: string[],
): string[] {
  const explicit = normalizeLevelIdArray(unlockedLevelIds);

  if (explicit.length > 0) {
    return sortCampaignIds([...new Set([...explicit, currentLevelId, initialLevelId])]);
  }

  const currentLevelIndex = battleLevelOrder.findIndex((level) => level.id === currentLevelId);
  const completedSet = new Set(completedLevelIds);
  const highestCompletedIndex = battleLevelOrder.reduce(
    (highestIndex, level, index) => (completedSet.has(level.id) ? index : highestIndex),
    -1,
  );
  const highestUnlockedIndex = Math.max(
    currentLevelIndex,
    highestCompletedIndex + 1,
    0,
  );

  return battleLevelOrder
    .slice(0, Math.max(1, highestUnlockedIndex + 1))
    .map((level) => level.id);
}

function normalizeUnlockedWeapons(value: unknown): string[] {
  const explicit =
    Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === "string" && Boolean(getWeaponDefinition(entry)))
      : [];

  if (explicit.length > 0) {
    return sortWeaponIds([...new Set([initialWeaponId, ...explicit])]);
  }

  return [initialWeaponId];
}

function normalizeUpgrades(value: unknown): UpgradeState {
  const initial = createInitialUpgrades();

  if (!value || typeof value !== "object") {
    return initial;
  }

  const candidate = value as Record<string, unknown>;
  const legacyTurretLevel = normalizeUpgradeLevel(candidate.turret);

  return {
    maxHealth: normalizeUpgradeLevel(candidate.maxHealth ?? candidate.armor),
    movementSpeed: normalizeUpgradeLevel(candidate.movementSpeed ?? candidate.movement),
    weaponDamage: normalizeUpgradeLevel(candidate.weaponDamage ?? candidate.turret),
    visibilityRadius: normalizeUpgradeLevel(candidate.visibilityRadius ?? candidate.optics),
    fireRate: normalizeUpgradeLevel(candidate.fireRate ?? candidate.turret),
    turretRotationSpeed: normalizeUpgradeLevel(
      candidate.turretRotationSpeed ?? Math.max(0, legacyTurretLevel - 1),
    ),
  };
}

function normalizeUpgradeLevel(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(battleConfig.shop.maxUpgradeLevel, Math.floor(value)));
}

function normalizeLevelIdArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return sortCampaignIds(
    value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => normalizeLevelId(entry)),
  );
}

function sortCampaignIds(levelIds: string[]): string[] {
  const seen = new Set<string>();

  return battleLevelOrder
    .map((level) => level.id)
    .filter((levelId) => {
      if (!levelIds.includes(levelId) || seen.has(levelId)) {
        return false;
      }

      seen.add(levelId);
      return true;
    });
}

function sortWeaponIds(weaponIds: string[]): string[] {
  const priority = new Map(
    [initialWeaponId, "burst-cannon", "longshot-cannon"].map((id, index) => [id, index]),
  );

  return [...weaponIds].sort((left, right) => (priority.get(left) ?? 999) - (priority.get(right) ?? 999));
}
