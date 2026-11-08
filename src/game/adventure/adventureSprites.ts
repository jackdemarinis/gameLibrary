// Original pixel-art sprites for Lanternwake, as character maps. '.' is transparent;
// every other character is looked up in the sprite's palette (colors from adventureTheme).
import { adventureTheme as t } from "../config/adventureTheme";

export interface PixelSprite {
  key: string;
  /** Screen pixels per art pixel. */
  scale: number;
  rows: readonly string[];
  palette: Readonly<Record<string, number>>;
}

const playerRows = [
  "...hhhhh....",
  "..hhhhhhh.x.",
  "..hhsssssxyx",
  "..hssesse.x.",
  "..hsssss..w.",
  "...ssss...w.",
  "..tttttt..w.",
  ".ttTtttttsw.",
  ".stTtttt..w.",
  ".s.tttt...w.",
  "...bbbb...w.",
  "...pppp...w.",
  "...pp.pp..w.",
  "...pp.pp..w.",
  "..BBB.BBB.w.",
  "..BB...BB...",
];

const playerPalette = {
  h: t.hair,
  s: t.skin,
  e: t.eye,
  t: t.tunic,
  T: t.tunicDark,
  b: t.belt,
  p: t.pants,
  B: t.boots,
  w: t.staffWood,
};

export const playerDimSprite: PixelSprite = {
  key: "lwPlayerDim",
  scale: 3,
  rows: playerRows,
  palette: { ...playerPalette, x: t.staffKnot, y: t.staffWood },
};

export const playerLitSprite: PixelSprite = {
  key: "lwPlayerLit",
  scale: 3,
  rows: playerRows,
  palette: { ...playerPalette, x: t.lanternBody, y: t.lanternCore },
};

export const shadeSprite: PixelSprite = {
  key: "lwShade",
  scale: 3,
  rows: [
    "....oooooo....",
    "...oBBBBBBo...",
    "..oBBBBBBBBo..",
    "..oBeBBBBeBo..",
    "..oBeeBBeeBo..",
    "..oBBBBBBBBo..",
    "..oBBBmmBBBo..",
    "..oBBBBBBBBo..",
    "..oBBBBBBBBo..",
    "..oBoBBoBBoo..",
    "..o.oBo.oBo...",
    "....o.o..o....",
  ],
  palette: { o: t.shadeOutline, B: t.shadeBody, e: t.shadeEye, m: t.shadeMouth },
};

export const bossSprite: PixelSprite = {
  key: "lwBoss",
  scale: 4,
  rows: [
    ".......gggggggg.......",
    ".....ggMMMMMMMMgg.....",
    "....gMMMMMMMMMMMMg....",
    "...gMMMMwwwwwwMMMMg...",
    "..gMMMMwwwwwwwwMMMMg..",
    "..gMMMwwwwrrwwwwMMMg..",
    ".gMMMMwwwrRRrwwwMMMMg.",
    ".gMMMMwwwrRRrwwwMMMMg.",
    ".gMMMMMwwwrrwwwMMMMMg.",
    ".gMMMMMMwwwwwwMMMMMMg.",
    ".gMMvMMMMMMMMMMMMvMMg.",
    ".gMMMMMMMtttttMMMMMMg.",
    "..gMMMMMtTtTtTtMMMMg..",
    "..gMMMMMMMMMMMMMMMMg..",
    ".ggMMvMMMMMMMMMMvMMgg.",
    "gMMgMMMMMMMMMMMMMMgMMg",
    "gMg.gMMMgMMMMgMMMg.gMg",
    ".g...gMg.gMMg.gMg...g.",
    "......g...gg...g......",
  ],
  palette: {
    g: t.bossOutline,
    M: t.bossBody,
    w: t.bossEyeWhite,
    r: t.bossIris,
    R: t.bossPupil,
    v: t.bossMoss,
    t: t.bossMouth,
    T: t.bossTeeth,
  },
};

export const treeSprite: PixelSprite = {
  key: "lwTree",
  scale: 3,
  rows: [
    ".....GGGGGG.....",
    "...GGgghhggGG...",
    "..GgghhhhhgggG..",
    ".GggghhhggggggG.",
    ".GgghgggggggggG.",
    "GggggggggGgggggG",
    "GgggggggggggggGG",
    "GggGgggggggGgggG",
    ".GgggggggggggggG",
    ".GGgggggGgggggG.",
    "..GGgggggggggG..",
    "....GGGgGGGG....",
    "......kKk.......",
    "......kKk.......",
    "......kKk.......",
    ".....kkKkk......",
    "....kk.K.kk.....",
  ],
  palette: { G: t.leafDark, g: t.leafMid, h: t.leafLight, k: t.trunkDark, K: t.trunkLight },
};

export const rockSprite: PixelSprite = {
  key: "lwRock",
  scale: 3,
  rows: [
    "....SSSSS.....",
    "..SSlllssSS...",
    ".SlllosssssS..",
    ".SllOossssssS.",
    "SsssssssssoOsS",
    "SsssSssssoossS",
    "SssssssOsssssS",
    ".SsoOssssssSS.",
    ".SSsosssssSS..",
    "...SSSSSSSS...",
  ],
  palette: { S: t.stoneDark, s: t.stoneMid, l: t.stoneLight, o: t.oreFleck, O: t.oreShine },
};

export const workbenchSprite: PixelSprite = {
  key: "lwWorkbench",
  scale: 4,
  rows: [
    ".....aaaaa......",
    "....aAAAAAa.....",
    "......aaa.......",
    "LLLLLLLLLLLLLLLL",
    "llllllllllllllll",
    ".dd..........dd.",
    ".dd..........dd.",
    ".dd..........dd.",
    ".DD..........DD.",
  ],
  palette: { a: t.anvilDark, A: t.anvilLight, L: t.benchWoodLight, l: t.benchWoodMid, d: t.benchWoodMid, D: t.benchWoodDark },
};

export const torchSprite: PixelSprite = {
  key: "lwTorch",
  scale: 3,
  rows: [".f.", "fcf", ".f.", ".w.", ".w.", ".w.", ".W."],
  palette: { f: t.torchFlame, c: t.torchCore, w: t.trunkLight, W: t.trunkDark },
};

export const tuftSprite: PixelSprite = {
  key: "lwTuft",
  scale: 3,
  rows: ["g...g", ".g.g.", "gGgGg"],
  palette: { g: t.grassLight, G: t.grassDark },
};

export const flowerSprite: PixelSprite = {
  key: "lwFlower",
  scale: 3,
  rows: [".r.", "rcr", ".g.", ".g."],
  palette: { r: t.flowerRose, c: t.flowerGold, g: t.grassDark },
};

export const adventureSprites: readonly PixelSprite[] = [
  playerDimSprite,
  playerLitSprite,
  shadeSprite,
  bossSprite,
  treeSprite,
  rockSprite,
  workbenchSprite,
  torchSprite,
  tuftSprite,
  flowerSprite,
];

/** Deterministic 0..1 hash for procedural tiles and decor placement (no Math.random). */
export function pixelHash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
