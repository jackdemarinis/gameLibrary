import { adventureContent, type Point, type ResourceKind } from "./adventureContent";

export type AdventureStatus = "active" | "won" | "lost";
export type FoeKind = "shade" | "boss";
/** Shade behaviour: drift, chase, swell up (wind-up), dash (lunge), then catch their breath. */
export type FoeMode = "idle" | "chase" | "windup" | "lunge" | "recover" | "daze";

export interface AdventureInput {
  moveX: number;
  moveY: number;
  /** One-shot press: swing the sword. */
  attack: boolean;
  /** One-shot press: gather a nearby node or forge at the workbench. */
  interact: boolean;
  /** One-shot press: dodge roll (invulnerable while rolling). */
  dodge?: boolean;
  /** Optional aim (e.g. toward the mouse) for this swing; otherwise the keeper swings where they face. */
  aimX?: number;
  aimY?: number;
}

export interface FoeState extends Point {
  id: string;
  kind: FoeKind;
  radius: number;
  health: number;
  maxHealth: number;
  alive: boolean;
  mode: FoeMode;
  modeTimer: number;
  /** Locked direction of a lunge. */
  dirX: number;
  dirY: number;
  /** Knockback velocity, decaying. */
  velX: number;
  velY: number;
  /** Seconds left showing the "just hit" flash/pose. */
  hitFlash: number;
}

export interface PickupState extends Point {
  id: string;
  kind: "heart";
}

export interface PlayerState extends Point {
  health: number;
  maxHealth: number;
  radius: number;
  facingX: number;
  facingY: number;
  /** Seconds left in the current sword swing (drives the attack animation). */
  swingTimer: number;
  dodgeTimer: number;
  dodgeCooldown: number;
  dodgeX: number;
  dodgeY: number;
  velX: number;
  velY: number;
  stunTimer: number;
  /** Did the keeper actually move this step (drives the run animation). */
  moving: boolean;
}

export interface AdventureState {
  status: AdventureStatus;
  elapsed: number;
  player: PlayerState;
  inventory: Record<ResourceKind, number>;
  hasLantern: boolean;
  depletedNodeIds: string[];
  foes: FoeState[];
  pickups: PickupState[];
  attackTimer: number;
  hurtTimer: number;
  pulseTimer: number;
  message: string;
}

export type AdventureEvent =
  | { type: "gathered"; kind: ResourceKind; nodeId: string }
  | { type: "crafted" }
  | { type: "swing"; x: number; y: number; angle: number; range: number }
  | { type: "dodge" }
  | { type: "foeHit"; foeId: string; damage: number }
  | { type: "foeBlocked"; foeId: string }
  | { type: "foeDefeated"; foeId: string }
  | { type: "foeWindup"; foeId: string }
  | { type: "playerHurt"; damage: number }
  | { type: "healed"; amount: number }
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
const pickupRadius = 34;

function makeFoe(id: string, kind: FoeKind, x: number, y: number, radius: number, maxHealth: number): FoeState {
  return { id, kind, x, y, radius, health: maxHealth, maxHealth, alive: true, mode: "idle", modeTimer: 0, dirX: 0, dirY: 0, velX: 0, velY: 0, hitFlash: 0 };
}

export function createAdventureState(): AdventureState {
  const { player, shade, bossStats, shades, boss, playerSpawn } = adventureContent;

  return {
    status: "active",
    elapsed: 0,
    player: {
      ...playerSpawn,
      health: player.maxHealth,
      maxHealth: player.maxHealth,
      radius: player.radius,
      facingX: 1,
      facingY: 0,
      swingTimer: 0,
      dodgeTimer: 0,
      dodgeCooldown: 0,
      dodgeX: 0,
      dodgeY: 0,
      velX: 0,
      velY: 0,
      stunTimer: 0,
      moving: false,
    },
    inventory: { timber: 0, ironstone: 0 },
    hasLantern: false,
    depletedNodeIds: [],
    foes: [
      ...shades.map((foe) => makeFoe(foe.id, "shade", foe.x, foe.y, shade.radius, shade.maxHealth)),
      makeFoe(boss.id, "boss", boss.x, boss.y, bossStats.radius, bossStats.maxHealth),
    ],
    pickups: [],
    attackTimer: 0,
    hurtTimer: 0,
    pulseTimer: bossStats.pulseInterval,
    message: "Follow the orange marker to a tree and swing at it.",
  };
}

