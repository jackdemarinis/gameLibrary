export const uiTheme = {
  panelBase: "#103326",
  textPrimary: "#d6e4af",
  textStrong: "#f5e59d",
  textMuted: "#a7bc87",
  accentSoft: "#f1c24c",
  accentStrong: "#ed8f2f",
} as const;

export const worldTheme = {
  background: 0x07130f,
  ground: 0x2a603d,
  groundStripe: 0x315f33,
  accentSoft: 0xf1c24c,
  wallFill: 0x798168,
  wallStroke: 0x454a3a,
  crateFill: 0x9d6a2f,
  crateStroke: 0x5b3511,
  enemyGlow: 0xe97d31,
  playerHull: 0x74a74e,
  playerTurret: 0xc7d57a,
  enemyHull: 0x7e5f8d,
  floorDust: 0xe7a64a,
} as const;

export function applyThemeVariables(root: HTMLElement): void {
  root.style.setProperty("--panel-base", uiTheme.panelBase);
  root.style.setProperty("--text-primary", uiTheme.textPrimary);
  root.style.setProperty("--text-strong", uiTheme.textStrong);
  root.style.setProperty("--text-muted", uiTheme.textMuted);
  root.style.setProperty("--accent-soft", uiTheme.accentSoft);
  root.style.setProperty("--accent-strong", uiTheme.accentStrong);
}
