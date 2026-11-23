// Chapter One: Wickmoor village (hub), the Gloamwood, and the Sunken Shrine.
// Names and lines here are a first pass; the story bible (design/storyBible.md) will
// refine them.
import { hash2 } from "../../engine/rng";
import type { AreaDef, DialogueDef, PropPlacement, TileKind } from "./areaTypes";
import { boxDistance, circleDistance, corridorDistance, valleyHeight } from "./terrainShapes";

export function chapterObjective(flags: ReadonlySet<string>): string {
  if (!flags.has("elderBlessing")) return "Speak with Elder Maren by the village well.";
  if (!flags.has("plateSolved")) return "Take the east road into the Gloamwood and find a way past the barred gate.";
  if (!flags.has("braziersLit")) return "Light all three braziers with a lantern flare before they gutter out.";
  if (!flags.has("bossDefeated")) return "Enter the Sunken Shrine and relight its great lantern.";
  return "The shrine burns bright again. Chapter One complete.";
}

function isNear(x: number, z: number, points: Array<[number, number]>, radius: number): boolean {
  return points.some(([px, pz]) => Math.hypot(x - px, z - pz) < radius);
}

// ---------------------------------------------------------------- Wickmoor

const villageRoad: Array<[number, number]> = [
  [-46, 0],
  [50, 0],
];
const villageBuildings: Array<[number, number]> = [
  [-14, -11],
  [13, -12],
  [-12, 12],
  [15, 13],
  [0, -21],
  [0, 0],
  [-24, -16],
];

function villageWalk(x: number, z: number): number {
  return Math.min(circleDistance(x, z, -2, 0, 37), corridorDistance(x, z, [[26, 0], [50, 0]], 3.2));
}

function villageHeight(x: number, z: number): number {
  let height = valleyHeight(x, z, villageWalk(x, z), { bumps: 0.4, rise: 8, ramp: 6, seed: 3 });
  const pondDistance = Math.hypot(x + 24, z + 16);
  if (pondDistance < 6) height -= (1 - pondDistance / 6) * 0.7;
  // Flatten building pads.
  for (const [bx, bz] of villageBuildings.slice(0, 5)) if (boxDistance(x, z, bx, bz, 4.2, 3.6) < 0) height *= 0.2;
  return height;
}

function villagePaint(x: number, z: number, _height: number, slope: number): TileKind {
  if (slope > 0.85) return "cliff";
  if (Math.hypot(x, z) < 8.5 || corridorDistance(x, z, villageRoad, 2.3) < 0) return "cobble";
  const doorPaths: Array<Array<[number, number]>> = [
    [
      [-15.2, -8],
      [-15.2, -1],
    ],
    [
      [11.8, -9],
      [11.8, -1],
    ],
    [
      [-10.8, 9],
      [-10.8, 1],
    ],
    [
      [16.2, 10],
      [16.2, 1],
    ],
    [
      [-1.2, -18],
      [-1.2, -8],
    ],
  ];
  if (doorPaths.some((path) => corridorDistance(x, z, path, 1.1) < 0)) return "dirt";
  if (Math.hypot(x - 12, z - 8) < 3.5) return "dirt";
  return "grass";
}

const maren: (flags: ReadonlySet<string>) => DialogueDef = (flags) => {
  if (flags.has("bossDefeated")) {
    return {
      speaker: "Elder Maren",
      lines: [
        "Look east, Keeper. The shrine burns again. I can see it from the well.",
        "The Shades will remember that light for a long while. Rest now. You've earned it.",
      ],
    };
  }
  if (flags.has("elderBlessing")) {
    return {
      speaker: "Elder Maren",
      lines: ["The east road runs into the Gloamwood. The old shrine gates answer to flame, not to force."],
    };
  }
  return {
    speaker: "Elder Maren",
    lines: [
      "Keeper. You're awake. Good. The great lantern in the Sunken Shrine went dark at dusk.",
      "Without its light the Shades drift closer every night. They took the mill road already.",
      "Your lantern still carries the old flame. Raise it high and their kind will cower. [Q] or [Right Mouse].",
      "I've unbarred the east gate. Go through the Gloamwood and relight the shrine. Wickmoor is counting on you.",
    ],
    setsFlag: "elderBlessing",
  };
};

