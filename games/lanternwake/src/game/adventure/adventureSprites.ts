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

const roofRows = (chimney: boolean): string[] => [
  chimney ? "..................CC............" : "................................",
  chimney ? ".................CCCC..........." : "................................",
  chimney ? ".................CccC..........." : "................................",
  chimney ? "........oooooooooCccCooo........" : "........oooooooooooooooo........",
  chimney ? ".......oHHHHHHHHHCccCHHHo......." : ".......oHHHHHHHHHHHHHHHHo.......",
  "......oRRRRRRRRRRRRRRRRRRo......",
  ".....oRRrRRRrRRRrRRRrRRRRRo.....",
  "....oRRRRRRRRRRRRRRRRRRRRRRo....",
  "...oRrRRRrRRRrRRRrRRRrRRRrRRo...",
  "..oRRRRRRRRRRRRRRRRRRRRRRRRRRo..",
  ".oRRrRRRrRRRrRRRrRRRrRRRrRRRRRo.",
  "orrrrrrrrrrrrrrrrrrrrrrrrrrrrrro",
];

const cottageWallRows = [
  ".oWWWWWWWWWWWWWWWWWWWWWWWWWWWWo.",
  ".oWggggWWWWWWTTTTTTWWWWWWggggWo.",
  ".oWgGGgWWWWWTDDDDDDTWWWWWgGGgWo.",
  ".oWgGGgWWWWWTDDdDDDTWWWWWgGGgWo.",
  ".oWggggWWWWWTDDdDDDTWWWWWggggWo.",
  ".oSSSSSSSSSSTDDdDDkTSSSSSSSSSSo.",
  ".oSsSSSsSSSSTDDdDDDTSSSsSSSsSSo.",
  ".oSSSSSSSSSSTDDdDDDTSSSSSSSSSSo.",
  ".ossssssssssTDDdDDDTsssssssssso.",
  "..ooooooooooppppppppoooooooooo..",
];

const cottageBasePalette = {
  o: t.roofOutline,
  C: t.chimney,
  c: t.chimneyDark,
  W: t.plaster,
  g: t.windowFrame,
  G: t.windowGlass,
  T: t.benchWoodDark,
  D: t.benchWoodMid,
  d: t.benchWoodDark,
  k: t.torchFlame,
  S: t.stoneMid,
  s: t.stoneDark,
  p: t.cobbleMid,
};

export const cottageRedSprite: PixelSprite = {
  key: "lwCottageRed",
  scale: 4,
  rows: [...roofRows(true), ...cottageWallRows],
  palette: { ...cottageBasePalette, H: t.roofRedLight, R: t.roofRed, r: t.roofRedDark },
};

export const cottageBlueSprite: PixelSprite = {
  key: "lwCottageBlue",
  scale: 4,
  rows: [...roofRows(false), ...cottageWallRows],
  palette: { ...cottageBasePalette, H: t.roofBlueLight, R: t.roofBlue, r: t.roofBlueDark },
};

export const wellSprite: PixelSprite = {
  key: "lwWell",
  scale: 3,
  rows: [
    "..wwwwwwww..",
    ".wWWWWWWWWw.",
    "..w......w..",
    "..w..rr..w..",
    "..w..bb..w..",
    ".SSSSSSSSSS.",
    "SsddddddddsS",
    "SsSSSSSSSSsS",
    "SSsSSSSSsSSS",
    "SsSSSsSSSSsS",
    ".SSSSSSSSSS.",
  ],
  palette: { w: t.benchWoodDark, W: t.benchWoodLight, r: t.dirtLight, b: t.benchWoodMid, S: t.stoneMid, s: t.stoneDark, d: t.waterDark },
};

export const fenceSprite: PixelSprite = {
  key: "lwFence",
  scale: 3,
  rows: [
    ".pp......pp.....",
    ".PP......PP.....",
    "rrrrrrrrrrrrrrrr",
    ".PP......PP.....",
    ".PP......PP.....",
    "rrrrrrrrrrrrrrrr",
    ".PP......PP.....",
    ".kk......kk.....",
  ],
  palette: { p: t.benchWoodLight, P: t.benchWoodMid, r: t.trunkLight, k: t.benchWoodDark },
};

export const crateSprite: PixelSprite = {
  key: "lwCrate",
  scale: 3,
  rows: [
    "oooooooooo",
    "oLLLLLLLLo",
    "oLlLLLLlLo",
    "oLLlLLlLLo",
    "oLLLllLLLo",
    "oLLLllLLLo",
    "oLLlLLlLLo",
    "oLlLLLLlLo",
    "oLLLLLLLLo",
    "oooooooooo",
  ],
  palette: { o: t.benchWoodDark, L: t.benchWoodMid, l: t.benchWoodLight },
};

export const barrelSprite: PixelSprite = {
  key: "lwBarrel",
  scale: 3,
  rows: [
    ".ooooooo.",
    "oMMMMMMMo",
    "oaaaaaaao",
    "oMMlMMMMo",
    "oMMlMMMMo",
    "oMMlMMMMo",
    "oaaaaaaao",
    "oMMlMMMMo",
    "oMMMMMMMo",
    ".ooooooo.",
  ],
  palette: { o: t.benchWoodDark, M: t.benchWoodMid, l: t.benchWoodLight, a: t.anvilDark },
};

