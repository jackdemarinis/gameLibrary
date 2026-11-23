// Shapes of the hand-authored content: areas, props, foes, NPCs, exits and dialogue.
// Pure data (plus height/paint functions) so content stays separate from rendering.
import type { PuzzleDef } from "../rules/puzzleLogic";

export type MoodName = "village" | "forest" | "shrine";

export type TileKind = "grass" | "grassForest" | "dirt" | "cobble" | "flagstone" | "shrineFloor" | "cliff";

export type PickupKind = "heart" | "oil" | "heartContainer";

export type PropKind =
  | "cottage"
  | "well"
  | "oak"
  | "pine"
  | "deadTree"
  | "rock"
  | "boulder"
  | "fence"
  | "palisade"
  | "lampPost"
  | "crate"
  | "barrel"
  | "pot"
  | "brazier"
  | "plate"
  | "gate"
  | "chest"
  | "pillar"
  | "brokenPillar"
  | "stump"
  | "log"
  | "signpost"
  | "bench"
  | "wayLantern"
  | "greatLantern"
  | "pond"
  | "mushrooms"
  | "anvil"
  | "shrineWall";

export interface PropPlacement {
  kind: PropKind;
  x: number;
  z: number;
  rot?: number;
  scale?: number;
  /** Needed for interactive props: plates, braziers, gates, chests, lanterns. */
  id?: string;
  /** Visual variant (roof colour, etc.). */
  variant?: string;
  /** Length for walls and fences, radius for ponds. */
  length?: number;
  /** Gates open when this flag is set. Chests and pots hold `contents`. */
  flag?: string;
  contents?: PickupKind;
  /** Gate: closed only while this flag is set (the boss arena seal). */
  closedWhile?: string;
}

export interface ScatterDef {
  kind: "oak" | "pine" | "deadTree" | "rock" | "grass" | "flowers" | "mushrooms" | "stump";
  count: number;
  seed: number;
  /** Minimum spacing between items of this scatter, metres. */
  spacing?: number;
  where: (x: number, z: number, height: number, slope: number) => boolean;
  scaleMin?: number;
  scaleMax?: number;
}

export type FoeKind = "shade" | "husk" | "warden";

export interface FoePlacement {
  kind: FoeKind;
  x: number;
  z: number;
  id: string;
}

export type NpcLook = "elder" | "smith";

export interface DialogueDef {
  speaker: string;
  lines: string[];
  setsFlag?: string;
}

export interface NpcPlacement {
  id: string;
  look: NpcLook;
  name: string;
  x: number;
  z: number;
  rot: number;
  dialogue: (flags: ReadonlySet<string>) => DialogueDef;
}

export interface ExitDef {
  x: number;
  z: number;
  halfWidth: number;
  halfDepth: number;
  toArea: string;
  toSpawn: string;
}

export interface TriggerDef {
  id: string;
  x: number;
  z: number;
  radius: number;
  kind: "bossArena" | "hint";
  text?: string;
  /** Fires only while this flag is missing; sets it when fired. */
  onceFlag: string;
  requiresFlag?: string;
}

export interface SpawnPoint {
  x: number;
  z: number;
  yaw: number;
}

export interface AreaDef {
  id: string;
  name: string;
  subtitle: string;
  mood: MoodName;
  /** Square side length in metres; the area spans -size/2..size/2. */
  size: number;
  cell: number;
  height: (x: number, z: number) => number;
  paint: (x: number, z: number, height: number, slope: number) => TileKind;
  spawns: Record<string, SpawnPoint>;
  props: PropPlacement[];
  scatter: ScatterDef[];
  foes: FoePlacement[];
  npcs: NpcPlacement[];
  exits: ExitDef[];
  puzzles: PuzzleDef[];
  triggers: TriggerDef[];
  objective: (flags: ReadonlySet<string>) => string;
  /** Fireflies / embers drifting in the air. */
  motes: "fireflies" | "embers" | "spirits";
}
