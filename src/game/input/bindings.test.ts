import { describe, expect, it } from "vitest";
import { inputActions } from "./actions";
import { keyboardBindings } from "./bindings";

describe("input bindings", () => {
  it("defines a binding entry for every declared action", () => {
    expect(Object.keys(keyboardBindings).sort()).toEqual([...inputActions].sort());
  });

  it("keeps movement and combat actions mapped to practical defaults", () => {
    expect(keyboardBindings["move-up"]).toContain("W");
    expect(keyboardBindings["move-right"]).toContain("D");
    expect(keyboardBindings.fire).toContain("POINTER_LEFT");
    expect(keyboardBindings.pause).toContain("ESC");
  });
});
