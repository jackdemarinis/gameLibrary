// Keyboard + mouse (pointer lock for camera look) + gamepad, read as game actions.
// Keyboard keys come from the player's bindings (Settings); menu keys stay fixed.
import { defaultBindings, type BindAction } from "../game/rules/settings";

export type Action = "attack" | "jump" | "interact" | "flare" | "lockOn" | "pause" | "confirm";

/** Fixed keys that always work regardless of bindings. */
const fixedKeyActions: Record<string, Action[]> = {
  Enter: ["interact", "confirm"],
  Escape: ["pause"],
  KeyP: ["pause"],
};

const boundActions: Partial<Record<BindAction, Action[]>> = {
  jump: ["jump"],
  attack: ["attack"],
  flare: ["flare"],
  interact: ["interact", "confirm"],
  lockOn: ["lockOn"],
};

// Standard gamepad mapping: A=0, B=1, X=2, Y=3, LB=4, RB=5, Start=9.
const padActions: Array<[number, Action[]]> = [
  [0, ["interact", "confirm"]],
  [1, ["jump"]],
  [2, ["attack"]],
  [3, ["flare"]],
  [5, ["lockOn"]],
  [4, ["lockOn"]],
  [9, ["pause"]],
];

export class Input {
  private readonly held = new Set<string>();
  private readonly pressed = new Set<Action>();
  private readonly padHeld = new Set<number>();
  private mouseDx = 0;
  private mouseDy = 0;
  private readonly element: HTMLElement;
  /** Set false while menus are open so clicks don't grab the pointer. */
  captureEnabled = false;
  private bindings: Record<BindAction, string> = { ...defaultBindings };
  private keyActions: Record<string, Action[]> = {};
  private sensitivity = 1;
  private invertY = false;

  constructor(element: HTMLElement) {
    this.element = element;
    this.setBindings(this.bindings);
    window.addEventListener("keydown", (event) => {
      if (event.code === "Tab") event.preventDefault();
      if (event.code === "Space" && event.target === document.body) event.preventDefault();
      if (!event.repeat) for (const action of this.keyActions[event.code] ?? []) this.pressed.add(action);
      this.held.add(event.code);
    });
    window.addEventListener("keyup", (event) => this.held.delete(event.code));
    window.addEventListener("blur", () => this.held.clear());
    element.addEventListener("mousedown", (event) => {
      if (!this.captureEnabled) return;
      if (document.pointerLockElement !== element) {
        this.capturePointer();
        return;
      }
      if (event.button === 0) this.pressed.add("attack");
      if (event.button === 2) this.pressed.add("flare");
      if (event.button === 1) this.pressed.add("lockOn");
    });
    element.addEventListener("contextmenu", (event) => event.preventDefault());
    // Locked pointer: unlimited look. If the browser refuses the lock (no click yet,
    // cooldown after Esc, embedded frames), moving the mouse over the game still turns
    // the camera, so looking around never silently stops working.
    window.addEventListener("mousemove", (event) => {
      const locked = document.pointerLockElement === element;
      if (!locked && !(this.captureEnabled && event.target === element)) return;
      this.mouseDx += event.movementX;
      this.mouseDy += event.movementY;
    });
  }

  setBindings(bindings: Record<BindAction, string>): void {
    this.bindings = { ...bindings };
    const map: Record<string, Action[]> = {};
    for (const [bind, actions] of Object.entries(boundActions) as Array<[BindAction, Action[]]>) {
      const code = this.bindings[bind];
      map[code] = [...(map[code] ?? []), ...actions];
    }
    for (const [code, actions] of Object.entries(fixedKeyActions)) map[code] = [...(map[code] ?? []), ...actions];
    this.keyActions = map;
  }

  setLookFeel(sensitivity: number, invertY: boolean): void {
    this.sensitivity = sensitivity;
    this.invertY = invertY;
  }

  get pointerLocked(): boolean {
    return document.pointerLockElement === this.element;
  }

  /** Ask for pointer lock; must run inside a click/key handler to be honoured. */
  capturePointer(): void {
    if (document.pointerLockElement === this.element) return;
    try {
      const result = this.element.requestPointerLock?.() as unknown;
      if (result instanceof Promise) result.catch(() => undefined);
    } catch {
      // Refused (no user gesture yet); the hover-look fallback still works.
    }
  }

  releasePointer(): void {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  /** Call once per frame before reading; polls the gamepad. */
  poll(): void {
    const pad = this.pad();
    if (!pad) return;
    for (const [button, actions] of padActions) {
      const down = pad.buttons[button]?.pressed ?? false;
      if (down && !this.padHeld.has(button)) for (const action of actions) this.pressed.add(action);
      if (down) this.padHeld.add(button);
      else this.padHeld.delete(button);
    }
  }

  private pad(): Gamepad | null {
    const pads = navigator.getGamepads?.() ?? [];
    for (const pad of pads) if (pad && pad.connected) return pad;
    return null;
  }

  /** Was this action pressed since the last `endFrame`? */
  wasPressed(action: Action): boolean {
    return this.pressed.has(action);
  }

  /** Movement on screen axes: x right, y forward, length <= 1. */
  move(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    const bound = this.bindings;
    if (this.held.has(bound.moveForward) || this.held.has("ArrowUp")) y += 1;
    if (this.held.has(bound.moveBack) || this.held.has("ArrowDown")) y -= 1;
    if (this.held.has(bound.moveRight)) x += 1;
    if (this.held.has(bound.moveLeft)) x -= 1;
    const pad = this.pad();
    if (pad) {
      const px = pad.axes[0] ?? 0;
      const py = pad.axes[1] ?? 0;
      if (Math.hypot(px, py) > 0.18) {
        x += px;
        y -= py;
      }
    }
    const length = Math.hypot(x, y);
    return length > 1 ? { x: x / length, y: y / length } : { x, y };
  }

  /** Sprint is held: the bound key (Shift by default), or the left stick click on a gamepad. */
  sprintHeld(): boolean {
    if (this.held.has(this.bindings.sprint)) return true;
    return Boolean(this.pad()?.buttons[10]?.pressed);
  }

  /** Camera look delta in radians-ish units for this frame. */
  look(dt: number): { x: number; y: number } {
    let x = this.mouseDx * 0.0032 * this.sensitivity;
    let y = this.mouseDy * 0.0028 * this.sensitivity * (this.invertY ? -1 : 1);
    if (this.held.has("ArrowLeft")) x -= 2.2 * dt;
    if (this.held.has("ArrowRight")) x += 2.2 * dt;
    const pad = this.pad();
    if (pad) {
      const rx = pad.axes[2] ?? 0;
      const ry = pad.axes[3] ?? 0;
      if (Math.abs(rx) > 0.15) x += rx * 2.6 * dt;
      if (Math.abs(ry) > 0.15) y += ry * 1.8 * dt;
    }
    return { x, y };
  }

  /** True when the player is actively turning the camera (pauses auto-follow). */
  lookActive(): boolean {
    return Math.abs(this.mouseDx) + Math.abs(this.mouseDy) > 0.5 || this.held.has("ArrowLeft") || this.held.has("ArrowRight");
  }

  endFrame(): void {
    this.pressed.clear();
    this.mouseDx = 0;
    this.mouseDy = 0;
  }
}