export function hasRecipeMaterials(state: AdventureState): boolean {
  const { recipe } = adventureContent;
  return state.inventory.timber >= recipe.timber && state.inventory.ironstone >= recipe.ironstone;
}

/** The shrine gate is sealed by fog: it needs ember light and every shade banished. */
export function isGateOpen(state: AdventureState): boolean {
  return state.hasLantern && state.foes.every((foe) => foe.kind !== "shade" || !foe.alive);
}

export function isBossCharging(state: AdventureState): boolean {
  const boss = getBoss(state);
  return isGateOpen(state) && boss.alive && boss.mode !== "daze" && state.pulseTimer <= adventureContent.bossStats.pulseWindup;
}

export function isPlayerInvulnerable(state: AdventureState): boolean {
  return state.player.dodgeTimer > 0 || state.hurtTimer > 0;
}

export function getObjective(state: AdventureState): Objective {
  const { chapters, recipe } = adventureContent;
  const boss = getBoss(state);

  if (!boss.alive) {
    return { step: 4, chapter: "Dawn", text: "The mire recedes. Cinderhollow is safe." };
  }
  if (!state.hasLantern && !hasRecipeMaterials(state)) {
    const timber = Math.min(state.inventory.timber, recipe.timber);
    const iron = Math.min(state.inventory.ironstone, recipe.ironstone);
    return {
      step: 0,
      chapter: chapters[0],
      text: `Chop trees & mine grey rocks: timber ${timber}/${recipe.timber}, ironstone ${iron}/${recipe.ironstone}`,
    };
  }
  if (!state.hasLantern) {
    return { step: 1, chapter: chapters[1], text: "Bring your materials to the workbench and press E to forge." };
  }
  const remaining = state.foes.filter((foe) => foe.kind === "shade" && foe.alive).length;
  if (remaining > 0) {
    return { step: 2, chapter: chapters[2], text: `Banish the shades in the east: ${remaining} left` };
  }
  return { step: 3, chapter: chapters[3], text: "The shrine gate is open. Defeat the Mirewarden — roll through its red pulse." };
}

/** Where the objective marker should point right now, or null when nothing needs guiding. */
export function getObjectiveTarget(state: AdventureState): Point | null {
  const { recipe, resourceNodes, workbench, gateX, playerSpawn } = adventureContent;
  if (state.status !== "active") {
    return null;
  }
  if (!state.hasLantern && !hasRecipeMaterials(state)) {
    const needTimber = state.inventory.timber < recipe.timber;
    const needIron = state.inventory.ironstone < recipe.ironstone;
    let best: Point | null = null;
    let bestDist = Infinity;
    for (const node of resourceNodes) {
      const wanted = node.kind === "timber" ? needTimber : needIron;
      if (!wanted || state.depletedNodeIds.includes(node.id)) continue;
      const dist = distance(node, state.player);
      if (dist < bestDist) {
        best = node;
        bestDist = dist;
      }
    }
    return best;
  }
  if (!state.hasLantern) {
    return workbench;
  }
  const shade = state.foes
    .filter((foe) => foe.kind === "shade" && foe.alive)
    .sort((a, b) => distance(a, state.player) - distance(b, state.player))[0];
  if (shade) {
    return shade;
  }
  if (state.player.x < gateX) {
    return { x: gateX + 40, y: playerSpawn.y };
  }
  return getBoss(state);
}

