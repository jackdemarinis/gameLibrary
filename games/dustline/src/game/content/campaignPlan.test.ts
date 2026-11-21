import { describe, expect, it } from "vitest";
import { foundationFeatureCards, roadmap } from "./campaignPlan";

describe("campaign plan", () => {
  it("covers prompt 0 through prompt 8 in order", () => {
    expect(roadmap.map((entry) => entry.prompt)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("marks prompt 1 live and prompt 2 next", () => {
    expect(roadmap[0]?.status).toBe("later");
    expect(roadmap[1]?.status).toBe("live");
    expect(roadmap[2]?.status).toBe("next");
    expect(roadmap.slice(3).every((entry) => entry.status === "later")).toBe(true);
  });

  it("captures the player-facing MVP features", () => {
    expect(foundationFeatureCards).toHaveLength(3);
    expect(foundationFeatureCards.map((card) => card.title)).toEqual([
      "WASD Drive",
      "Break Open Cover",
      "Hidden Cache",
    ]);
  });
});
