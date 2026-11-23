// Player settings: key bindings, audio volumes and mouse feel. Pure data + helpers
// (no DOM besides the storage wrappers at the bottom), so the rules are unit-tested.

export type BindAction = "moveForward" | "moveBack" | "moveLeft" | "moveRight" | "sprint" | "jump" | "attack" | "flare" | "interact" | "lockOn";

export const bindOrder: BindAction[] = ["moveForward", "moveBack", "moveLeft", "moveRight", "sprint", "jump", "attack", "flare", "interact", "lockOn"];

export const bindLabels: Record<BindAction, string> = {
  moveForward: "Move forward",
  moveBack: "Move back",
  moveLeft: "Move left",
  moveRight: "Move right",
  sprint: "Sprint (hold)",
  jump: "Jump",
  attack: "Sword",
  flare: "Lantern flare",
  interact: "Talk / open / use",
  lockOn: "Lock on",
};

export const defaultBindings: Record<BindAction, string> = {
  moveForward: "KeyW",
  moveBack: "KeyS",
  moveLeft: "KeyA",
  moveRight: "KeyD",
  sprint: "ShiftLeft",
  jump: "Space",
  attack: "KeyJ",
  flare: "KeyQ",
  interact: "KeyF",
  lockOn: "Tab",
};

/** Keys that stay reserved for the menus and can't be bound. */
export const reservedKeys = new Set(["Escape", "KeyP", "Enter"]);

export interface Settings {
  bindings: Record<BindAction, string>;
  /** 0..1 */
  sfxVolume: number;
  musicVolume: number;
  /** Multiplier on mouse look speed, 0.3..2.5. */
  mouseSensitivity: number;
  invertY: boolean;
}

export function defaultSettings(): Settings {
  return { bindings: { ...defaultBindings }, sfxVolume: 0.8, musicVolume: 0.55, mouseSensitivity: 1, invertY: false };
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

export function parseSettings(raw: string | null): Settings {
  const settings = defaultSettings();
  if (!raw) return settings;
  try {
    const value = JSON.parse(raw) as Partial<Settings>;
    const bindings = (value.bindings ?? {}) as Partial<Record<BindAction, unknown>>;
    for (const action of bindOrder) {
      const code = bindings[action];
      if (typeof code === "string" && code && !reservedKeys.has(code)) settings.bindings[action] = code;
    }
    // A hand-edited or corrupted save could bind one key twice; fall back to defaults then.
    if (new Set(Object.values(settings.bindings)).size !== bindOrder.length) settings.bindings = { ...defaultBindings };
    settings.sfxVolume = clamp(value.sfxVolume, 0, 1, settings.sfxVolume);
    settings.musicVolume = clamp(value.musicVolume, 0, 1, settings.musicVolume);
    settings.mouseSensitivity = clamp(value.mouseSensitivity, 0.3, 2.5, settings.mouseSensitivity);
    settings.invertY = value.invertY === true;
  } catch {
    // Unreadable: keep defaults.
  }
  return settings;
}

/** Bind `code` to `action`. If another action already used that key, it takes the
 * action's old key instead (a swap), so no key is ever bound twice. */
export function rebind(bindings: Record<BindAction, string>, action: BindAction, code: string): Record<BindAction, string> {
  if (reservedKeys.has(code)) return bindings;
  const next = { ...bindings };
  const previous = next[action];
  for (const other of bindOrder) if (other !== action && next[other] === code) next[other] = previous;
  next[action] = code;
  return next;
}

/** Short on-screen name for a KeyboardEvent.code. */
export function keyName(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  const names: Record<string, string> = {
    Space: "Space",
    ShiftLeft: "L-Shift",
    ShiftRight: "R-Shift",
    ControlLeft: "L-Ctrl",
    ControlRight: "R-Ctrl",
    AltLeft: "L-Alt",
    AltRight: "R-Alt",
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
    Tab: "Tab",
    CapsLock: "Caps",
    Backquote: "`",
    Minus: "-",
    Equal: "=",
    BracketLeft: "[",
    BracketRight: "]",
    Semicolon: ";",
    Quote: "'",
    Comma: ",",
    Period: ".",
    Slash: "/",
    Backslash: "\\",
  };
  return names[code] ?? code.replace(/^Numpad/, "Num ");
}

export const settingsKey = "lanternwake3d.settings.v1";

export function loadSettings(): Settings {
  try {
    return parseSettings(window.localStorage.getItem(settingsKey));
  } catch {
    return defaultSettings();
  }
}

export function writeSettings(settings: Settings): void {
  try {
    window.localStorage.setItem(settingsKey, JSON.stringify(settings));
  } catch {
    // Private windows can refuse storage; settings then last for this visit.
  }
}
