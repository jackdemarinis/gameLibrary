export const inputActions = [
  "move-up",
  "move-down",
  "move-left",
  "move-right",
  "aim",
  "fire",
  "pause",
  "confirm",
  "cancel",
  "cycle-weapon-next",
  "cycle-weapon-prev",
] as const;

export type InputAction = (typeof inputActions)[number];