const tobin: (flags: ReadonlySet<string>) => DialogueDef = (flags) => {
  if (flags.has("bossDefeated")) return { speaker: "Tobin the Smith", lines: ["Heard the bells ring out. Knew you'd manage it."] };
  if (flags.has("plateSolved")) {
    return { speaker: "Tobin the Smith", lines: ["Braziers, eh? A flare'll light any within a few paces. Run hard between them."] };
  }
  return {
    speaker: "Tobin the Smith",
    lines: [
      "Off to the wood? The old ward-plates out there want weight on them. A crate'll slide if you lean into it.",
      "And swing three times in a row. The third cut lands hardest. Same as the anvil.",
    ],
  };
};

const villageProps: PropPlacement[] = [
  { kind: "cottage", x: -14, z: -11, rot: 0, variant: "red", id: "redCottageDoor", lockedText: "Locked. Somebody inside is snoring like a bellows." },
  { kind: "cottage", x: 13, z: -12, rot: 0, variant: "blue", id: "blueCottageDoor", lockedText: "Locked tight. A note on it reads: AT THE FORGE." },
  { kind: "cottage", x: -12, z: 12, rot: Math.PI, variant: "thatch", id: "homeDoor", enterable: true },
  { kind: "cottage", x: 15, z: 13, rot: Math.PI, variant: "red", id: "eastCottageDoor", lockedText: "It's locked. You hear a cat complain about it." },
  { kind: "cottage", x: 0, z: -21, rot: 0, variant: "thatch", id: "northCottageDoor", lockedText: "Locked. The fog has swollen the wood shut." },
  { kind: "chest", x: -13.9, z: 10.9, rot: Math.PI / 2, id: "homeChest", contents: "oil", raise: 0.5 },
  { kind: "well", x: 0, z: 0 },
  { kind: "pond", x: -24, z: -16, length: 5 },
  { kind: "lampPost", x: -30, z: 3, rot: 0 },
  { kind: "lampPost", x: -18, z: -3, rot: Math.PI },
  { kind: "lampPost", x: -6, z: 7, rot: 0 },
  { kind: "lampPost", x: 7, z: -7, rot: Math.PI },
  { kind: "lampPost", x: 21, z: 3, rot: 0 },
  { kind: "lampPost", x: 33, z: -3.4, rot: Math.PI },
  { kind: "gate", x: 40, z: 0, rot: Math.PI / 2, id: "villageGate", flag: "elderBlessing", length: 6.4, lockedText: "Barred from the other side. Elder Maren keeps the key." },
  { kind: "signpost", x: 36, z: 3.6, rot: -0.3 },
  { kind: "anvil", x: 11, z: 8.5, rot: 0.4 },
  { kind: "bench", x: 5.5, z: 5, rot: 0.3 },
  { kind: "bench", x: -5.5, z: -5, rot: 0.2 },
  { kind: "fence", x: -20, z: -6, rot: 0, length: 6 },
  { kind: "fence", x: -9, z: -6, rot: 0, length: 3 },
  { kind: "fence", x: 19.5, z: 7, rot: 0, length: 5 },
  { kind: "fence", x: -17, z: 6.5, rot: 0, length: 6 },
  { kind: "crate", x: -9.5, z: -7.8 },
  { kind: "crate", x: -8.6, z: -8.9 },
  { kind: "barrel", x: 18, z: 9.5 },
  { kind: "barrel", x: 19, z: 10.2 },
  { kind: "barrel", x: 9, z: -8 },
  { kind: "pot", x: -3, z: -17.5, contents: "heart" },
  { kind: "pot", x: -3.8, z: -17.1, contents: "oil" },
  { kind: "pot", x: 3, z: -17.5 },
  { kind: "pot", x: -20.5, z: 9, contents: "heart" },
  { kind: "wayLantern", x: -4, z: 4.5, id: "wickmoorLantern" },
  { kind: "log", x: -30, z: -6, rot: 0.6 },
  { kind: "stump", x: -26, z: 9 },
];

