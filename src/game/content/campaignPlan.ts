export interface FeatureCard {
  title: string;
  body: string;
}

export interface RoadmapEntry {
  prompt: number;
  title: string;
  body: string;
  status: "live" | "next" | "later";
}

export const foundationFeatureCards: FeatureCard[] = [
  {
    title: "WASD Drive",
    body: "Push through the training yard with tight tank movement and smooth camera follow.",
  },
  {
    title: "Break Open Cover",
    body: "Blast crates and weak walls to create fresh firing lanes or carve a flank route.",
  },
  {
    title: "Hidden Cache",
    body: "Punch through the side path, collect the extra credits, and survive the crossfire.",
  },
];

export const roadmap: RoadmapEntry[] = [
  {
    prompt: 0,
    title: "Foundation Build",
    body: "Project scaffold, scene shell, save boundary, roadmap docs, and original presentation.",
    status: "later",
  },
  {
    prompt: 1,
    title: "MVP Combat",
    body: "Player movement, aiming, shooting, enemy kill, pickups, HUD, and win or lose flow.",
    status: "live",
  },
  {
    prompt: 2,
    title: "Fog of War",
    body: "Permanent exploration memory with brighter live visibility and black unexplored space.",
    status: "next",
  },
  {
    prompt: 3,
    title: "Destruction Pass",
    body: "Breakable crates and walls, better impact feedback, recoil, debris, and side-path rewards.",
    status: "later",
  },
  {
    prompt: 4,
    title: "AI and Results Loop",
    body: "Enemy archetypes, state-driven combat behavior, results screen, and level complete flow.",
    status: "later",
  },
  {
    prompt: 5,
    title: "Store and Persistence",
    body: "Upgrade economy, nonlinear costs, localStorage progression, continue support, and level select hooks.",
    status: "later",
  },
  {
    prompt: 6,
    title: "Weapon System",
    body: "Modular data-driven weapons, unlocks, swapping, balance hooks, and clearer HUD support.",
    status: "later",
  },
  {
    prompt: 7,
    title: "Campaign Expansion",
    body: "Handcrafted level pack, difficulty settings, mission previews, and full game flow.",
    status: "later",
  },
  {
    prompt: 8,
    title: "Visual Polish",
    body: "Shippable interface pass, menus, transitions, pause flow, stat tracking, and performance cleanup.",
    status: "later",
  },
];
