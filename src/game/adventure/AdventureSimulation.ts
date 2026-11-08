import { adventureContent, type Point, type ResourceKind } from "./adventureContent";

export type AdventureStatus = "active" | "won" | "lost";
export type FoeKind = "shade" | "boss";

export interface AdventureInput {
  moveX: number;
  moveY: number;
  /** One-shot press: swing the lantern staff. */
  attack: boolean;
  /** One-shot press: gather a nearby node or craft at the workbench. */
  interact: boolean;
}

export interface FoeState extends Point {
  id: string;
  kind: FoeKind;
  radius: number;
  health: number;
  maxHealth: number;
  alive: boolean;
}

export interface AdventureState {
  status: AdventureStatus;
  elapsed: number;
  player: Point & { health: number; maxHealth: number; radius: number };
  inventory: Record<ResourceKind, number>;
  hasLantern: boolean;
  depletedNodeIds: string[];
  foes: FoeState[];
  attackTimer: number;
  hurtTimer: number;
  pulseTimer: number;
  message: string;
}

export type AdventureEvent =
  | { type: "gathered"; kind: ResourceKind; nodeId: string }
  | { type: "crafted" }
  | { type: "swing"; x: number; y: number; range: number }
  | { type: "foeHit"; foeId: string; damage: number }
  | { type: "foeDefeated"; foeId: string }
  | { type: "playerHurt"; damage: number }
  | { type: "pulse"; x: number; y: number; radius: number }
  | { type: "gateOpened" };

export interface Objective {
  step: number;
  chapter: string;
  text: string;
}

export const fixedStep = 1 / 60;
const maxFrameSeconds = 0.25;
const workbenchReachBonus = 30;

export function createAdventureState(): AdventureState {
  const { player, shade, bossStats, shades, boss, playerSpawn } = adventureContent;

  return {
    status: "active",
    elapsed: 0,
    player: { ...playerSpawn, health: player.maxHealth, maxHealth: player.maxHealth, radius: player.radius },
    inventory: { timber: 0, ironstone: 0 },
    hasLantern: false,
    depletedNodeIds: [],
    foes: [
      ...shades.map((foe) => ({
        id: foe.id,
        kind: "shade" as const,
        x: foe.x,
        y: foe.y,
        radius: shade.radius,
        health: shade.maxHealth,
        maxHealth: shade.maxHealth,
        alive: true,
      })),
      {
        id: boss.id,
        kind: "boss" as const,
        x: boss.x,
        y: boss.y,
        radius: bossStats.radius,
        health: bossStats.maxHealth,
        maxHealth: bossStats.maxHealth,
        alive: true,
      },
    ],
    attackTimer: 0,
    hurtTimer: 0,
    pulseTimer: bossStats.pulseInterval,
    message: "Gather timber and ironstone near the village.",
  };
}

export function hasRecipeMaterials(state: AdventureState): boolean {
  const { recipe } = adventureContent;
  return state.inventory.timber >= recipe.timber && state.inventory.ironstone >= recipe.ironstone;
}

export function isGateOpen(state: AdventureState): boolean {
  return state.foes.every((foe) => foe.kind !== "shade" || !foe.alive);
}

export function isBossCharging(state: AdventureState): boolean {
  const boss = getBoss(state);
  return isGateOpen(state) && boss.alive && state.pulseTimer <= adventureContent.bossStats.pulseWindup;
}

export function getObjective(state: AdventureState): Objective {
  const { chapters, recipe } = adventureContent;
  const boss = getBoss(state);

  if (!boss.alive) {
    return { step: 4, chapter: "Dawn", text: "The mire recedes. Cinderhollow is safe." };
  }
  if (!state.hasLantern && !hasRecipeMaterials(state)) {
    return {
      step: 0,
      chapter: chapters[0],
      text: `Gather ${recipe.timber} timber and ${recipe.ironstone} ironstone (E near trees and rocks).`,
    };
  }
  if (!state.hasLantern) {
    return { step: 1, chapter: chapters[1], text: "Forge the Ember Lantern at the workbench (E)." };
  }
  if (!isGateOpen(state)) {
    const remaining = state.foes.filter((foe) => foe.kind === "shade" && foe.alive).length;
    return { step: 2, chapter: chapters[2], text: `Drive back the shades: ${remaining} remain.` };
  }
  return { step: 3, chapter: chapters[3], text: "The shrine gate is open. Defeat the Mirewarden." };
}

