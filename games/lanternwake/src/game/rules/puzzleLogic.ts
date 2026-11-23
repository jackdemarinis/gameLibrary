// Puzzle bookkeeping: pressure plates and timed braziers. Pure and unit-tested.
// A puzzle latches once solved, so the gate it opens never closes again.

export type PuzzleKind = "plates" | "braziers";

export interface PuzzleDef {
  id: string;
  kind: PuzzleKind;
  /** Plate or brazier ids that must all be active together. */
  members: string[];
  /** Flag set when solved (gates and chests listen for it). */
  setsFlag: string;
  /** Braziers only: seconds a lit brazier burns before going out (unless solved). */
  burnSeconds?: number;
}

export interface PuzzleEvent {
  type: "solved" | "memberOut";
  puzzleId: string;
  memberId?: string;
  flag?: string;
}

export class PuzzleTracker {
  private readonly defs: PuzzleDef[];
  private readonly active = new Map<string, number>();
  private readonly solved = new Set<string>();

  constructor(defs: PuzzleDef[], alreadySolved: Iterable<string> = []) {
    this.defs = defs;
    for (const id of alreadySolved) this.solved.add(id);
  }

  isSolved(puzzleId: string): boolean {
    return this.solved.has(puzzleId);
  }

  isActive(memberId: string): boolean {
    return this.active.has(memberId) || this.defs.some((def) => this.solved.has(def.id) && def.members.includes(memberId));
  }

  /** Plates: active while something heavy rests on them. Braziers: active once lit. */
  setActive(memberId: string, isActive: boolean, now: number): void {
    if (isActive) {
      if (!this.active.has(memberId)) this.active.set(memberId, now);
    } else {
      this.active.delete(memberId);
    }
  }

  /** Call every frame; returns what happened (solves, braziers burning out). */
  update(now: number): PuzzleEvent[] {
    const events: PuzzleEvent[] = [];
    for (const def of this.defs) {
      if (this.solved.has(def.id)) continue;
      if (def.members.every((member) => this.active.has(member))) {
        this.solved.add(def.id);
        events.push({ type: "solved", puzzleId: def.id, flag: def.setsFlag });
        continue;
      }
      if (def.kind === "braziers" && def.burnSeconds !== undefined) {
        for (const member of def.members) {
          const litAt = this.active.get(member);
          if (litAt !== undefined && now - litAt >= def.burnSeconds) {
            this.active.delete(member);
            events.push({ type: "memberOut", puzzleId: def.id, memberId: member });
          }
        }
      }
    }
    return events;
  }

  /** Seconds left before a lit brazier goes out, or null when unlit or solved. */
  burnLeft(memberId: string, now: number): number | null {
    const def = this.defs.find((candidate) => candidate.members.includes(memberId));
    const litAt = this.active.get(memberId);
    if (!def || litAt === undefined || this.solved.has(def.id) || def.burnSeconds === undefined) return null;
    return Math.max(0, def.burnSeconds - (now - litAt));
  }
}
