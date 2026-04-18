import { SAVE_VERSION, createInitialSave, type SaveData } from "./state";

const SAVE_KEY = "dustline-brigade/save";

export interface SaveStore {
  key: string;
  load(): SaveData | null;
  loadOrCreate(): SaveData;
  write(data: SaveData): void;
  clear(): void;
}

function isSaveData(value: unknown): value is SaveData {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<SaveData>;

  return (
    candidate.version === SAVE_VERSION &&
    typeof candidate.profileName === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.credits === "number" &&
    typeof candidate.currentLevelId === "string" &&
    Array.isArray(candidate.unlockedWeapons) &&
    Array.isArray(candidate.completedPrompts)
  );
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

        return isSaveData(parsed) ? parsed : null;
      } catch {
        return null;
      }
    },
    loadOrCreate() {
      const existing = this.load();

      if (existing) {
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
