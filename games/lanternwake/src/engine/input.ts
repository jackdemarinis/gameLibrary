// Keyboard + mouse (pointer lock for camera look) + gamepad, read as game actions.

export type Action = "attack" | "roll" | "interact" | "flare" | "lockOn" | "pause" | "confirm";

const keyActions: Record<string, Action[]> = {
  KeyJ: ["attack"],
  Space: ["roll"],
  KeyK: ["roll"],
  KeyE: ["interact", "confirm"],
  Enter: ["interact", "confirm"],
  KeyQ: ["flare"],
  KeyF: ["flare"],
  KeyL: ["flare"],
  Tab: ["lockOn"],
  Escape: ["pause"],
  KeyP: ["pause"],
};

// Standard gamepad mapping: A=0, B=1, X=2, Y=3, LB=4, RB=5, Start=9.
const padActions: Array<[number, Action[]]> = [
  [0, ["interact", "confirm"]],
  [1, ["roll"]],
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

  constructor(element: HTMLElement) {
    this.element = element;
    window.addEventListener("keydown", (event) => {
      if (event.code === "Tab") event.preventDefault();
      if (event.code === "Space" && event.target === document.body) event.preventDefault();
      if (!event.repeat) for (const action of keyActions[event.code] ?? []) this.pressed.add(action);
      this.held.add(event.code);
    });
    window.addEventListener("keyup", (event) => this.held.delete(event.code));
    window.addEventListener("blur", () => this.held.clear());
    element.addEventListener("mousedown", (event) => {
      if (!this.captureEnabled) return;
      if (document.pointerLockElement !== element) {
        void element.requestPointerLock?.();
        return;
      }
      if (event.button === 0) this.pressed.add("attack");
      if (event.button === 2) this.pressed.add("flare");
      if (event.button === 1) this.pressed.add("lockOn");
    });
    element.addEventListener("contextmenu", (event) => event.preventDefault());
    window.addEventListener("mousemove", (event) => {
      if (document.pointerLockElement !== element) return;
      this.mouseDx += event.movementX;
      this.mouseDy += event.movementY;
    });
  }

  get pointerLocked(): boolean {
    return document.pointerLockElement === this.element;
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
    if (this.held.has("KeyW") || this.held.has("ArrowUp")) y += 1;
    if (this.held.has("KeyS") || this.held.has("ArrowDown")) y -= 1;
    if (this.held.has("KeyD")) x += 1;
    if (this.held.has("KeyA")) x -= 1;
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

  /** Camera look delta in radians-ish units for this frame. */
  look(dt: number): { x: number; y: number } {
    let x = this.mouseDx * 0.0032;
    let y = this.mouseDy * 0.0028;
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