export const wickmoor: AreaDef = {
  id: "wickmoor",
  name: "Wickmoor",
  subtitle: "the last lit village",
  mood: "village",
  size: 100,
  cell: 1.5,
  height: villageHeight,
  paint: villagePaint,
  spawns: {
    start: { x: -28, z: 2, yaw: Math.PI / 2 },
    fromForest: { x: 34, z: 0, yaw: -Math.PI / 2 },
    wickmoorLantern: { x: -4, z: 6.5, yaw: Math.PI / 2 },
  },
  props: villageProps,
  scatter: [
    {
      kind: "oak",
      count: 70,
      seed: 101,
      spacing: 4.5,
      scaleMin: 0.85,
      scaleMax: 1.35,
      where: (x, z) => {
        const walk = villageWalk(x, z);
        return walk > -7 && walk < 14 && corridorDistance(x, z, villageRoad, 5) > 0 && !isNear(x, z, villageBuildings, 8);
      },
    },
    {
      kind: "pine",
      count: 40,
      seed: 102,
      spacing: 4,
      scaleMin: 1,
      scaleMax: 1.5,
      where: (x, z) => villageWalk(x, z) > 4 && corridorDistance(x, z, villageRoad, 5) > 0,
    },
    {
      kind: "rock",
      count: 30,
      seed: 103,
      spacing: 3,
      scaleMin: 0.4,
      scaleMax: 1.1,
      where: (x, z) => villageWalk(x, z) > -5 && corridorDistance(x, z, villageRoad, 3) > 0 && !isNear(x, z, villageBuildings, 7),
    },
    { kind: "grass", count: 1400, seed: 104, where: (x, z, h, slope) => villagePaint(x, z, h, slope) === "grass" && slope < 0.6 },
    { kind: "flowers", count: 220, seed: 105, where: (x, z, h, slope) => villagePaint(x, z, h, slope) === "grass" && slope < 0.4 },
  ],
  foes: [],
  npcs: [
    { id: "maren", look: "elder", name: "Elder Maren", x: 3, z: -2.6, rot: -Math.PI / 2, dialogue: maren },
    { id: "tobin", look: "smith", name: "Tobin", x: 12.6, z: 6.8, rot: -Math.PI / 2 - 0.4, dialogue: tobin },
  ],
  exits: [{ x: 47.5, z: 0, halfWidth: 1.2, halfDepth: 4, toArea: "gloamwood", toSpawn: "west" }],
  puzzles: [],
  triggers: [
    { id: "gateHint", x: 36, z: 0, radius: 4, kind: "hint", text: "The east gate is barred. Elder Maren keeps the key.", onceFlag: "gateHintShown" },
  ],
  objective: chapterObjective,
  motes: "fireflies",
};

// ---------------------------------------------------------------- Gloamwood

const forestPath: Array<[number, number]> = [
  [-62, 0],
  [-42, 0],
  [-26, -4],
  [-12, 2],
  [4, 0],
  [16, 0],
  [24, 5],
  [33, 3],
  [44, 0],
  [62, 0],
];
const forestClearings: Array<[number, number, number]> = [
  [-26, -4, 11],
  [2, 0, 13],
  [33, 3, 14],
];

function forestWalk(x: number, z: number): number {
  let distance = corridorDistance(x, z, forestPath, 3.8);
  for (const [cx, cz, radius] of forestClearings) distance = Math.min(distance, circleDistance(x, z, cx, cz, radius));
  return distance;
}

