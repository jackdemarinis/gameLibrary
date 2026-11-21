// Original Pétanque Park cast: ten players, built from primitives and painted
// faces in view/characterModel.ts. Proportions are late-2000s sports-party:
// grown-up bodies, slightly big heads, chunky hair, real clothes.

export type HairStyle = "spiky" | "swept" | "bob" | "ponytail" | "buzz" | "afro" | "bun" | "pixie" | "bald" | "curly";
export type TopStyle = "tee" | "polo" | "tank" | "jersey" | "breton" | "cardigan";
export type BottomStyle = "shorts" | "trousers" | "skirt";
export type Headwear = "none" | "headband" | "cap" | "flatCap" | "bandana";
export type FacialHair = "none" | "stubble" | "mustache" | "beard";

export interface CharacterDefinition {
  id: string;
  name: string;
  // One line for the character select screen.
  tagline: string;
  skin: number;
  eyes: number;
  hair: number;
  hairStyle: HairStyle;
  facialHair: FacialHair;
  freckles: boolean;
  glasses: boolean;
  elder: boolean;
  top: { style: TopStyle; color: number; trim: number };
  bottom: { style: BottomStyle; color: number };
  shoes: { color: number; accent: number };
  headwear: Headwear;
  headwearColor: number;
  // Body proportions: 1 = average.
  height: number;
  build: number;
}

export const characters: readonly CharacterDefinition[] = [
  {
    id: "rafa", name: "Rafa", tagline: "Never misses a short point.",
    skin: 0xd6a27a, eyes: 0x4a2e1c, hair: 0x231710, hairStyle: "curly", facialHair: "stubble", freckles: false, glasses: false, elder: false,
    top: { style: "polo", color: 0xf2f0e8, trim: 0x1f3a68 }, bottom: { style: "shorts", color: 0xb59b6e }, shoes: { color: 0xf4f4f4, accent: 0x1f3a68 },
    headwear: "none", headwearColor: 0, height: 1.0, build: 1.0,
  },
  {
    id: "mina", name: "Mina", tagline: "Fast hands, faster trash talk.",
    skin: 0xf3d4bd, eyes: 0x2a1c14, hair: 0x15120f, hairStyle: "bob", facialHair: "none", freckles: false, glasses: false, elder: false,
    top: { style: "tank", color: 0xff6f5e, trim: 0xffffff }, bottom: { style: "shorts", color: 0x4d6f9e }, shoes: { color: 0xffffff, accent: 0xff6f5e },
    headwear: "headband", headwearColor: 0xffffff, height: 0.93, build: 0.9,
  },
  {
    id: "dex", name: "Dex", tagline: "Calculates every angle.",
    skin: 0x6e452e, eyes: 0x1d120b, hair: 0x120d0a, hairStyle: "buzz", facialHair: "none", freckles: false, glasses: true, elder: false,
    top: { style: "tee", color: 0xf08a2c, trim: 0x2a2a2a }, bottom: { style: "trousers", color: 0x5a5f66 }, shoes: { color: 0x2b2b2b, accent: 0xf08a2c },
    headwear: "none", headwearColor: 0, height: 1.04, build: 1.0,
  },
  {
    id: "sol", name: "Sol", tagline: "Loves a big lob.",
    skin: 0xf6d9c4, eyes: 0x3c6e47, hair: 0xa4421c, hairStyle: "ponytail", facialHair: "none", freckles: true, glasses: false, elder: false,
    top: { style: "jersey", color: 0x1e9c95, trim: 0xffffff }, bottom: { style: "shorts", color: 0x22262b }, shoes: { color: 0x1e9c95, accent: 0xffffff },
    headwear: "none", headwearColor: 0, height: 0.97, build: 0.92,
  },
  {
    id: "gus", name: "Big Gus", tagline: "Shoots first, asks never.",
    skin: 0xe0b089, eyes: 0x3b2a1e, hair: 0x5b4636, hairStyle: "bald", facialHair: "mustache", freckles: false, glasses: false, elder: false,
    top: { style: "breton", color: 0xf7f5ef, trim: 0x22305a }, bottom: { style: "trousers", color: 0x6b4f38 }, shoes: { color: 0x4a3426, accent: 0x2a1d14 },
    headwear: "flatCap", headwearColor: 0x40454d, height: 1.02, build: 1.25,
  },
  {
    id: "pia", name: "Nana Pia", tagline: "Fifty years at the terrain.",
    skin: 0xeec7a8, eyes: 0x5a6e7e, hair: 0xd9d6d0, hairStyle: "bun", facialHair: "none", freckles: false, glasses: true, elder: true,
    top: { style: "cardigan", color: 0x9a86c4, trim: 0xf1eadc }, bottom: { style: "skirt", color: 0x3e4a63 }, shoes: { color: 0x5c4434, accent: 0x3a2a20 },
    headwear: "none", headwearColor: 0, height: 0.88, build: 1.0,
  },
  {
    id: "tomo", name: "Tomo", tagline: "All style, surprising touch.",
    skin: 0xf1cfae, eyes: 0x241811, hair: 0x2f6fd6, hairStyle: "swept", facialHair: "none", freckles: false, glasses: false, elder: false,
    top: { style: "tee", color: 0x26282c, trim: 0xb6f03c }, bottom: { style: "shorts", color: 0x6f7650 }, shoes: { color: 0xb6f03c, accent: 0x26282c },
    headwear: "none", headwearColor: 0, height: 0.98, build: 0.92,
  },
  {
    id: "zuri", name: "Zuri", tagline: "Reads the gravel like a book.",
    skin: 0x5a3622, eyes: 0x1a0f09, hair: 0x18110c, hairStyle: "afro", facialHair: "none", freckles: false, glasses: false, elder: false,
    top: { style: "tank", color: 0xf3c63a, trim: 0x23412f }, bottom: { style: "shorts", color: 0xf1efe9 }, shoes: { color: 0xffffff, accent: 0x23412f },
    headwear: "none", headwearColor: 0, height: 1.0, build: 0.95,
  },
  {
    id: "lars", name: "Lars", tagline: "Tall, patient, deadly.",
    skin: 0xf4d2bb, eyes: 0x5d86b0, hair: 0xd9b35c, hairStyle: "swept", facialHair: "beard", freckles: false, glasses: false, elder: false,
    top: { style: "polo", color: 0x3d7a4a, trim: 0xf4f1e6 }, bottom: { style: "trousers", color: 0xe9e3d3 }, shoes: { color: 0x7a5636, accent: 0x4a3322 },
    headwear: "none", headwearColor: 0, height: 1.1, build: 1.08,
  },
  {
    id: "paz", name: "Paz", tagline: "Plays loud, wins louder.",
    skin: 0xc58c64, eyes: 0x2c1a10, hair: 0xe86aa6, hairStyle: "pixie", facialHair: "none", freckles: false, glasses: false, elder: false,
    top: { style: "jersey", color: 0x6b3fa6, trim: 0xf3c63a }, bottom: { style: "skirt", color: 0x2a2a33 }, shoes: { color: 0xffffff, accent: 0x6b3fa6 },
    headwear: "bandana", headwearColor: 0xf3c63a, height: 0.94, build: 0.95,
  },
];

export function getCharacter(id: string): CharacterDefinition {
  return characters.find((character) => character.id === id) ?? characters[0];
}

export const teamNames = ["Poppies", "Cornflowers"] as const;
