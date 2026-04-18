import { describe, expect, it } from "vitest";
import { createSaveStore } from "./saveStore";

class MemoryStorage implements Storage {
  private readonly state = new Map<string, string>();

  get length(): number {
    return this.state.size;
  }

  clear(): void {
    this.state.clear();
  }

  getItem(key: string): string | null {
    return this.state.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.state.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.state.delete(key);
  }

  setItem(key: string, value: string): void {
    this.state.set(key, value);
  }
}

describe("save store", () => {
  it("creates and persists the initial prompt 0 save", () => {
    const storage = new MemoryStorage();
    const store = createSaveStore(storage);
    const save = store.loadOrCreate();

    expect(save.currentLevelId).toBe("training-yard");
    expect(save.completedPrompts).toEqual([0]);
    expect(store.load()).toEqual(save);
  });

  it("ignores malformed stored data", () => {
    const storage = new MemoryStorage();
    storage.setItem("dustline-brigade/save", JSON.stringify({ bad: true }));

    const store = createSaveStore(storage);

    expect(store.load()).toBeNull();
  });

  it("clears the saved profile cleanly", () => {
    const storage = new MemoryStorage();
    const store = createSaveStore(storage);

    store.loadOrCreate();
    store.clear();

    expect(store.load()).toBeNull();
  });
});