/** Context hint for whatever the player could interact with right now. */
export function getInteractPrompt(state: AdventureState): string | null {
  if (state.status !== "active") {
    return null;
  }
  if (isNearWorkbench(state) && !state.hasLantern) {
    return hasRecipeMaterials(state) ? "E: Forge the Ember Lantern" : "Workbench: bring 3 timber + 2 ironstone";
  }
  const node = findNearestNode(state);
  return node ? `E / Attack: ${node.kind === "timber" ? "Chop tree" : "Mine rock"}` : null;
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
  const p = state.player;
  state.elapsed += dt;
  state.attackTimer = Math.max(0, state.attackTimer - dt);
  state.hurtTimer = Math.max(0, state.hurtTimer - dt);
  p.swingTimer = Math.max(0, p.swingTimer - dt);
  p.dodgeTimer = Math.max(0, p.dodgeTimer - dt);
  p.dodgeCooldown = Math.max(0, p.dodgeCooldown - dt);
  p.stunTimer = Math.max(0, p.stunTimer - dt);

  const canAct = p.stunTimer <= 0 && p.dodgeTimer <= 0;
  if (input.dodge && canAct && p.dodgeCooldown <= 0) {
    startDodge(state, input, events);
  }

  movePlayer(state, input, dt, gateWasOpen);

  if (input.interact && canAct) {
    interact(state, events);
  }
  if (input.attack && canAct && state.attackTimer <= 0) {
    attack(state, input, events);
  }

  moveFoes(state, dt, gateWasOpen, events);
  updateBossPulse(state, dt, gateWasOpen, events);
  collectPickups(state, events);

  if (!gateWasOpen && isGateOpen(state)) {
    state.message = "The shrine gate grinds open to the east.";
    events.push({ type: "gateOpened" });
  }

  if (!getBoss(state).alive) {
    state.status = "won";
    state.message = "The Mirewarden is stilled. Dawn breaks over Cinderhollow.";
  } else if (p.health <= 0) {
    p.health = 0;
    state.status = "lost";
    state.message = "The fog takes the lantern-keeper.";
  }

  return { state, events };
}

/**
 * Thin stateful wrapper for scenes: accumulates frame time into fixed steps.
 * One-shot presses are latched until a fixed step consumes them, so a press on a
 * short frame (high-refresh displays run frames shorter than one step) is never lost.
 */
export class AdventureSimulation {
  private state: AdventureState = createAdventureState();
  private accumulator = 0;
  private pendingAttack = false;
  private pendingInteract = false;
  private pendingDodge = false;

  getState(): AdventureState {
    return this.state;
  }

  /** Replaces the live state (checkpoint restore). */
  loadState(state: AdventureState): void {
    this.state = cloneState(state);
    this.accumulator = 0;
    this.pendingAttack = false;
    this.pendingInteract = false;
    this.pendingDodge = false;
  }

  advance(deltaMs: number, input: AdventureInput): AdventureEvent[] {
    this.accumulator += Math.min(maxFrameSeconds, Math.max(0, deltaMs / 1000));
    this.pendingAttack ||= input.attack;
    this.pendingInteract ||= input.interact;
    this.pendingDodge ||= Boolean(input.dodge);
    const events: AdventureEvent[] = [];

    while (this.accumulator >= fixedStep) {
      this.accumulator -= fixedStep;
      const result = stepAdventure(this.state, {
        ...input,
        attack: this.pendingAttack,
        interact: this.pendingInteract,
        dodge: this.pendingDodge,
      });
      this.state = result.state;
      events.push(...result.events);
      // One-shot actions apply only to the first fixed step that runs.
      this.pendingAttack = false;
      this.pendingInteract = false;
      this.pendingDodge = false;
    }

    return events;
  }
}

/**
 * A checkpoint of the current state with the keeper fully healed and every foe
 * reset to where it stood, so a retry starts the chapter fresh but keeps progress.
 */
export function checkpointFrom(state: AdventureState): AdventureState {
  const fresh = createAdventureState();
  const checkpoint = cloneState(state);
  checkpoint.status = "active";
  checkpoint.player = { ...fresh.player, x: state.player.x, y: state.player.y, facingX: state.player.facingX, facingY: state.player.facingY };
  checkpoint.attackTimer = 0;
  checkpoint.hurtTimer = 0;
  checkpoint.pulseTimer = fresh.pulseTimer;
  checkpoint.foes = state.foes.map((foe) => {
    const original = fresh.foes.find((candidate) => candidate.id === foe.id) ?? foe;
    return foe.alive ? { ...original } : { ...foe };
  });
  return checkpoint;
}

function startDodge(state: AdventureState, input: AdventureInput, events: AdventureEvent[]): void {
  const { player } = adventureContent;
  const p = state.player;
  const length = Math.hypot(input.moveX, input.moveY);
  p.dodgeX = length > 0 ? input.moveX / length : p.facingX;
  p.dodgeY = length > 0 ? input.moveY / length : p.facingY;
  p.dodgeTimer = player.dodgeSeconds;
  p.dodgeCooldown = player.dodgeSeconds + player.dodgeCooldown;
  p.swingTimer = 0;
  events.push({ type: "dodge" });
}

