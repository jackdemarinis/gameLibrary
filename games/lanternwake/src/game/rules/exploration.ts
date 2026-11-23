// Fog-of-war for the map: a bit grid per area that fills in around the hero.
// Pure logic (no DOM) so it is unit-tested; storage wrappers live at the bottom.

/** Metres per map cell. */
export const exploreCell = 2;
/** How far around the hero the map reveals, in metres. */
export const revealRadius = 13;

export class ExploreGrid {
  readonly cells: number;
  readonly size: number;
  readonly bits: Uint8Array;

  constructor(size: number, encoded?: string) {
    this.size = size;
    this.cells = Math.ceil(size / exploreCell);
    this.bits = new Uint8Array(Math.ceil((this.cells * this.cells) / 8));
    if (encoded) this.decode(encoded);
  }

  private index(cellX: number, cellZ: number): number {
    return cellZ * this.cells + cellX;
  }

  isRevealed(cellX: number, cellZ: number): boolean {
    if (cellX < 0 || cellZ < 0 || cellX >= this.cells || cellZ >= this.cells) return false;
    const index = this.index(cellX, cellZ);
    return (this.bits[index >> 3] & (1 << (index & 7))) !== 0;
  }

  /** World position -> cell. The area spans -size/2..size/2 on both axes. */
  cellOf(x: number, z: number): { cellX: number; cellZ: number } {
    return { cellX: Math.floor((x + this.size / 2) / exploreCell), cellZ: Math.floor((z + this.size / 2) / exploreCell) };
  }

  /** Reveal a disc around (x, z). Returns true if anything new was revealed. */
  reveal(x: number, z: number, radius = revealRadius): boolean {
    const { cellX, cellZ } = this.cellOf(x, z);
    const span = Math.ceil(radius / exploreCell);
    let changed = false;
    for (let dz = -span; dz <= span; dz += 1) {
      for (let dx = -span; dx <= span; dx += 1) {
        const cx = cellX + dx;
        const cz = cellZ + dz;
        if (cx < 0 || cz < 0 || cx >= this.cells || cz >= this.cells) continue;
        if (Math.hypot(dx, dz) * exploreCell > radius) continue;
        const index = this.index(cx, cz);
        const mask = 1 << (index & 7);
        if (!(this.bits[index >> 3] & mask)) {
          this.bits[index >> 3] |= mask;
          changed = true;
        }
      }
    }
    return changed;
  }

  /** 0..1 share of cells revealed. */
  fraction(): number {
    let count = 0;
    for (let index = 0; index < this.cells * this.cells; index += 1) if (this.bits[index >> 3] & (1 << (index & 7))) count += 1;
    return count / (this.cells * this.cells);
  }

  encode(): string {
    let binary = "";
    for (const byte of this.bits) binary += String.fromCharCode(byte);
    return btoa(binary);
  }

  private decode(encoded: string): void {
    try {
      const binary = atob(encoded);
      for (let index = 0; index < Math.min(binary.length, this.bits.length); index += 1) this.bits[index] = binary.charCodeAt(index);
    } catch {
      // Corrupt: start this area's map fresh.
    }
  }
}

export const exploreKey = "lanternwake3d.map.v1";

export function loadExplored(): Record<string, string> {
  try {
    const value = JSON.parse(window.localStorage.getItem(exploreKey) ?? "{}") as unknown;
    if (!value || typeof value !== "object") return {};
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  } catch {
    return {};
  }
}

export function writeExplored(explored: Record<string, string>): void {
  try {
    window.localStorage.setItem(exploreKey, JSON.stringify(explored));
  } catch {
    // Storage refused: the map just won't persist this visit.
  }
}

export function clearExplored(): void {
  try {
    window.localStorage.removeItem(exploreKey);
  } catch {
    // ignore
  }
}
