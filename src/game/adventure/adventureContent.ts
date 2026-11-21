// Lanternwake: an original compact survival-adventure. All tuning and layout lives here.

export type ResourceKind = "timber" | "ironstone";

export interface Point {
  x: number;
  y: number;
}

export interface ResourceNodeData extends Point {
  id: string;
  kind: ResourceKind;
}

export interface FoeData extends Point {
  id: string;
}

/** Axis-aligned solid area the lantern-keeper cannot walk through (shades drift through). */
export interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type PropKind =
  | "cottageRed"
  | "cottageBlue"
  | "well"
  | "fence"
  | "crate"
  | "barrel"
  | "bush"
  | "berryBush"
  | "mushroom"
  | "stump";

/** A village prop; x/y is the bottom-centre (its feet), which is also its depth. */
export interface PropData extends Point {
  kind: PropKind;
}

/** A cobblestone path strip, top-left anchored. */
export interface CobbleData {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Village layout west of the gate. Solid props get a matching entry in `obstacles`. */
const props: PropData[] = [
  // Two cottages north of the road, each with a cobble path down to it.
  { kind: "cottageRed", x: 170, y: 250 },
  { kind: "cottageBlue", x: 540, y: 330 },
  { kind: "well", x: 300, y: 236 },
  // Front fence of the red cottage's yard, with a gap for its path.
  { kind: "fence", x: 20, y: 296 },
  { kind: "fence", x: 68, y: 296 },
  { kind: "fence", x: 116, y: 296 },
  { kind: "fence", x: 224, y: 296 },
  { kind: "fence", x: 272, y: 296 },
  { kind: "fence", x: 320, y: 296 },
  { kind: "crate", x: 70, y: 268 },
  { kind: "crate", x: 92, y: 276 },
  { kind: "barrel", x: 252, y: 266 },
  { kind: "barrel", x: 624, y: 342 },
  { kind: "crate", x: 465, y: 346 },
  // Greenery.
  { kind: "bush", x: 40, y: 176 },
  { kind: "bush", x: 296, y: 140 },
  { kind: "bush", x: 60, y: 410 },
  { kind: "bush", x: 420, y: 440 },
  { kind: "bush", x: 90, y: 880 },
  { kind: "bush", x: 470, y: 950 },
  { kind: "bush", x: 780, y: 970 },
  { kind: "bush", x: 820, y: 140 },
  { kind: "bush", x: 990, y: 860 },
  { kind: "bush", x: 690, y: 590 },
  { kind: "bush", x: 1070, y: 180 },
  { kind: "bush", x: 250, y: 640 },
  { kind: "bush", x: 700, y: 360 },
  { kind: "berryBush", x: 450, y: 120 },
  { kind: "berryBush", x: 200, y: 900 },
  { kind: "berryBush", x: 880, y: 610 },
  { kind: "berryBush", x: 1060, y: 960 },
  { kind: "mushroom", x: 350, y: 330 },
  { kind: "mushroom", x: 60, y: 630 },
  { kind: "mushroom", x: 150, y: 960 },
  { kind: "mushroom", x: 680, y: 270 },
  { kind: "mushroom", x: 1000, y: 380 },
  { kind: "mushroom", x: 940, y: 980 },
  { kind: "mushroom", x: 420, y: 580 },
  { kind: "stump", x: 100, y: 570 },
  { kind: "stump", x: 650, y: 990 },
  { kind: "stump", x: 1080, y: 700 },
  { kind: "stump", x: 780, y: 290 },
];

const obstacles: Obstacle[] = [
  // Cottage walls (the roof overhangs; you can walk behind it).
  { x: 110, y: 212, w: 120, h: 38 },
  { x: 480, y: 292, w: 120, h: 38 },
  { x: 284, y: 220, w: 32, h: 16 },
  // Yard fence: two runs either side of the path.
  { x: 0, y: 284, w: 140, h: 12 },
  { x: 200, y: 284, w: 144, h: 12 },
  { x: 56, y: 256, w: 50, h: 20 },
  { x: 240, y: 252, w: 24, h: 14 },
  { x: 612, y: 328, w: 24, h: 14 },
  { x: 450, y: 332, w: 30, h: 14 },
];

export const adventureContent = {
  title: "Lanternwake",
  tagline: "Gather, forge the Ember Lantern, and still the Mirewarden before dawn.",
  story:
    "The fog-mire has swallowed Cinderhollow. As its last lantern-keeper, gather timber and ironstone, forge the Ember Lantern at the old workbench, drive back the shades, and still the Mirewarden at the drowned shrine.",
  world: { width: 1600, height: 1000 },
  gateX: 1150,
  playerSpawn: { x: 200, y: 500 },
  workbench: { x: 240, y: 360 },
  resourceNodes: [
    { id: "tree-1", kind: "timber", x: 380, y: 220 },
    { id: "tree-2", kind: "timber", x: 330, y: 780 },
    { id: "tree-3", kind: "timber", x: 560, y: 160 },
    { id: "tree-4", kind: "timber", x: 600, y: 860 },
    { id: "rock-1", kind: "ironstone", x: 640, y: 420 },
    { id: "rock-2", kind: "ironstone", x: 520, y: 620 },
    { id: "rock-3", kind: "ironstone", x: 720, y: 720 },
  ] as ResourceNodeData[],
  shades: [
    { id: "shade-1", x: 860, y: 300 },
    { id: "shade-2", x: 900, y: 720 },
    { id: "shade-3", x: 1020, y: 500 },
  ] as FoeData[],
  boss: { id: "mirewarden", x: 1400, y: 500 } as FoeData,
  props,
  obstacles,
  cobblePaths: [
    { x: 152, y: 250, w: 36, h: 226 },
    { x: 522, y: 330, w: 36, h: 146 },
  ] as CobbleData[],
  recipe: { timber: 3, ironstone: 2 },
  player: {
    radius: 18,
    speed: 220,
    maxHealth: 100,
    attackRange: 70,
    attackCooldown: 0.4,
    lanternDamage: 30,
    // The unlit staff cannot harm anything; it only shoves shades back.
    staffKnockback: 90,
    staggerSeconds: 0.6,
    interactRange: 60,
    hurtCooldown: 0.8,
  },
  shade: { radius: 16, maxHealth: 30, speed: 95, aggroRange: 280, contactDamage: 8 },
  bossStats: {
    radius: 40,
    maxHealth: 200,
    speed: 70,
    contactDamage: 10,
    pulseInterval: 4,
    pulseWindup: 1,
    pulseRadius: 150,
    pulseDamage: 12,
  },
  // Chapter labels that frame the short loop as a full night-long campaign.
  chapters: ["Dusk: Gather", "Nightfall: Forge", "Midnight: Clear the Path", "Before Dawn: The Shrine"],
} as const;
