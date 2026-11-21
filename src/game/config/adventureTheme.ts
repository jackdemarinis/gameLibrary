// Lanternwake world art: an original chunky pixel-art look (earthy sandbox mood:
// grass, dirt, stone, ore, a corrupted shrine, and a lantern-lit night).
// Like `worldTheme`, these are in-canvas art colors, not UI tokens; the DOM menus
// and HUD keep using the shared theme.css tokens.
export const adventureTheme = {
  // Ground and terrain.
  grassLight: 0x7ccc52,
  grassMid: 0x56a33c,
  grassDark: 0x3d7d2e,
  flowerGold: 0xf4d34e,
  flowerRose: 0xe9708e,
  dirtLight: 0xb08052,
  dirtMid: 0x8d6038,
  dirtDark: 0x684427,
  stoneLight: 0xaeb3bc,
  stoneMid: 0x80858f,
  stoneDark: 0x575b65,
  oreFleck: 0xdb8a3c,
  oreShine: 0xffd08f,

  // Trees.
  leafLight: 0x5fb36a,
  leafMid: 0x2e7a46,
  leafDark: 0x184a2e,
  trunkLight: 0x8a5a31,
  trunkDark: 0x5c3a1e,

  // Corrupted shrine (east of the gate).
  shrineBrickLight: 0x5a4772,
  shrineBrickMid: 0x3f3156,
  shrineMortar: 0x241a33,
  shrineMoss: 0x8a5cb4,

  // Village props.
  benchWoodLight: 0xc89058,
  benchWoodMid: 0x93623a,
  benchWoodDark: 0x5f3c20,
  anvilLight: 0x9a9ea8,
  anvilDark: 0x5d6069,
  torchFlame: 0xffc457,
  torchCore: 0xfff3c4,

  // Cottages, well and yard.
  roofRedLight: 0xe0664a,
  roofRed: 0xb83a2e,
  roofRedDark: 0x7d2420,
  roofBlueLight: 0x6a9bd6,
  roofBlue: 0x3f6aa8,
  roofBlueDark: 0x283f6e,
  roofOutline: 0x3a1a14,
  plaster: 0xf0e2c0,
  plasterShade: 0xd2bf98,
  windowGlass: 0x9fd2f0,
  windowFrame: 0x5f3c20,
  chimney: 0x6a6f7a,
  chimneyDark: 0x3e424b,
  waterDark: 0x1f3550,
  cobbleLight: 0xd8d2c4,
  cobbleMid: 0xb5ad9c,
  cobbleDark: 0x8a8273,

  // Greenery.
  berry: 0xd0303f,
  mushroomCap: 0xd23b33,
  mushroomSpot: 0xfff4e6,
  mushroomGill: 0xe9cfa6,
  mushroomStem: 0xf3e6cc,
  lips: 0xc96b5c,

  // Lantern-keeper.
  skin: 0xf1c393,
  hair: 0x5b3419,
  eye: 0x1d1424,
  tunic: 0x3b78b8,
  tunicDark: 0x285685,
  belt: 0x6b4426,
  pants: 0x4a3a2a,
  pantsBack: 0x33281d,
  boots: 0x2f2217,
  staffWood: 0x9b6b3b,
  staffKnot: 0x6e4a28,
  lanternBody: 0xffae3d,
  lanternCore: 0xfff1b4,

  // Shades.
  shadeOutline: 0x3b2e63,
  shadeBody: 0x6e5ca8,
  shadeEye: 0xff7aa6,
  shadeMouth: 0x22183e,

  // The Mirewarden.
  bossOutline: 0x23162f,
  bossBody: 0x4b3366,
  bossEyeWhite: 0xf6ecef,
  bossIris: 0xd2264d,
  bossPupil: 0x4a0716,
  bossMoss: 0x5e8a3e,
  bossTeeth: 0xe9dcc0,
  bossMouth: 0x1a0f22,

  // Effects and in-canvas labels.
  night: 0x0b1033,
  groundShadow: 0x10240f,
  swing: 0xffc457,
  pulse: 0xd2264d,
  hurtTint: 0xff8080,
  staggerTint: 0xd8d0ff,
  healthBack: 0x2a1a0e,
  healthFill: 0xe5483f,
  signWood: 0x6b4426,
  signEdge: 0x3d2614,
  signFont: "\"Pixelify Sans\", monospace",
  signText: "#fff4d6",
  signStroke: "#2a1a0e",
} as const;

/** How dark the night overlay is per objective step: dusk deepens, then dawn breaks. */
export const nightDarknessByStep = [0.38, 0.5, 0.6, 0.68, 0.12] as const;