const bushRows = [
  "....GGGGG.....",
  "..GGgggggGG...",
  ".GgghhgggggG..",
  "GgghhgggggggG.",
  "GggggggggggggG",
  "GgggggGgggggGG",
  ".GgggggggggggG",
  "..GGgggggggGG.",
  "....GGGGGGG...",
];

export const bushSprite: PixelSprite = {
  key: "lwBush",
  scale: 3,
  rows: bushRows,
  palette: { G: t.leafDark, g: t.leafMid, h: t.leafLight },
};

export const berryBushSprite: PixelSprite = {
  key: "lwBerryBush",
  scale: 3,
  rows: [
    "....GGGGG.....",
    "..GGgggbgGG...",
    ".GgghhgggggG..",
    "GgbhhgggbgggG.",
    "GggggggggggggG",
    "GgggbgGgggbgGG",
    ".GgggggggggggG",
    "..GGgbgggggGG.",
    "....GGGGGGG...",
  ],
  palette: { G: t.leafDark, g: t.leafMid, h: t.leafLight, b: t.berry },
};

export const mushroomSprite: PixelSprite = {
  key: "lwMushroom",
  scale: 3,
  rows: ["..RRRR..", ".RwRRwR.", "RRRRRwRR", "RwRRRRRR", ".uuuuuu.", "...ss...", "...ss...", "..ssss.."],
  palette: { R: t.mushroomCap, w: t.mushroomSpot, u: t.mushroomGill, s: t.mushroomStem },
};

export const stumpSprite: PixelSprite = {
  key: "lwStump",
  scale: 3,
  rows: [
    "...kkkkkk...",
    "..kKKKKKKk..",
    "..kKyyyyKk..",
    "..kKyKKyKk..",
    "..kKyyyyKk..",
    "..kkKKKKkk..",
    ".kkkkkkkkkk.",
    "kk.kk..kk.kk",
  ],
  palette: { k: t.trunkDark, K: t.trunkLight, y: t.benchWoodLight },
};

// HUD art: hotbar items and the lantern-keeper's portrait.
export const timberItemSprite: PixelSprite = {
  key: "lwItemTimber",
  scale: 3,
  rows: [".kkkkkkkkyy.", "kKKKKKKKyLLy", "kKkKKKKkyLoy", "kKKKKkKKyLLy", ".kkkkkkkkyy."],
  palette: { k: t.trunkDark, K: t.trunkLight, y: t.benchWoodDark, L: t.benchWoodLight, o: t.trunkDark },
};

export const ironstoneItemSprite: PixelSprite = {
  key: "lwItemIronstone",
  scale: 3,
  rows: ["...SSSS...", ".SSllssS..", "SllOosssS.", "SsssssoOsS", "SssoOssssS", ".SSsssssS.", "..SSSSSS.."],
  palette: { S: t.stoneDark, s: t.stoneMid, l: t.stoneLight, o: t.oreFleck, O: t.oreShine },
};

const lanternItemRows = ["..hhhh..", "..h..h..", ".oooooo.", ".oLccLo.", ".oLccLo.", ".oLccLo.", ".oLLLLo.", ".oooooo."];

export const lanternLitItemSprite: PixelSprite = {
  key: "lwItemLanternLit",
  scale: 3,
  rows: lanternItemRows,
  palette: { h: t.anvilLight, o: t.anvilDark, L: t.lanternBody, c: t.lanternCore },
};

export const lanternDimItemSprite: PixelSprite = {
  key: "lwItemLanternDim",
  scale: 3,
  rows: lanternItemRows,
  palette: { h: t.anvilLight, o: t.anvilDark, L: t.stoneMid, c: t.stoneDark },
};

export const staffItemSprite: PixelSprite = {
  key: "lwItemStaff",
  scale: 3,
  rows: [
    "........x.",
    ".......xyx",
    "......w.x.",
    ".....w....",
    "....w.....",
    "...w......",
    "..w.......",
    ".w........",
    "w.........",
  ],
  palette: { w: t.staffWood, x: t.staffKnot, y: t.staffWood },
};

export const portraitSprite: PixelSprite = {
  key: "lwPortrait",
  scale: 4,
  rows: [
    "...hhhhhh...",
    "..hhhhhhhh..",
    ".hhhhhhhhhh.",
    ".hhsssssshh.",
    ".hsessssesh.",
    ".hssssssssh.",
    ".hsssMMsssh.",
    "..ssssssss..",
    "...tttttt...",
    ".tttttttttt.",
    "tttTttttTttt",
  ],
  palette: { h: t.hair, s: t.skin, e: t.eye, M: t.lips, t: t.tunic, T: t.tunicDark },
};

export const adventureSprites: readonly PixelSprite[] = [
  cottageRedSprite,
  cottageBlueSprite,
  wellSprite,
  fenceSprite,
  crateSprite,
  barrelSprite,
  bushSprite,
  berryBushSprite,
  mushroomSprite,
  stumpSprite,
  timberItemSprite,
  ironstoneItemSprite,
  lanternLitItemSprite,
  lanternDimItemSprite,
  staffItemSprite,
  portraitSprite,
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