/** Context hint for whatever the player could interact with right now. */
export function getInteractPrompt(state: AdventureState): string | null {
  if (state.status !== "active") {
    return null;
  }
  if (isNearWorkbench(state) && !state.hasLantern) {
    return hasRecipeMaterials(state) ? "E: Forge Ember Lantern" : "Workbench: needs more materials";
  }
  const node = findNearestNode(state);
  return node ? `E: Gather ${node.kind}` : null;
}

/**
 * Pure step function: returns a new state plus the events it produced.
 * Deterministic for a given input sequence; no randomness or wall-clock time.
 */
export function stepAdventure(
  previous: AdventureState,
  input: AdventureInput,
  dt: number = fixedStep,
): { state: AdventureState; events: AdventureEvent[] } {
  const state = cloneState(previous);
  const events: AdventureEvent[] = [];

  if (state.status !== "active") {
    return { state, events };
  }

  const gateWasOpen = isGateOpen(state);
  state.elapsed += dt;
  state.attackTimer = Math.max(0, state.attackTimer - dt);
  state.hurtTimer = Math.max(0, state.hurtTimer - dt);

  movePlayer(state, input, dt, gateWasOpen);

  if (input.interact) {
    interact(state, events);
  }
  if (input.attack && state.attackTimer <= 0) {
    attack(state, events);
  }

  moveFoes(state, dt, gateWasOpen, events);
  updateBossPulse(state, dt, gateWasOpen, events);

  if (!gateWasOpen && isGateOpen(state)) {
    state.message = "The shrine gate grinds open to the east.";
    events.push({ type: "gateOpened" });
  }

  if (!getBoss(state).alive) {
    state.status = "won";
    state.message = "The Mirewarden is stilled. Dawn breaks over Cinderhollow.";
  } else if (state.player.health <= 0) {
    state.player.health = 0;
    state.status = "lost";
    state.message = "The fog takes the lantern-keeper.";
  }

  return { state, events };
}

/** Thin stateful wrapper for scenes: accumulates frame time into fixed steps. */
export class AdventureSimulation {
  private state: AdventureState = createAdventureState();
  private accumulator = 0;

  getState(): AdventureState {
    return this.state;
  }

  advance(deltaMs: number, input: AdventureInput): AdventureEvent[] {
    this.accumulator += Math.min(maxFrameSeconds, Math.max(0, deltaMs / 1000));
    const events: AdventureEvent[] = [];
    let pendingInput = input;

    while (this.accumulator >= fixedStep) {
      this.accumulator -= fixedStep;
      const result = stepAdventure(this.state, pendingInput);
      this.state = result.state;
      events.push(...result.events);
      // One-shot actions apply only to the first fixed step of a frame.
      pendingInput = { ...input, attack: false, interact: false };
    }

    return events;
  }
}

function movePlayer(state: AdventureState, input: AdventureInput, dt: number, gateOpen: boolean): void {
  const { world, gateX, player } = adventureContent;
  const length = Math.hypot(input.moveX, input.moveY);

  if (length === 0) {
    return;
  }

  const r = state.player.radius;
  const maxX = gateOpen ? world.width - r : gateX - r;
  state.player.x = clamp(state.player.x + (input.moveX / length) * player.speed * dt, r, maxX);
  state.player.y = clamp(state.player.y + (input.moveY / length) * player.speed * dt, r, world.height - r);
}

function interact(state: AdventureState, events: AdventureEvent[]): void {
  const { recipe } = adventureContent;

  if (isNearWorkbench(state) && !state.hasLantern) {
    if (!hasRecipeMaterials(state)) {
      state.message = `The workbench needs ${recipe.timber} timber and ${recipe.ironstone} ironstone.`;
      return;
    }
    state.inventory.timber -= recipe.timber;
    state.inventory.ironstone -= recipe.ironstone;
    state.hasLantern = true;
    state.player.health = state.player.maxHealth;
    state.message = "The Ember Lantern blazes. Your strikes burn brighter.";
    events.push({ type: "crafted" });
    return;
  }

  const node = findNearestNode(state);

  if (node) {
    state.depletedNodeIds.push(node.id);
    state.inventory[node.kind] += 1;
    state.message = `Gathered 1 ${node.kind}.`;
    events.push({ type: "gathered", kind: node.kind, nodeId: node.id });
  }
}

