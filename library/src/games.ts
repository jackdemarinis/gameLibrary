// The JackGames catalogue. Add a game here and it appears on the home page.
// The first game is the featured one.

export type CategoryId = "sports" | "arcade" | "adventure" | "multiplayer";

export interface Category {
  id: CategoryId;
  label: string;
  // Short pitch for the "pick by mood" cards.
  pitch: string;
}

export const categories: Category[] = [
  { id: "multiplayer", label: "With Friends", pitch: "Play together online" },
  { id: "sports", label: "Sports", pitch: "Aim, time it, score" },
  { id: "arcade", label: "Arcade", pitch: "Fast rounds, upgrades" },
  { id: "adventure", label: "Adventure", pitch: "Explore and craft" },
];

export interface GameEntry {
  id: string;
  title: string;
  genre: string;
  tagline: string;
  description: string;
  href: string;
  art: string;
  // CSS background-position for the cover, so the subject stays in frame.
  artFocus: string;
  categories: CategoryId[];
  badges: string[];
  players: string;
  controls: string;
}

export const games: GameEntry[] = [
  {
    id: "petanque",
    title: "Pétanque Park",
    genre: "Sports",
    tagline: "Toss it close. Knock 'em away.",
    description:
      "Sunny-park boules with golf-style swing timing. Play the CPU on one PC, or host a room and send friends a four-letter code.",
    href: "./petanque/",
    art: "./library/petanque.jpg",
    artFocus: "50% 78%",
    categories: ["sports", "multiplayer"],
    badges: ["New", "Online"],
    players: "1–4 players",
    controls: "Mouse · Space",
  },
  {
    id: "dustline",
    title: "Dustline Brigade",
    genre: "Arcade",
    tagline: "Hold the line. Upgrade the tank.",
    description:
      "A top-down tank campaign across scorched frontier levels. Earn credits, unlock weapons and climb the difficulty ladder.",
    href: "./dustline/",
    art: "./library/dustline.jpg",
    artFocus: "40% 55%",
    categories: ["arcade"],
    badges: ["Campaign"],
    players: "1 player",
    controls: "WASD · Mouse",
  },
  {
    id: "lanternwake",
    title: "Lanternwake",
    genre: "Adventure",
    tagline: "Carry the last flame into the dark.",
    description:
      "A retro 3D action adventure: swordplay, physics puzzles and bosses through fog-bound villages, haunted woods and drowned shrines, lit only by your lantern.",
    href: "./lanternwake/",
    art: "./library/lanternwake.jpg",
    artFocus: "50% 62%",
    categories: ["adventure"],
    badges: ["3D", "Retro"],
    players: "1 player",
    controls: "WASD · Mouse · Gamepad",
  },
];
