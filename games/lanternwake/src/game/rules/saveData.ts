// The save file: what a checkpoint remembers. Parsing is defensive because it comes
// from localStorage, which a player (or an old version) may have changed.

export interface SaveData {
  version: 1;
  areaId: string;
  spawnId: string;
  xp: number;
  heartContainers: number;
  flags: string[];
  playSeconds: number;
  /** The last hint the game gave, for the quest journal. */
  lastHint?: string;
}

export const saveKey = "lanternwake3d.save.v1";

export function newSave(): SaveData {
  return { version: 1, areaId: "wickmoor", spawnId: "start", xp: 0, heartContainers: 0, flags: [], playSeconds: 0 };
}

export function parseSave(raw: string | null): SaveData | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<SaveData>;
    if (value.version !== 1 || typeof value.areaId !== "string" || typeof value.spawnId !== "string") return null;
    return {
      version: 1,
      areaId: value.areaId,
      spawnId: value.spawnId,
      xp: Number.isFinite(value.xp) ? Math.max(0, Number(value.xp)) : 0,
      heartContainers: Number.isFinite(value.heartContainers) ? Math.max(0, Math.floor(Number(value.heartContainers))) : 0,
      flags: Array.isArray(value.flags) ? value.flags.filter((flag): flag is string => typeof flag === "string") : [],
      playSeconds: Number.isFinite(value.playSeconds) ? Math.max(0, Number(value.playSeconds)) : 0,
      lastHint: typeof value.lastHint === "string" ? value.lastHint.slice(0, 300) : undefined,
    };
  } catch {
    return null;
  }
}

export function loadSave(): SaveData | null {
  try {
    return parseSave(window.localStorage.getItem(saveKey));
  } catch {
    return null;
  }
}

export function writeSave(save: SaveData): void {
  try {
    window.localStorage.setItem(saveKey, JSON.stringify(save));
  } catch {
    // Private windows can refuse storage; the run just won't persist.
  }
}

export function clearSave(): void {
  try {
    window.localStorage.removeItem(saveKey);
  } catch {
    // ignore
  }
}