function movePlayer(state: AdventureState, input: AdventureInput, dt: number, gateOpen: boolean): void {
  const { player } = adventureContent;
  const p = state.player;
  let vx = p.velX;
  let vy = p.velY;
  // Knockback fades quickly.
  const decay = Math.max(0, 1 - dt * 9);
  p.velX *= decay;
  p.velY *= decay;

  const length = Math.hypot(input.moveX, input.moveY);
  if (p.dodgeTimer > 0) {
    vx += p.dodgeX * player.dodgeSpeed;
    vy += p.dodgeY * player.dodgeSpeed;
  } else if (length > 0 && p.stunTimer <= 0) {
    p.facingX = input.moveX / length;
    p.facingY = input.moveY / length;
    // Mid-swing you can still shuffle, but slowly.
    const speed = p.swingTimer > 0 ? player.speed * 0.35 : player.speed;
    vx += p.facingX * speed;
    vy += p.facingY * speed;
  }

  const startX = p.x;
  const startY = p.y;
  moveBody(p, vx * dt, vy * dt, gateOpen);
  p.moving = Math.hypot(p.x - startX, p.y - startY) > 0.05 && length > 0 && p.dodgeTimer <= 0;
}

/** Moves the keeper one axis at a time so walls block that axis only and they slide along them. */
function moveBody(p: PlayerState, dx: number, dy: number, gateOpen: boolean): void {
  const { world, gateX } = adventureContent;
  const r = p.radius;
  const maxX = gateOpen ? world.width - r : gateX - r;
  const startX = p.x;
  const startY = p.y;
  p.x = clamp(startX + dx, r, maxX);
  p.x = blockAxis(p.x, p.y, startX, "x");
  p.y = clamp(startY + dy, r, world.height - r);
  p.y = blockAxis(p.y, p.x, startY, "y");
}

/** Collision half-size of the lantern-keeper's feet against village props. */
const footHalf = 14;

/** Returns `value` on `axis`, pulled back so the player's foot box stays out of every obstacle. */
export function blockAxis(value: number, other: number, previous: number, axis: "x" | "y"): number {
  let result = value;
  for (const box of adventureContent.obstacles) {
    const [lo, size, otherLo, otherSize] = axis === "x" ? [box.x, box.w, box.y, box.h] : [box.y, box.h, box.x, box.w];
    const overlapsOther = other + footHalf > otherLo && other - footHalf < otherLo + otherSize;
    const overlapsAxis = result + footHalf > lo && result - footHalf < lo + size;
    if (!overlapsOther || !overlapsAxis) {
      continue;
    }
    result = previous <= lo + size / 2 ? lo - footHalf : lo + size + footHalf;
  }
  return result;
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
    state.message = "The Ember Lantern blazes and your blade catches fire! Head east.";
    events.push({ type: "crafted" });
    return;
  }

  gather(state, events);
}

function gather(state: AdventureState, events: AdventureEvent[]): boolean {
  const node = findNearestNode(state);
  if (!node) {
    return false;
  }
  state.depletedNodeIds.push(node.id);
  state.inventory[node.kind] += 1;
  state.message = `+1 ${node.kind}`;
  events.push({ type: "gathered", kind: node.kind, nodeId: node.id });
  return true;
}