function forestHeight(x: number, z: number): number {
  return valleyHeight(x, z, forestWalk(x, z), { bumps: 0.6, rise: 9, ramp: 4.5, seed: 7 });
}

function forestPaint(x: number, z: number, _height: number, slope: number): TileKind {
  if (slope > 0.8) return "cliff";
  if (corridorDistance(x, z, forestPath, 1.6 + hash2(Math.floor(x), Math.floor(z), 4) * 0.8) < 0) return "dirt";
  if (x > 40 && corridorDistance(x, z, forestPath, 3.2) < 0) return "flagstone";
  return "grassForest";
}

const forestProps: PropPlacement[] = [
  { kind: "signpost", x: -50, z: 4, rot: 0.2 },
  { kind: "log", x: -40, z: -5, rot: 0.3 },
  { kind: "deadTree", x: -26, z: -4, scale: 1.3 },
  { kind: "pot", x: -18.5, z: -12.4, contents: "heart" },
  { kind: "pot", x: -19.4, z: -12.9, contents: "oil" },
  { kind: "wayLantern", x: -4, z: -7, id: "gloamLanternA" },
  { kind: "crate", x: -7, z: 5 },
  { kind: "crate", x: 7, z: 8 },
  { kind: "plate", x: 2, z: -9, id: "plateA" },
  { kind: "gate", x: 14, z: 0, rot: Math.PI / 2, id: "plateGate", flag: "plateSolved", length: 8, lockedText: "It won't budge. Something heavy on that plate might lift it." },
  { kind: "stump", x: -10, z: -8 },
  { kind: "boulder", x: 9, z: -10, scale: 1 },
  { kind: "wayLantern", x: 20, z: -2.6, id: "gloamLanternB" },
  { kind: "chest", x: 26, z: -8, rot: 0.5, id: "woodChest", contents: "heartContainer" },
  { kind: "brazier", x: 26, z: -4, id: "brazierA" },
  { kind: "brazier", x: 41, z: -4, id: "brazierB" },
  { kind: "brazier", x: 34, z: 14, id: "brazierC" },
  { kind: "pot", x: 38, z: 11, contents: "heart" },
  { kind: "pot", x: 39, z: 11.8, contents: "oil" },
  { kind: "barrel", x: 29, z: 12 },
  { kind: "gate", x: 47, z: 0, rot: Math.PI / 2, id: "shrineGate", flag: "braziersLit", length: 7.6, lockedText: "Sealed with old fire-wards. The braziers might wake them." },
  { kind: "brokenPillar", x: 50, z: -4.6, variant: "shrine", scale: 1 },
  { kind: "brokenPillar", x: 50, z: 4.6, variant: "shrine", scale: 1 },
];

