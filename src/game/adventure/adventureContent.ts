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
  recipe: { timber: 3, ironstone: 2 },
  player: {
    radius: 18,
    speed: 220,
    maxHealth: 100,
    attackRange: 70,
    attackCooldown: 0.4,
    baseDamage: 10,
    lanternDamage: 30,
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
