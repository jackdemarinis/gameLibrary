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

export function applyThemeVariables(root: HTMLElement): void {
  root.style.setProperty("--panel-base", uiTheme.panelBase);
  root.style.setProperty("--text-primary", uiTheme.textPrimary);
  root.style.setProperty("--text-strong", uiTheme.textStrong);
  root.style.setProperty("--text-muted", uiTheme.textMuted);
  root.style.setProperty("--gameAccentSoft", uiTheme.accentSoft);
  root.style.setProperty("--accent-strong", uiTheme.accentStrong);
}