export const gloamwood: AreaDef = {
  id: "gloamwood",
  name: "The Gloamwood",
  subtitle: "where the Shades drift",
  mood: "forest",
  size: 128,
  cell: 1.6,
  height: forestHeight,
  paint: forestPaint,
  spawns: {
    west: { x: -56, z: 0, yaw: Math.PI / 2 },
    fromShrine: { x: 54, z: 0, yaw: -Math.PI / 2 },
    gloamLanternA: { x: -4, z: -5, yaw: Math.PI / 2 },
    gloamLanternB: { x: 20, z: -0.6, yaw: Math.PI / 2 },
  },
  props: forestProps,
  scatter: [
    {
      kind: "pine",
      count: 150,
      seed: 201,
      spacing: 3.6,
      scaleMin: 1,
      scaleMax: 1.7,
      where: (x, z) => {
        const walk = forestWalk(x, z);
        return walk > -1.2 && walk < 18;
      },
    },
    {
      kind: "oak",
      count: 50,
      seed: 202,
      spacing: 4,
      scaleMin: 0.9,
      scaleMax: 1.3,
      where: (x, z) => {
        const walk = forestWalk(x, z);
        return walk > -4 && walk < 6 && corridorDistance(x, z, forestPath, 5) > 0;
      },
    },
    { kind: "deadTree", count: 14, seed: 203, spacing: 6, where: (x, z) => forestWalk(x, z) > 0 && forestWalk(x, z) < 8 },
    {
      kind: "rock",
      count: 45,
      seed: 204,
      spacing: 3,
      scaleMin: 0.5,
      scaleMax: 1.4,
      where: (x, z) => forestWalk(x, z) > -3 && corridorDistance(x, z, forestPath, 3) > 0,
    },
    { kind: "mushrooms", count: 40, seed: 205, spacing: 2.5, where: (x, z) => forestWalk(x, z) > -5 && forestWalk(x, z) < 1 && corridorDistance(x, z, forestPath, 3) > 0 },
    { kind: "grass", count: 1300, seed: 206, where: (x, z, h, slope) => forestPaint(x, z, h, slope) === "grassForest" && slope < 0.6 },
  ],
  foes: [
    { kind: "shade", x: -12, z: 2, id: "s0" },
    { kind: "shade", x: -28, z: -1, id: "s1" },
    { kind: "shade", x: -22, z: -8, id: "s2" },
    { kind: "shade", x: -31, z: -9, id: "s3" },
    { kind: "husk", x: 6, z: 6, id: "h1" },
    { kind: "husk", x: 31, z: 9, id: "h2" },
    { kind: "husk", x: 39, z: -7, id: "h3" },
    { kind: "shade", x: 36, z: 2, id: "s4" },
    { kind: "shade", x: 28, z: -2, id: "s5" },
  ],
  npcs: [],
  exits: [
    { x: -61, z: 0, halfWidth: 1.2, halfDepth: 4, toArea: "wickmoor", toSpawn: "fromForest" },
    { x: 61, z: 0, halfWidth: 1.2, halfDepth: 4, toArea: "sunkenShrine", toSpawn: "west" },
  ],
  puzzles: [
    { id: "plateGatePuzzle", kind: "plates", members: ["plateA"], setsFlag: "plateSolved" },
    { id: "brazierPuzzle", kind: "braziers", members: ["brazierA", "brazierB", "brazierC"], setsFlag: "braziersLit", burnSeconds: 14 },
  ],
  triggers: [
    { id: "plateHint", x: 9, z: 0, radius: 4, kind: "hint", text: "A ward-plate set into the clearing... the gate looks linked to it.", onceFlag: "plateHintShown" },
    { id: "brazierHint", x: 26, z: 2, radius: 4, kind: "hint", text: "Three cold braziers. A flare might wake them, if you can reach all three in time.", onceFlag: "brazierHintShown" },
  ],
  objective: chapterObjective,
  motes: "fireflies",
};

// ---------------------------------------------------------------- Sunken Shrine

const shrineWalkway: Array<[number, number]> = [
  [-54, 0],
  [-12, 0],
];

function shrineWalk(x: number, z: number): number {
  return Math.min(corridorDistance(x, z, shrineWalkway, 3.6), circleDistance(x, z, 8, 0, 17.5), circleDistance(x, z, -26, 0, 7));
}

function shrineHeight(x: number, z: number): number {
  const walk = shrineWalk(x, z);
  const base = valleyHeight(x, z, walk, { bumps: 0.25, rise: 10, ramp: 3.5, seed: 11 });
  return Math.hypot(x - 8, z) < 16 ? base * 0.1 : base;
}

function shrinePaint(x: number, z: number, _height: number, slope: number): TileKind {
  if (slope > 0.8) return "cliff";
  if (Math.hypot(x - 8, z) < 15.5) return "shrineFloor";
  if (corridorDistance(x, z, shrineWalkway, 2.4) < 0 || Math.hypot(x + 26, z) < 4.5) return "flagstone";
  return "grassForest";
}

