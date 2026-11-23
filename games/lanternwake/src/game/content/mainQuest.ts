// Chapter One's main quest, in order. Each mission is done once its flag is set.
// The HUD objective and the pause-menu Quests journal both read this list.

export interface QuestStep {
  flag: string;
  title: string;
  /** Where the mission takes place (an area name). */
  where: string;
  /** What to do next, shown while this is the current mission. */
  objective: string;
  /** A nudge for players who are stuck. */
  hint: string;
  /** Journal recap shown once the mission is done. */
  doneText: string;
}

export const chapterTitle = "Chapter One · The Dark Shrine";

export const mainQuest: QuestStep[] = [
  {
    flag: "elderBlessing",
    title: "The Elder's Summons",
    where: "Wickmoor",
    objective: "Speak with Elder Maren by the village well.",
    hint: "The well is in the middle of the village, where the cobbled roads meet. Walk up to Maren and press your interact key.",
    doneText:
      "Elder Maren told you the great lantern in the Sunken Shrine went dark at dusk, and that shades now walk the roads. She gave you her blessing, and the east gate opened for you.",
  },
  {
    flag: "plateSolved",
    title: "The Barred Gate",
    where: "The Gloamwood",
    objective: "Take the east road into the Gloamwood and find a way past the barred gate.",
    hint: "A ward-plate in the clearing is linked to the gate. It's too light to hold down by standing on it, so push a crate or barrel onto it.",
    doneText: "Deep in the Gloamwood, you pushed something heavy onto the old ward-plate, and the barred gate ground open.",
  },
  {
    flag: "braziersLit",
    title: "Three Fires",
    where: "The Gloamwood",
    objective: "Light all three braziers with a lantern flare before they gutter out.",
    hint: "Each flare only keeps a brazier burning for a short while. Plan a route that passes all three, sprint between them, and keep an eye on your oil.",
    doneText: "You lit all three braziers in time. Their fire opened the sealed way to the Sunken Shrine.",
  },
  {
    flag: "bossDefeated",
    title: "The Great Lantern",
    where: "The Sunken Shrine",
    objective: "Enter the Sunken Shrine and relight its great lantern.",
    hint: "The Warden guards the great lantern. Flare it from close range to expose its core, strike while it reels, and jump over its shockwave rings.",
    doneText: "You beat the Warden beneath the shrine and relit the great lantern. Light has returned to the roads.",
  },
];

export const chapterComplete = "The shrine burns bright again. Chapter One complete.";
