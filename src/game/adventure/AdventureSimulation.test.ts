import { describe, expect, it } from "vitest";
import { adventureContent, type Point } from "./adventureContent";
import {
  AdventureSimulation,
  createAdventureState,
  getObjective,
  isGateOpen,
  stepAdventure,
  type AdventureInput,
  type AdventureState,
} from "./AdventureSimulation";

const idle: AdventureInput = { moveX: 0, moveY: 0, attack: false, interact: false };

function step(state: AdventureState, input: Partial<AdventureInput> = {}): AdventureState {
  return stepAdventure(state, { ...idle, ...input }).state;
}

function placePlayer(state: AdventureState, point: Point): AdventureState {
  return { ...state, player: { ...state.player, x: point.x, y: point.y } };
}

function walkTo(state: AdventureState, target: Point, maxSteps = 2000): AdventureState {
  let current = state;
  for (let i = 0; i < maxSteps && current.status === "active"; i += 1) {
    const dx = target.x - current.player.x;
    const dy = target.y - current.player.y;
    if (Math.hypot(dx, dy) < 4) {
      break;
    }
    current = step(current, { moveX: dx, moveY: dy });
  }
  return current;
}

function fight(state: AdventureState, foeId: string, maxSteps = 3000): AdventureState {
  let current = state;
  for (let i = 0; i < maxSteps && current.status === "active"; i += 1) {
    const foe = current.foes.find((candidate) => candidate.id === foeId);
    if (!foe?.alive) {
      break;
    }
    const dx = foe.x - current.player.x;
    const dy = foe.y - current.player.y;
    const close = Math.hypot(dx, dy) - foe.radius < adventureContent.player.attackRange - 10;
    current = step(current, { moveX: close ? 0 : dx, moveY: close ? 0 : dy, attack: true });
  }
  return current;
}

function gatherAll(state: AdventureState): AdventureState {
  let current = state;
  for (const node of adventureContent.resourceNodes) {
    current = step(placePlayer(current, node), { interact: true });
  }
  return current;
}

describe("Lanternwake simulation", () => {
  it("gathers a node once and depletes it", () => {
    const [tree] = adventureContent.resourceNodes;
    let state = step(placePlayer(createAdventureState(), tree), { interact: true });
    expect(state.inventory.timber).toBe(1);
    expect(state.depletedNodeIds).toContain(tree.id);

    state = step(state, { interact: true });
    expect(state.inventory.timber).toBe(1);
  });

  it("refuses to craft without materials, then forges the lantern and heals", () => {
    const atBench = placePlayer(createAdventureState(), adventureContent.workbench);
    const refused = step(atBench, { interact: true });
    expect(refused.hasLantern).toBe(false);

    const stocked: AdventureState = {
      ...atBench,
      inventory: { timber: 4, ironstone: 2 },
      player: { ...atBench.player, health: 40 },
    };
    expect(getObjective(stocked).step).toBe(1);

    const crafted = step(stocked, { interact: true });
    expect(crafted.hasLantern).toBe(true);
    expect(crafted.inventory).toEqual({ timber: 1, ironstone: 0 });
    expect(crafted.player.health).toBe(adventureContent.player.maxHealth);
  });

  it("keeps the shrine gate closed until every shade is defeated", () => {
    let state = placePlayer(createAdventureState(), { x: adventureContent.gateX - 30, y: 60 });
    for (let i = 0; i < 60; i += 1) {
      state = step(state, { moveX: 1 });
    }
    expect(isGateOpen(state)).toBe(false);
    expect(state.player.x).toBeLessThanOrEqual(adventureContent.gateX - state.player.radius);
  });

  it("makes the boss immune to strikes without the Ember Lantern", () => {
    const base = createAdventureState();
    const boss = base.foes.find((foe) => foe.kind === "boss")!;
    const state: AdventureState = {
      ...placePlayer(base, { x: boss.x - 60, y: boss.y }),
      foes: base.foes.map((foe) => (foe.kind === "shade" ? { ...foe, alive: false } : foe)),
    };
    const after = step(state, { attack: true });
    expect(after.foes.find((foe) => foe.kind === "boss")!.health).toBe(boss.maxHealth);
  });

  it("ends in defeat when health runs out", () => {
    const base = createAdventureState();
    const shade = base.foes[0];
    let state = placePlayer({ ...base, player: { ...base.player, health: 1 } }, { x: shade.x - 30, y: shade.y });
    for (let i = 0; i < 30 && state.status === "active"; i += 1) {
      state = step(state);
    }
    expect(state.status).toBe("lost");
  });

  it("applies a one-shot attack only once per frame in the wrapper", () => {
    const simulation = new AdventureSimulation();
    const events = simulation.advance(100, { ...idle, attack: true });
    expect(events.filter((event) => event.type === "swing")).toHaveLength(1);
  });

  it("completes the full campaign deterministically: gather, forge, clear, boss", () => {
    const play = (): AdventureState => {
      let state = gatherAll(createAdventureState());
      expect(getObjective(state).step).toBe(1);

      state = step(walkTo(state, adventureContent.workbench), { interact: true });
      expect(state.hasLantern).toBe(true);
      expect(getObjective(state).step).toBe(2);

      for (const shade of adventureContent.shades) {
        state = fight(state, shade.id);
      }
      expect(isGateOpen(state)).toBe(true);
      expect(getObjective(state).step).toBe(3);

      return fight(state, adventureContent.boss.id);
    };

    const first = play();
    expect(first.status).toBe("won");
    expect(getObjective(first).step).toBe(4);
    expect(play()).toEqual(first);
  });
});
