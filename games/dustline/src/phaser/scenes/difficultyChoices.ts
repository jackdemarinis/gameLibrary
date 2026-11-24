/** The three campaign difficulties, picked once on the level screen before the first mission. */
export const difficultyChoices = [
  {
    key: "rookie" as const,
    label: "Easy",
    stars: "*",
    caption: "Softer enemy armor and safer fights.",
  },
  {
    key: "normal" as const,
    label: "Medium",
    stars: "**",
    caption: "Balanced campaign pressure.",
  },
  {
    key: "ace" as const,
    label: "Hard",
    stars: "***",
    caption: "Harder hits, tougher clears.",
  },
];

export function getDifficultyLabel(value: "rookie" | "normal" | "ace"): string {
  switch (value) {
    case "rookie":
      return "Easy";
    case "ace":
      return "Hard";
    case "normal":
    default:
      return "Medium";
  }
}
