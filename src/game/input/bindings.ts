import type { InputAction } from "./actions";

export const keyboardBindings: Record<InputAction, string[]> = {
  "move-up": ["W", "UP"],
  "move-down": ["S", "DOWN"],
  "move-left": ["A", "LEFT"],
  "move-right": ["D", "RIGHT"],
  aim: ["POINTER_MOVE"],
  fire: ["POINTER_LEFT"],
  pause: ["ESC", "P"],
  confirm: ["ENTER", "SPACE"],
  cancel: ["BACKSPACE"],
  "cycle-weapon-next": ["E", "MOUSE_WHEEL_DOWN"],
  "cycle-weapon-prev": ["Q", "MOUSE_WHEEL_UP"],
};
