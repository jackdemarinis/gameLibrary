export const assetManifest = {
  environment: [
    "terrain.floor.training-yard",
    "terrain.wall.bunker-stone",
    "terrain.crate.scrapwood",
  ],
  tanks: [
    "tank.player.foundation-shell",
    "tank.enemy.scout-shell",
    "tank.enemy.heavy-shell",
  ],
  ui: [
    "ui.chrome.panel-plate",
    "ui.button.command",
    "ui.icon.credits",
  ],
  fx: [
    "fx.muzzle-flash",
    "fx.impact-spark",
    "fx.explosion-light",
  ],
  audio: [
    "audio.sfx.cannon-light",
    "audio.sfx.coin-pickup",
    "audio.music.menu-loop",
  ],
} as const;

export type AssetGroup = keyof typeof assetManifest;
