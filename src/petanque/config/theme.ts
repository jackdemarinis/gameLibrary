// Pétanque Park has its own sunny, console-era party-game look.
// Every colour used by the 3D world and the DOM overlay is defined here once.

export const uiTheme = {
  panel: "#ffffff",
  panelEdge: "#d9e3ea",
  panelShade: "#eef3f7",
  textStrong: "#2b3a48",
  text: "#4f6272",
  textMuted: "#8a9bab",
  accent: "#2fb3e8",
  accentDeep: "#1b8fc4",
  accentGlow: "rgba(47, 179, 232, 0.45)",
  teamA: "#e8463c",
  teamB: "#2f7de1",
  jack: "#ffd23f",
  danger: "#d93a30",
  meterTrack: "#e4ebf1",
  meterPower: "linear-gradient(90deg, #7ed957 0%, #ffd23f 60%, #ff7a3d 100%)",
  meterSweet: "#2fb3e8",
  shadow: "0 10px 30px rgba(30, 60, 90, 0.22)",
  shadowSoft: "0 4px 12px rgba(30, 60, 90, 0.16)",
  radius: "22px",
  radiusSmall: "14px",
  fontDisplay: "\"Baloo 2\", \"Nunito\", \"Arial Rounded MT Bold\", sans-serif",
  fontBody: "\"Nunito\", \"Arial Rounded MT Bold\", sans-serif",
} as const;

export const worldTheme = {
  // sky & air
  skyTop: 0x3f9ff0,
  skyHorizon: 0xdff3ff,
  fog: 0xd6eeff,
  sunLight: 0xfff1d6,
  hemiSky: 0xcfe9ff,
  hemiGround: 0x9ccf6a,
  cloud: 0xffffff,
  cloudShade: 0xdbe8f5,
  // ground
  grass: 0x78c44f,
  grassDark: 0x5daa3a,
  grassStripe: 0x9ad66a,
  grassBlade: 0x4a9a30,
  hill: 0x86d35a,
  hillFar: 0xa9de8c,
  hillDistant: 0xc4e6c0,
  path: 0xe8d4a8,
  gravel: 0xd8c09a,
  gravelDark: 0xa98b62,
  gravelLight: 0xf3e6cc,
  gravelSpecks: [0xb89a70, 0xc9ae86, 0x9c8160, 0xe6d3b0, 0xbfa58a, 0xd9c7a8],
  // pitch furniture
  board: 0xc98a4f,
  boardDark: 0x9a6233,
  circle: 0xff5a36,
  // trees & plants
  trunk: 0x9a6a42,
  trunkDark: 0x6e4a2c,
  leaves: 0x55b83c,
  leavesLight: 0x8fe060,
  leavesDark: 0x3c8f2c,
  cypress: 0x3f8f3a,
  cypressLight: 0x6cbf52,
  hedge: 0x4fa83a,
  lavender: 0x9b7be0,
  lavenderLight: 0xc4a8ff,
  flowers: [0xff5d7a, 0xffd23f, 0xffffff, 0xff8a3d, 0xc77dff],
  // village
  wallCream: 0xfaedd2,
  wallPeach: 0xf8d2b0,
  wallYellow: 0xfbe39a,
  roof: 0xe0703f,
  roofDark: 0xb9532b,
  shutter: 0x4bb3a7,
  shutterBlue: 0x5b9be0,
  windowGlass: 0x6c8fa8,
  bench: 0x6b8fb3,
  metalDark: 0x3a4652,
  umbrella: [0xff5d5d, 0xffffff],
  tablecloth: 0xffffff,
  bunting: [0xe8463c, 0xffd23f, 0x2f7de1, 0x3ccf91, 0xff8fa3],
  rope: 0xf3efe6,
  // balls
  steel: 0xc3ccd4,
  jack: 0xffd23f,
  // teams & guides
  teamA: 0xe8463c,
  teamB: 0x2f7de1,
  aimRoll: 0xffffff,
  aimLob: 0xffd23f,
  pointRing: 0xffffff,
  contactShadow: 0x1c3a1a,
  // faces (painted onto head textures)
  eye: 0x23262b,
  eyeShine: 0xffffff,
  eyeWhite: 0xffffff,
  mouth: 0x8a2f2a,
  mouthInside: 0x6b1f1f,
  tongue: 0xff7a7a,
  blush: 0xff8f8f,
  shoe: 0x3b3b44,
  shoeSole: 0xf2f2f2,
} as const;

export function cssColor(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

export function applyThemeVariables(root: HTMLElement): void {
  for (const [key, value] of Object.entries(uiTheme)) {
    const cssName = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    root.style.setProperty(`--${cssName}`, value);
  }
}
