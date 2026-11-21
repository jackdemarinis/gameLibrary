// The library's catalogue. Add a game here and it appears on the home menu,
// numbered in this order.

export interface GameEntry {
  id: string;
  title: string;
  genre: string;
  tagline: string;
  description: string;
  href: string;
  art: string;
  // CSS background-position for the key art, so the subject stays clear of the menu.
  artFocus: string;
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
    artFocus: "60% 40%",
    badges: ["Online", "3D"],
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
    artFocus: "100% 50%",
    badges: ["Campaign"],
    players: "1 player",
    controls: "WASD · Mouse",
  },
  {
    id: "lanternwake",
    title: "Lanternwake",
    genre: "Adventure",
    tagline: "Forge the lantern before dawn.",
    description:
      "Gather timber and ironstone, forge the Ember Lantern, drive back the shades and still the Mirewarden in four short chapters.",
    href: "./lanternwake/",
    art: "./library/lanternwake.jpg",
    artFocus: "50% 50%",
    badges: ["Pixel art"],
    players: "1 player",
    controls: "WASD · Space · E",
  },
];
