/**
 * Player settings: music and effect volumes, and key bindings. Kept in
 * localStorage apart from the campaign save, so resetting a run keeps them.
 * Bindings are KeyboardEvent.code values ("KeyW"), so they follow the physical
 * key whatever the keyboard layout.
 */

export const bindingActions = ["up", "down", "left", "right", "prevWeapon", "nextWeapon", "mute"] as const;
export type BindingAction = (typeof bindingActions)[number];

export interface DustlineSettings {
  /** 0..1 */
  musicVolume: number;
  /** 0..1 */
  effectsVolume: number;
  bindings: Record<BindingAction, string>;
}

export const bindingLabels: Record<BindingAction, string> = {
  up: "Drive up",
  down: "Drive down",
  left: "Drive left",
  right: "Drive right",
  prevWeapon: "Previous cannon",
  nextWeapon: "Next cannon",
  mute: "Mute sound",
};

export const defaultSettings: DustlineSettings = {
  musicVolume: 0.5,
  effectsVolume: 0.8,
  bindings: {
    up: "KeyW",
    down: "KeyS",
    left: "KeyA",
    right: "KeyD",
    prevWeapon: "KeyQ",
    nextWeapon: "KeyE",
    mute: "KeyM",
  },
};

/** Keys that always do the same thing and can't be bound: Esc opens settings, 1-6 pick cannons. */
const reservedCodes = new Set(["Escape", "Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6"]);

const storageKey = "dustline.settings";
let current: DustlineSettings = readSettings();

export function getSettings(): DustlineSettings {
  return current;
}

export function updateSettings(change: Partial<Omit<DustlineSettings, "bindings">>): DustlineSettings {
  current = { ...current, ...change };
  writeSettings();
  return current;
}

/**
 * Binds a key to an action. If another action had that key, the two swap, so
 * no key ever does two things. Returns false for reserved keys.
 */
export function bindKey(action: BindingAction, code: string): boolean {
  if (reservedCodes.has(code)) {
    return false;
  }

  const bindings = { ...current.bindings };
  const clash = bindingActions.find((other) => other !== action && bindings[other] === code);
  if (clash) {
    bindings[clash] = bindings[action];
  }
  bindings[action] = code;
  current = { ...current, bindings };
  writeSettings();
  return true;
}

export function resetBindings(): DustlineSettings {
  current = { ...current, bindings: { ...defaultSettings.bindings } };
  writeSettings();
  return current;
}

/** "KeyW" -> "W", "ArrowUp" -> "Up", "ShiftLeft" -> "L Shift". */
export function keyLabel(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Arrow")) return code.slice(5);
  if (code.startsWith("Numpad")) return `Num ${code.slice(6)}`;
  const sided = /^(Shift|Control|Alt|Meta)(Left|Right)$/.exec(code);
  if (sided) return `${sided[2] === "Left" ? "L" : "R"} ${sided[1] === "Control" ? "Ctrl" : sided[1]}`;
  return code;
}

function readSettings(): DustlineSettings {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return structuredClone(defaultSettings);
    }
    const parsed = JSON.parse(raw) as Partial<DustlineSettings>;
    const bindings = { ...defaultSettings.bindings };
    bindingActions.forEach((action) => {
      const code = parsed.bindings?.[action];
      if (typeof code === "string" && code && !reservedCodes.has(code)) {
        bindings[action] = code;
      }
    });
    return {
      musicVolume: clampVolume(parsed.musicVolume, defaultSettings.musicVolume),
      effectsVolume: clampVolume(parsed.effectsVolume, defaultSettings.effectsVolume),
      bindings,
    };
  } catch {
    return structuredClone(defaultSettings);
  }
}

function writeSettings(): void {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(current));
  } catch {
    // Storage blocked: settings still apply for this session.
  }
}

function clampVolume(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
}
