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
 * Terrain is painted at 4 world px per art pixel, tanks at 3, shells and blasts at 2.
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
  freezeFace: 0x8fdcff,
  freezeLight: 0xe6f7ff,
  freezeEdge: 0x1f4f6e,
  /** Tint over enemy tanks while a freeze holds them. */
  frozenTint: 0x9fdcff,
  supplyPlate: 0x2a2f26,
  spawnerFace: 0x3d4347,
  spawnerLight: 0x6a7276,
  spawnerDark: 0x23272a,
  spawnerCrack: 0x0e1011,
  hazardStripe: 0xf1c24c,
  spawnerCore: 0xe0573a,
  spawnerCoreLight: 0xffa36b,
  /** Tank details: headlights, exhausts, bolts. */
  headlight: 0xfff3b0,
  exhaust: 0x2b2e2a,
  bolt: 0xd8dccf,
  /** Shells: player gold, enemy orange. */
  shotPlayer: 0xf1c24c,
  shotPlayerLight: 0xfff0a0,
  shotPlayerDim: 0x9a6a14,
  shotEnemy: 0xe97d31,
  shotEnemyLight: 0xffc48a,
  shotEnemyDim: 0x8a3a10,
  /** Rebound shells and their barrel coils: violet for the player, gold for the boss. */
  ricochetGlow: 0xd59cff,
  ricochetCore: 0xf6e8ff,
  ricochetEnemyGlow: 0xe8b43a,
  /** Laser bolts and emitters: cyan for the player, pink for lancers. */
  laserGlow: 0x8fe8ff,
  laserCore: 0xeafcff,
  laserEnemyGlow: 0xff5f8a,
  laserEnemyCore: 0xffd6e2,
  /** Seeker missiles: olive body, red warhead, hot exhaust. */
  missileBody: 0xd8dccf,
  missileLight: 0xffffff,
  missileDim: 0x8d9296,
  missileWarhead: 0xe0573a,
  missileEnemyWarhead: 0xffb02e,
  /** Muzzle blast, hottest to coolest, then smoke. */
  flashCore: 0xfff6cc,
  flashHot: 0xffd24a,
  flashMid: 0xf6851f,
  flashEdge: 0x8a3a10,
  flashSmoke: 0x8f8a6a,
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
  hunterHull: 0xb8862e,
  hunterTurret: 0xe9d6a0,
  hunterAccent: 0xff6a3a,
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

/**
 * Palette for the 32x32 pixel icons on shop cards and the HUD inventory
 * (painted by src/ui/dustlineIcons.ts). Ramps run light to dark.
 */
export const iconTheme = {
  outline: pixelTheme.outline,
  steel: [pixelTheme.steelRivet, pixelTheme.steelLight, pixelTheme.steelFace, pixelTheme.steelShade],
  darkSteel: [pixelTheme.steelFace, pixelTheme.steelShade, pixelTheme.stoneShade, pixelTheme.steelGap],
  rivet: pixelTheme.steelRivet,
  stone: [pixelTheme.stoneLight, pixelTheme.stoneFace, pixelTheme.stoneShade],
  stoneGap: pixelTheme.stoneGap,
  repair: [0x9be08a, pixelTheme.repairCross, 0x2b7a33],
  repairEdge: pixelTheme.repairEdge,
  brass: menuArtTheme.brass,
  brassDark: 0x5a3608,
  olive: menuArtTheme.tank,
  tread: [pixelTheme.treadLight, pixelTheme.treadMid, pixelTheme.treadDark],
  wheel: [menuArtTheme.wheelLight, menuArtTheme.wheelFace, pixelTheme.steelShade],
  hub: pixelTheme.steelGap,
  speedLine: pixelTheme.flower,
  lens: [pixelTheme.laserCore, pixelTheme.laserGlow, 0x3a9cc8, pixelTheme.freezeEdge],
  glint: pixelTheme.white,
  dialFace: [pixelTheme.white, 0xe8e0b0, 0xc9c08a],
  dialHand: pixelTheme.spawnerCore,
  flash: [pixelTheme.flashCore, pixelTheme.flashHot, pixelTheme.flashMid],
  flashEdge: pixelTheme.flashEdge,
  ricochet: [pixelTheme.ricochetCore, pixelTheme.ricochetGlow, 0x9a5fd0, 0x5a2a8a],
  ricochetEdge: 0x3a1a5c,
  laser: [pixelTheme.laserCore, pixelTheme.laserGlow, 0x3a9cc8],
  laserEdge: pixelTheme.freezeEdge,
  missileBody: [pixelTheme.missileLight, pixelTheme.missileBody, pixelTheme.missileDim, pixelTheme.steelShade],
  warhead: [0xff9a7a, pixelTheme.missileWarhead, 0x9a2a18],
  fin: [0x9be08a, 0x4caa50, 0x2c4d1f],
} as const;
