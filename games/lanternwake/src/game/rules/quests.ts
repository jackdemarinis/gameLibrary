// Quest journal for the pause menu: completed missions, the current mission with a
// hint, and side quests counted from the area content (way-lanterns, chests).
import type { AreaDef } from "../content/areaTypes";
import { chapterComplete, mainQuest } from "../content/mainQuest";

export interface MissionEntry {
  number: number;
  title: string;
  where: string;
  text: string;
  hint?: string;
}

export interface SideQuest {
  title: string;
  detail: string;
  done: number;
  total: number;
  /** Where the unfinished parts are, e.g. "1 left in The Gloamwood". */
  remaining: string[];
}

export interface QuestLog {
  current: MissionEntry | null;
  /** Newest first. */
  completed: MissionEntry[];
  /** Missions not yet revealed. */
  hiddenCount: number;
  nextStep: string;
  side: SideQuest[];
}

export function currentObjective(flags: ReadonlySet<string>): string {
  return mainQuest.find((step) => !flags.has(step.flag))?.objective ?? chapterComplete;
}

function sideQuest(title: string, detail: string, areaList: AreaDef[], kind: string, doneFlag: (id: string) => string, flags: ReadonlySet<string>): SideQuest {
  let done = 0;
  let total = 0;
  const remaining: string[] = [];
  for (const area of areaList) {
    const ids = area.props.filter((prop) => prop.kind === kind && prop.id).map((prop) => prop.id!);
    const left = ids.filter((id) => !flags.has(doneFlag(id))).length;
    total += ids.length;
    done += ids.length - left;
    if (left > 0) remaining.push(`${left} left in ${area.name}`);
  }
  return { title, detail, done, total, remaining };
}

export function questLog(flags: ReadonlySet<string>, areaList: AreaDef[]): QuestLog {
  const completed: MissionEntry[] = [];
  let current: MissionEntry | null = null;
  let hiddenCount = 0;
  mainQuest.forEach((step, index) => {
    const entry = { number: index + 1, title: step.title, where: step.where };
    if (flags.has(step.flag)) completed.unshift({ ...entry, text: step.doneText });
    else if (!current) current = { ...entry, text: step.objective, hint: step.hint };
    else hiddenCount += 1;
  });
  return {
    current,
    completed,
    hiddenCount,
    nextStep: currentObjective(flags),
    side: [
      sideQuest("Keeper's Rounds", "Kindle every way-lantern. Resting at a lit lantern heals you and saves your game.", areaList, "wayLantern", (id) => `lit:${id}`, flags),
      sideQuest("Hidden Things", "Find and open every chest. Some hold heart vessels.", areaList, "chest", (id) => `opened:${id}`, flags),
    ],
  };
}
