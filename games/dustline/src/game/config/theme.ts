export const uiTheme = {
  panelBase: "var(--surface-1)",
  textPrimary: "var(--text)",
  textStrong: "var(--text-bright)",
  textMuted: "var(--muted)",
  accentSoft: "var(--accent-2)",
  accentStrong: "var(--accent)",
} as const;

export const worldTheme = {
  background: 0x07130f,
  ground: 0x2a603d,
  groundStripe: 0x315f33,
  accentSoft: 0xf1c24c,
  wallFill: 0x798168,
  wallStroke: 0x454a3a,
  weakWallFill: 0x7f7258,
  weakWallStroke: 0x4b4337,
  crateFill: 0x9d6a2f,
  crateStroke: 0x5b3511,
  enemyGlow: 0xe97d31,
  playerHull: 0x74a74e,
  playerTurret: 0xc7d57a,
  enemyHull: 0x7e5f8d,
  floorDust: 0xe7a64a,
  muzzleFlash: 0xffe18a,
  muzzleFlashOuter: 0xffa63f,
  enemyHealthBarFill: 0xffb347,
  enemyHealthBarBack: 0x281f17,
  fogVisibleAlpha: 0,
  fogExploredAlpha: 0,
  fogUnexploredAlpha: 1,
} as const;

/**
 * Pixel-art palette for the Dustline battlefield (art, not UI chrome).
 * Every battle texture is painted from these colours at 4 world px per art pixel.
 */
export const pixelTheme = {
  grass: 0x2f6b34,
  grassAlt: 0x2c6431,
  grassDark: 0x245428,
  grassLight: 0x3b7d3c,
  grassSeam: 0x27592b,
  grassShadow: 0x1a3d1d,
  pebble: 0x6f7a55,
  flower: 0xd9c25a,
  outOfBounds: 0x101a12,
  outOfBoundsAlt: 0x0c140e,
  steelFace: 0x8d9296,
  steelLight: 0xc9ccc8,
  steelShade: 0x5d6266,
  steelGap: 0x262a2c,
  steelRivet: 0xe4e6df,
  stoneFace: 0x4b5450,
  stoneLight: 0x6d7670,
  stoneShade: 0x353c39,
  stoneGap: 0x1b201e,
  brickFace: 0xc4582c,
  brickLight: 0xe27d45,
  brickMortar: 0x5a2a17,
  brickHole: 0x1d1310,
  woodFace: 0xb7843f,
  woodLight: 0xd8a85a,
  woodDark: 0x7a4f1f,
  woodEdge: 0x4a2c10,
  metalCorner: 0xb8b9ad,
  outline: 0x141810,
  treadDark: 0x1e211c,
  treadMid: 0x3d413a,
  treadLight: 0x5d6358,
  coinFace: 0xf1c24c,
  coinLight: 0xfff0a0,
  coinDark: 0xa86d12,
  healthBack: 0x1c1410,
  white: 0xfff6cc,
  reinforcedBand: 0x5d6266,
  reinforcedBandLight: 0x9aa0a2,
  goldFace: 0xe7b53a,
  goldLight: 0xfff0a0,
  goldDark: 0x8a5a10,
  repairFace: 0xe9efe2,
  repairCross: 0x3fae4a,
  repairEdge: 0x2a4a2c,
  boltFace: 0xff7a3d,
  boltLight: 0xffd36b,
  boltEdge: 0x6e2410,
} as const;

/**
 * Tank colours. Every enemy type has its own body colour and accent so they can
 * be told apart at a glance; the player keeps the olive green.
 */
export const tankTheme = {
  playerHull: 0x74a74e,
  playerTurret: 0xc7d57a,
  raiderHull: 0xa8432f,
  raiderTurret: 0xe2c79a,
  raiderAccent: 0xf3e6c4,
  skirmisherHull: 0x2b9a9c,
  skirmisherTurret: 0xbfeee6,
  skirmisherAccent: 0xffe066,
  bulwarkHull: 0x4f5d78,
  bulwarkTurret: 0x93a1bd,
  bulwarkAccent: 0xf0a030,
  lancerHull: 0x7a4aa8,
  lancerTurret: 0xd9c2f0,
  lancerAccent: 0xff5f8a,
  wardenHull: 0x2c2a2e,
  wardenTurret: 0x5a565e,
  wardenAccent: 0xe8b43a,
} as const;

export function applyThemeVariables(root: HTMLElement): void {
  root.style.setProperty("--panel-base", uiTheme.panelBase);
  root.style.setProperty("--text-primary", uiTheme.textPrimary);
  root.style.setProperty("--text-strong", uiTheme.textStrong);
  root.style.setProperty("--text-muted", uiTheme.textMuted);
  root.style.setProperty("--gameAccentSoft", uiTheme.accentSoft);
  root.style.setProperty("--accent-strong", uiTheme.accentStrong);
}

/**
 * Pixel-art palette for the Dustline title screen (camo field, hero tank, shells, smoke).
 * Painted at art resolution by src/ui/dustlineMenuArt.ts and scaled up with no smoothing.
 */
export const menuArtTheme = {
  outline: pixelTheme.outline,
  camo: [0x123d1b, 0x1a5224, 0x22692e, 0x2c7e37, 0x3a9442, 0x4caa50],
  tank: [0xd2ea86, 0x93c85c, 0x649f3d, 0x43722c, 0x2c4d1f],
  treadDark: pixelTheme.treadDark,
  treadMid: pixelTheme.treadMid,
  treadLight: pixelTheme.treadLight,
  wheelFace: 0x6f7668,
  wheelLight: 0xa3ab97,
  hub: pixelTheme.steelGap,
  decal: pixelTheme.coinFace,
  rivet: 0xb8d679,
  brass: [0xfff0a0, 0xf1c24c, 0xc98a1c, 0x8a5410],
  flash: [0xfff6cc, 0xffd24a, 0xf6851f],
  flashEdge: 0x8a3a10,
  smoke: [0xf0ecc4, 0xcfc993, 0xa29d66],
  smokeEdge: 0x55532f,
} as const;