function attack(state: AdventureState, input: AdventureInput, events: AdventureEvent[]): void {
  const { player, gateX } = adventureContent;
  const p = state.player;
  const aimLength = Math.hypot(input.aimX ?? 0, input.aimY ?? 0);
  if (aimLength > 0) {
    p.facingX = (input.aimX ?? 0) / aimLength;
    p.facingY = (input.aimY ?? 0) / aimLength;
  }
  state.attackTimer = player.attackCooldown;
  p.swingTimer = player.swingSeconds;
  events.push({ type: "swing", x: p.x, y: p.y, angle: Math.atan2(p.facingY, p.facingX), range: player.attackRange });

  const halfArc = ((player.attackArcDegrees / 2) * Math.PI) / 180;
  let hitAny = false;
  for (const foe of state.foes) {
    if (!foe.alive) continue;
    const dist = distance(foe, p);
    if (dist - foe.radius > player.attackRange) continue;
    // Inside the cut: in front of the keeper, or so close it can't miss.
    const angleTo = Math.atan2(foe.y - p.y, foe.x - p.x);
    const off = Math.abs(Math.atan2(Math.sin(angleTo - Math.atan2(p.facingY, p.facingX)), Math.cos(angleTo - Math.atan2(p.facingY, p.facingX))));
    if (off > halfArc && dist > foe.radius + p.radius + 6) continue;

    if (foe.kind === "boss" && (!state.hasLantern || p.x < gateX)) {
      state.message = "Your blade passes through the Mirewarden. Only ember light can wound it.";
      events.push({ type: "foeBlocked", foeId: foe.id });
      continue;
    }
    hitAny = true;
    const damage = state.hasLantern ? player.lanternDamage : player.bladeDamage;
    foe.health = Math.max(0, foe.health - damage);
    foe.hitFlash = 0.18;
    const push = foe.kind === "boss" ? adventureContent.bossStats.knockback : adventureContent.shade.knockback;
    const nx = dist === 0 ? p.facingX : (foe.x - p.x) / dist;
    const ny = dist === 0 ? p.facingY : (foe.y - p.y) / dist;
    foe.velX = nx * push;
    foe.velY = ny * push;
    if (foe.kind === "shade") {
      // A hit interrupts a wind-up or lunge.
      foe.mode = "recover";
      foe.modeTimer = 0.45;
    }
    events.push({ type: "foeHit", foeId: foe.id, damage });

    if (foe.health === 0) {
      foe.alive = false;
      events.push({ type: "foeDefeated", foeId: foe.id });
      if (foe.kind === "shade") {
        state.pickups.push({ id: `heart-${foe.id}`, kind: "heart", x: foe.x, y: foe.y });
        state.message = "Shade banished! It left a heart behind.";
      }
    }
  }

  // Swinging at a tree or rock gathers it too, so there is never a "wrong" key.
  if (!hitAny) {
    if (isNearWorkbench(state) && !state.hasLantern && hasRecipeMaterials(state)) {
      interact(state, events);
      return;
    }
    gather(state, events);
  }
}

function moveFoes(state: AdventureState, dt: number, gateOpen: boolean, events: AdventureEvent[]): void {
  const { shade, bossStats, gateX, world } = adventureContent;
  const p = state.player;

  for (const foe of state.foes) {
    if (!foe.alive) continue;
    foe.hitFlash = Math.max(0, foe.hitFlash - dt);
    foe.modeTimer = Math.max(0, foe.modeTimer - dt);

    // Knockback first, then whatever the foe wants to do.
    const decay = Math.max(0, 1 - dt * 8);
    foe.x += foe.velX * dt;
    foe.y += foe.velY * dt;
    foe.velX *= decay;
    foe.velY *= decay;

    const isBoss = foe.kind === "boss";
    if (isBoss && !gateOpen) {
      continue;
    }
    const dist = distance(foe, p);
    const toX = dist === 0 ? 0 : (p.x - foe.x) / dist;
    const toY = dist === 0 ? 0 : (p.y - foe.y) / dist;
    const contactDist = foe.radius + p.radius;

    if (isBoss) {
      if (foe.mode === "daze" && foe.modeTimer <= 0) foe.mode = "chase";
      if (foe.mode !== "daze" && dist > contactDist) {
        const travel = Math.min(bossStats.speed * dt, dist - contactDist);
        foe.x += toX * travel;
        foe.y += toY * travel;
      }
    } else {
      updateShade(foe, dist, toX, toY, contactDist, dt, events);
    }

    // Shades stay in the wilds; the Mirewarden stays in its shrine.
    foe.x = isBoss ? clamp(foe.x, gateX + foe.radius, world.width - foe.radius) : clamp(foe.x, foe.radius, gateX - foe.radius);
    foe.y = clamp(foe.y, foe.radius, world.height - foe.radius);

    if (distance(foe, p) <= contactDist + 0.5 && !isPlayerInvulnerable(state)) {
      const damage = isBoss ? bossStats.contactDamage : foe.mode === "lunge" ? shade.lungeDamage : shade.contactDamage;
      hurtPlayer(state, damage, foe, events);
      if (!isBoss) {
        foe.mode = "recover";
        foe.modeTimer = shade.recoverSeconds;
      }
    }
  }

  separateShades(state);
}

