import { describe, expect, it } from "vitest";
import { angleDelta, applyDamage, comboDamage, inSwingArc, knockback, yawTowards } from "./combat";
import { levelForXp, maxLevel, statsFor, xpToNext } from "./progression";
import { PuzzleTracker } from "./puzzleLogic";
import { newSave, parseSave } from "./saveData";

describe("progression", () => {
  it("starts at level 1 and levels up exactly at the threshold", () => {
    expect(levelForXp(0)).toEqual({ level: 1, intoLevel: 0, needed: xpToNext(1) });
    expect(levelForXp(xpToNext(1) - 1).level).toBe(1);
    expect(levelForXp(xpToNext(1)).level).toBe(2);
    expect(levelForXp(xpToNext(1) + xpToNext(2) + 5)).toEqual({ level: 3, intoLevel: 5, needed: xpToNext(3) });
  });

  it("caps at the max level", () => {
    const progress = levelForXp(10_000_000);
    expect(progress.level).toBe(maxLevel);
    expect(progress.needed).toBe(0);
  });

  it("grows hearts, damage and oil with level and containers", () => {
    const start = statsFor(1, 0);
    expect(start.maxHearts).toBe(3);
    expect(start.swordDamage).toBe(2);
    const later = statsFor(7, 2);
    expect(later.maxHearts).toBe(3 + 2 + 2);
    expect(later.swordDamage).toBe(5);
    expect(later.maxOil).toBeGreaterThan(start.maxOil);
  });
});

describe("combat", () => {
  it("hits targets in front within reach and misses ones behind", () => {
    const origin = { x: 0, z: 0 };
    expect(inSwingArc(origin, 0, { x: 0, z: 1.5 }, 2, Math.PI / 2)).toBe(true);
    expect(inSwingArc(origin, 0, { x: 0, z: -1.5 }, 2, Math.PI / 2)).toBe(false);
    expect(inSwingArc(origin, 0, { x: 0, z: 3 }, 2, Math.PI / 2)).toBe(false);
    expect(inSwingArc(origin, 0, { x: 0, z: 2.4 }, 2, Math.PI / 2, 0.5)).toBe(true);
  });

  it("wraps angle differences", () => {
    expect(angleDelta(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(0.2);
    expect(yawTowards({ x: 0, z: 0 }, { x: 1, z: 0 })).toBeCloseTo(Math.PI / 2);
  });

  it("makes the finisher hit harder and clamps health", () => {
    expect(comboDamage(4, 0)).toBe(4);
    expect(comboDamage(4, 2)).toBe(6);
    expect(applyDamage(3, 5)).toBe(0);
    const push = knockback({ x: 0, z: 0 }, { x: 3, z: 4 }, 10);
    expect(push.x).toBeCloseTo(6);
    expect(push.z).toBeCloseTo(8);
  });
});

describe("puzzles", () => {
  it("solves a plate puzzle only with every plate pressed, then latches", () => {
    const tracker = new PuzzleTracker([{ id: "p", kind: "plates", members: ["a", "b"], setsFlag: "gate" }]);
    tracker.setActive("a", true, 0);
    expect(tracker.update(0)).toEqual([]);
    tracker.setActive("b", true, 1);
    expect(tracker.update(1)).toEqual([{ type: "solved", puzzleId: "p", flag: "gate" }]);
    tracker.setActive("a", false, 2);
    expect(tracker.isSolved("p")).toBe(true);
    expect(tracker.isActive("a")).toBe(true);
    expect(tracker.update(3)).toEqual([]);
  });

  it("lets timed braziers burn out unless all are lit in time", () => {
    const tracker = new PuzzleTracker([
      { id: "fire", kind: "braziers", members: ["x", "y"], setsFlag: "lit", burnSeconds: 10 },
    ]);
    tracker.setActive("x", true, 0);
    expect(tracker.burnLeft("x", 4)).toBe(6);
    expect(tracker.update(10)).toEqual([{ type: "memberOut", puzzleId: "fire", memberId: "x" }]);
    tracker.setActive("x", true, 11);
    tracker.setActive("y", true, 15);
    expect(tracker.update(15)[0]?.type).toBe("solved");
  });

  it("restores already-solved puzzles from a save", () => {
    const tracker = new PuzzleTracker([{ id: "p", kind: "plates", members: ["a"], setsFlag: "f" }], ["p"]);
    expect(tracker.isSolved("p")).toBe(true);
    expect(tracker.update(0)).toEqual([]);
  });
});

describe("save data", () => {
  it("round-trips and rejects junk", () => {
    const save = { ...newSave(), xp: 55, flags: ["metElder"] };
    expect(parseSave(JSON.stringify(save))).toEqual(save);
    expect(parseSave("not json")).toBeNull();
    expect(parseSave(JSON.stringify({ version: 2 }))).toBeNull();
    expect(parseSave(JSON.stringify({ ...save, flags: ["ok", 3], xp: -4 }))?.flags).toEqual(["ok"]);
  });
});