const shrineProps: PropPlacement[] = [];
for (let x = -46; x <= -16; x += 7) {
  shrineProps.push({ kind: x % 2 === 0 ? "pillar" : "brokenPillar", x, z: -4.6, variant: "shrine" });
  shrineProps.push({ kind: x % 2 === 0 ? "brokenPillar" : "pillar", x: x + 3, z: 4.6, variant: "shrine" });
}
for (let index = 0; index < 12; index += 1) {
  const angle = (index / 12) * Math.PI * 2;
  if (Math.abs(Math.cos(angle) + 1) < 0.1) continue; // leave the west entrance open
  shrineProps.push({ kind: index % 3 === 1 ? "brokenPillar" : "pillar", x: 8 + Math.cos(angle) * 16.4, z: Math.sin(angle) * 16.4, variant: "shrine" });
}
shrineProps.push(
  { kind: "wayLantern", x: -26, z: 4, id: "shrineLantern" },
  { kind: "gate", x: -10.5, z: 0, rot: Math.PI / 2, id: "arenaSeal", closedWhile: "bossActive", length: 7.2 },
  { kind: "greatLantern", x: 21, z: 0, id: "greatLantern", flag: "bossDefeated" },
  { kind: "brazier", x: 2, z: -11, id: "litA", variant: "lit" },
  { kind: "brazier", x: 2, z: 11, id: "litB", variant: "lit" },
  { kind: "brazier", x: 16, z: -11, id: "litC", variant: "lit" },
  { kind: "brazier", x: 16, z: 11, id: "litD", variant: "lit" },
  { kind: "pot", x: -29, z: -4, contents: "heart" },
  { kind: "pot", x: -28.2, z: -4.6, contents: "heart" },
  { kind: "pot", x: -23, z: -4.8, contents: "oil" },
  { kind: "shrineWall", x: -26, z: -8, length: 10 },
);

export const sunkenShrine: AreaDef = {
  id: "sunkenShrine",
  name: "The Sunken Shrine",
  subtitle: "seat of the great lantern",
  mood: "shrine",
  size: 112,
  cell: 1.5,
  height: shrineHeight,
  paint: shrinePaint,
  spawns: {
    west: { x: -48, z: 0, yaw: Math.PI / 2 },
    shrineLantern: { x: -24, z: 2.5, yaw: Math.PI / 2 },
  },
  props: shrineProps,
  scatter: [
    { kind: "pine", count: 70, seed: 301, spacing: 4, scaleMin: 1.1, scaleMax: 1.6, where: (x, z) => shrineWalk(x, z) > 1 && shrineWalk(x, z) < 16 },
    { kind: "deadTree", count: 18, seed: 302, spacing: 5, where: (x, z) => shrineWalk(x, z) > -1 && shrineWalk(x, z) < 6 },
    { kind: "rock", count: 30, seed: 303, spacing: 3, scaleMin: 0.5, scaleMax: 1.3, where: (x, z) => shrineWalk(x, z) > 0.5 },
    { kind: "grass", count: 700, seed: 304, where: (x, z, h, slope) => shrinePaint(x, z, h, slope) === "grassForest" && slope < 0.6 },
  ],
  foes: [{ kind: "warden", x: 12, z: 0, id: "warden" }],
  npcs: [],
  exits: [{ x: -54, z: 0, halfWidth: 1.2, halfDepth: 4, toArea: "gloamwood", toSpawn: "fromShrine" }],
  puzzles: [],
  triggers: [{ id: "arena", x: -4, z: 0, radius: 4.5, kind: "bossArena", onceFlag: "bossActive", requiresFlag: "braziersLit" }],
  objective: chapterObjective,
  motes: "spirits",
};

export const areas: Record<string, AreaDef> = { wickmoor, gloamwood, sunkenShrine };