function updateShade(foe: FoeState, dist: number, toX: number, toY: number, contactDist: number, dt: number, events: AdventureEvent[]): void {
  const { shade } = adventureContent;
  switch (foe.mode) {
    case "idle":
      if (dist <= shade.aggroRange) foe.mode = "chase";
      break;
    case "chase":
      if (dist > shade.aggroRange * 1.6) {
        foe.mode = "idle";
      } else if (dist <= shade.lungeRange) {
        foe.mode = "windup";
        foe.modeTimer = shade.windupSeconds;
        foe.dirX = toX;
        foe.dirY = toY;
        events.push({ type: "foeWindup", foeId: foe.id });
      } else if (dist > contactDist) {
        foe.x += toX * shade.speed * dt;
        foe.y += toY * shade.speed * dt;
      }
      break;
    case "windup":
      // Track the keeper while swelling, then commit.
      foe.dirX = toX;
      foe.dirY = toY;
      if (foe.modeTimer <= 0) {
        foe.mode = "lunge";
        foe.modeTimer = shade.lungeSeconds;
      }
      break;
    case "lunge":
      foe.x += foe.dirX * shade.lungeSpeed * dt;
      foe.y += foe.dirY * shade.lungeSpeed * dt;
      if (foe.modeTimer <= 0) {
        foe.mode = "recover";
        foe.modeTimer = shade.recoverSeconds;
      }
      break;
    case "recover":
      foe.x -= toX * shade.speed * 0.25 * dt;
      foe.y -= toY * shade.speed * 0.25 * dt;
      if (foe.modeTimer <= 0) foe.mode = "chase";
      break;
    default:
      foe.mode = "chase";
  }
}

/** Keeps shades from stacking on one spot. */
function separateShades(state: AdventureState): void {
  const shades = state.foes.filter((foe) => foe.kind === "shade" && foe.alive);
  for (let i = 0; i < shades.length; i += 1) {
    for (let j = i + 1; j < shades.length; j += 1) {
      const a = shades[i];
      const b = shades[j];
      const dist = distance(a, b);
      const min = a.radius + b.radius;
      if (dist > 0 && dist < min) {
        const push = (min - dist) / 2;
        const nx = (b.x - a.x) / dist;
        const ny = (b.y - a.y) / dist;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }
}

function updateBossPulse(state: AdventureState, dt: number, gateOpen: boolean, events: AdventureEvent[]): void {
  const { bossStats } = adventureContent;
  const boss = getBoss(state);

  if (!gateOpen || !boss.alive || boss.mode === "daze") {
    return;
  }

  state.pulseTimer -= dt;
  if (state.pulseTimer > 0) {
    return;
  }

  state.pulseTimer += bossStats.pulseInterval;
  boss.mode = "daze";
  boss.modeTimer = bossStats.dazeSeconds;
  events.push({ type: "pulse", x: boss.x, y: boss.y, radius: bossStats.pulseRadius });

  if (distance(boss, state.player) <= bossStats.pulseRadius + state.player.radius && !isPlayerInvulnerable(state)) {
    hurtPlayer(state, bossStats.pulseDamage, boss, events);
  }
}

function collectPickups(state: AdventureState, events: AdventureEvent[]): void {
  const p = state.player;
  state.pickups = state.pickups.filter((pickup) => {
    if (distance(pickup, p) > pickupRadius + p.radius) return true;
    const before = p.health;
    p.health = Math.min(p.maxHealth, p.health + adventureContent.heartHeal);
    events.push({ type: "healed", amount: p.health - before });
    return false;
  });
}

function hurtPlayer(state: AdventureState, damage: number, source: Point, events: AdventureEvent[]): void {
  const { player } = adventureContent;
  const p = state.player;
  p.health = Math.max(0, p.health - damage);
  state.hurtTimer = player.hurtCooldown;
  p.stunTimer = player.hurtStun;
  p.swingTimer = 0;
  const dist = distance(source, p);
  p.velX = dist === 0 ? -p.facingX * player.hurtKnockback : ((p.x - source.x) / dist) * player.hurtKnockback;
  p.velY = dist === 0 ? -p.facingY * player.hurtKnockback : ((p.y - source.y) / dist) * player.hurtKnockback;
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

export function getBoss(state: AdventureState): FoeState {
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
    pickups: state.pickups.map((pickup) => ({ ...pickup })),
  };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