function attack(state: AdventureState, events: AdventureEvent[]): void {
  const { player } = adventureContent;
  state.attackTimer = player.attackCooldown;
  events.push({ type: "swing", x: state.player.x, y: state.player.y, range: player.attackRange });

  for (const foe of state.foes) {
    if (!foe.alive || distance(foe, state.player) - foe.radius > player.attackRange) {
      continue;
    }
    if (foe.kind === "boss" && !state.hasLantern) {
      state.message = "Your strike passes through the Mirewarden. Only ember light can wound it.";
      continue;
    }
    const damage = state.hasLantern ? player.lanternDamage : player.baseDamage;
    foe.health = Math.max(0, foe.health - damage);
    events.push({ type: "foeHit", foeId: foe.id, damage });

    if (foe.health === 0) {
      foe.alive = false;
      events.push({ type: "foeDefeated", foeId: foe.id });
    }
  }
}

function moveFoes(state: AdventureState, dt: number, gateOpen: boolean, events: AdventureEvent[]): void {
  const { shade, bossStats, gateX, world } = adventureContent;

  for (const foe of state.foes) {
    if (!foe.alive) {
      continue;
    }
    const isBoss = foe.kind === "boss";
    if (isBoss && !gateOpen) {
      continue;
    }
    const dist = distance(foe, state.player);
    if (!isBoss && dist > shade.aggroRange) {
      continue;
    }

    const contactDist = foe.radius + state.player.radius;
    if (dist > contactDist) {
      const speed = isBoss ? bossStats.speed : shade.speed;
      const travel = Math.min(speed * dt, dist - contactDist);
      foe.x += ((state.player.x - foe.x) / dist) * travel;
      foe.y += ((state.player.y - foe.y) / dist) * travel;
      // Shades stay in the wilds; the Mirewarden stays in its shrine.
      foe.x = isBoss ? clamp(foe.x, gateX + foe.radius, world.width - foe.radius) : clamp(foe.x, foe.radius, gateX - foe.radius);
      foe.y = clamp(foe.y, foe.radius, world.height - foe.radius);
    }

    if (distance(foe, state.player) <= contactDist + 0.5 && state.hurtTimer <= 0) {
      const damage = isBoss ? bossStats.contactDamage : shade.contactDamage;
      hurtPlayer(state, damage, events);
    }
  }
}

function updateBossPulse(state: AdventureState, dt: number, gateOpen: boolean, events: AdventureEvent[]): void {
  const { bossStats } = adventureContent;
  const boss = getBoss(state);

  if (!gateOpen || !boss.alive) {
    return;
  }

  state.pulseTimer -= dt;
  if (state.pulseTimer > 0) {
    return;
  }

  state.pulseTimer += bossStats.pulseInterval;
  events.push({ type: "pulse", x: boss.x, y: boss.y, radius: bossStats.pulseRadius });

  if (distance(boss, state.player) <= bossStats.pulseRadius + state.player.radius) {
    hurtPlayer(state, bossStats.pulseDamage, events);
  }
}

function hurtPlayer(state: AdventureState, damage: number, events: AdventureEvent[]): void {
  state.player.health = Math.max(0, state.player.health - damage);
  state.hurtTimer = adventureContent.player.hurtCooldown;
  events.push({ type: "playerHurt", damage });
}

function findNearestNode(state: AdventureState) {
  const range = adventureContent.player.interactRange;
  let best: (typeof adventureContent.resourceNodes)[number] | null = null;
  let bestDist = Infinity;

  for (const node of adventureContent.resourceNodes) {
    if (state.depletedNodeIds.includes(node.id)) {
      continue;
    }
    const dist = distance(node, state.player);
    if (dist <= range && dist < bestDist) {
      best = node;
      bestDist = dist;
    }
  }
  return best;
}

function isNearWorkbench(state: AdventureState): boolean {
  return distance(adventureContent.workbench, state.player) <= adventureContent.player.interactRange + workbenchReachBonus;
}

function getBoss(state: AdventureState): FoeState {
  const boss = state.foes.find((foe) => foe.kind === "boss");
  if (!boss) {
    throw new Error("Adventure state is missing its boss.");
  }
  return boss;
}

function cloneState(state: AdventureState): AdventureState {
  return {
    ...state,
    player: { ...state.player },
    inventory: { ...state.inventory },
    depletedNodeIds: [...state.depletedNodeIds],
    foes: state.foes.map((foe) => ({ ...foe })),
  };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
