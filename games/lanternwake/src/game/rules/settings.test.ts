import { describe, expect, it } from "vitest";
import { ExploreGrid, exploreCell } from "./exploration";
import { defaultBindings, defaultSettings, keyName, parseSettings, rebind } from "./settings";

describe("key bindings", () => {
  it("swaps when the new key is already used", () => {
    const next = rebind(defaultBindings, "jump", "KeyJ");
    expect(next.jump).toBe("KeyJ");
    expect(next.attack).toBe("Space");
    expect(new Set(Object.values(next)).size).toBe(Object.keys(next).length);
  });

  it("refuses reserved menu keys", () => {
    expect(rebind(defaultBindings, "jump", "Escape")).toEqual(defaultBindings);
  });

  it("parses saved settings and clamps bad values", () => {
    const parsed = parseSettings(JSON.stringify({ sfxVolume: 3, musicVolume: -1, mouseSensitivity: "x", invertY: true, bindings: { jump: "KeyK" } }));
    expect(parsed.sfxVolume).toBe(1);
    expect(parsed.musicVolume).toBe(0);
    expect(parsed.mouseSensitivity).toBe(1);
    expect(parsed.invertY).toBe(true);
    expect(parsed.bindings.jump).toBe("KeyK");
  });

  it("falls back to default bindings when a key is bound twice", () => {
    const parsed = parseSettings(JSON.stringify({ bindings: { jump: "KeyW" } }));
    expect(parsed.bindings).toEqual(defaultBindings);
    expect(parseSettings("not json")).toEqual(defaultSettings());
  });

  it("names keys for the menu", () => {
    expect(keyName("KeyW")).toBe("W");
    expect(keyName("ShiftLeft")).toBe("L-Shift");
    expect(keyName("Digit3")).toBe("3");
  });
});

describe("exploration map", () => {
  it("reveals a disc around the hero and nothing far away", () => {
    const grid = new ExploreGrid(100);
    expect(grid.reveal(0, 0, 10)).toBe(true);
    expect(grid.reveal(0, 0, 10)).toBe(false);
    const centre = grid.cellOf(0, 0);
    expect(grid.isRevealed(centre.cellX, centre.cellZ)).toBe(true);
    const far = grid.cellOf(40, 40);
    expect(grid.isRevealed(far.cellX, far.cellZ)).toBe(false);
    const edge = grid.cellOf(10 + exploreCell * 2, 0);
    expect(grid.isRevealed(edge.cellX, edge.cellZ)).toBe(false);
  });

  it("round-trips through its saved string", () => {
    const grid = new ExploreGrid(128);
    grid.reveal(-30, 12);
    grid.reveal(50, -50);
    const copy = new ExploreGrid(128, grid.encode());
    expect(copy.fraction()).toBeCloseTo(grid.fraction());
    expect(copy.fraction()).toBeGreaterThan(0);
    expect(new ExploreGrid(128, "%%%").fraction()).toBe(0);
  });
});

describe("quest journal", () => {
  it("splits missions into completed (newest first), current and hidden", async () => {
    const { questLog, currentObjective } = await import("./quests");
    const { areas } = await import("../content/areas");
    const flags = new Set(["elderBlessing", "plateSolved", "lit:wickmoorLantern"]);
    const log = questLog(flags, Object.values(areas));
    expect(log.completed.map((mission) => mission.number)).toEqual([2, 1]);
    expect(log.current?.number).toBe(3);
    expect(log.current?.hint).toBeTruthy();
    expect(log.hiddenCount).toBe(1);
    expect(log.nextStep).toBe(currentObjective(flags));
    expect(log.side[0]).toMatchObject({ done: 1, total: 4 });
    expect(log.side[0].remaining.join()).toContain("Gloamwood");
  });

  it("reports the chapter complete when every mission is done", async () => {
    const { questLog } = await import("./quests");
    const log = questLog(new Set(["elderBlessing", "plateSolved", "braziersLit", "bossDefeated"]), []);
    expect(log.current).toBeNull();
    expect(log.completed).toHaveLength(4);
    expect(log.nextStep).toContain("complete");
  });
});
