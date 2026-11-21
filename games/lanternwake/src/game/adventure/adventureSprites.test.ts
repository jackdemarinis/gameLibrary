import { describe, expect, it } from "vitest";
import { adventureSprites, pixelHash } from "./adventureSprites";

describe("Lanternwake sprites", () => {
  it.each(adventureSprites.map((sprite) => [sprite.key, sprite] as const))("%s is a rectangular map with every color defined", (_key, sprite) => {
    const width = sprite.rows[0].length;
    for (const row of sprite.rows) {
      expect(row).toHaveLength(width);
      for (const char of row) {
        if (char !== ".") {
          expect(sprite.palette[char], `missing palette entry "${char}"`).toBeTypeOf("number");
        }
      }
    }
  });

  it("uses unique texture keys", () => {
    const keys = adventureSprites.map((sprite) => sprite.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("hashes deterministically into [0, 1)", () => {
    expect(pixelHash(3, 7, 1)).toBe(pixelHash(3, 7, 1));
    for (let i = 0; i < 200; i += 1) {
      const value = pixelHash(i, i * 3, 5);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
