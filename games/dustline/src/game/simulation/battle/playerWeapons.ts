import { battleConfig } from "../../config/battleConfig";
import { getWeaponDefinition, weaponOrder } from "../../content/weaponCatalog";
import { getWeaponDamage } from "../shop";
import type { SaveData } from "../state";
import type { BattleState, PlayerWeapon, SimulationEffect, TankState } from "./types";

/** The player's inventory: every owned cannon in catalog order, upgrades applied. */
export function buildPlayerLoadout(save: SaveData): PlayerWeapon[] {
  const reloadMultiplier = Math.max(0.3, 1 - save.upgrades.fireRate * battleConfig.upgrades.fireRateReductionPerLevel);

  return weaponOrder
    .filter((kind) => save.unlockedWeapons.includes(kind))
    .map((kind) => {
      const stats = battleConfig.weapons[kind];
      const definition = getWeaponDefinition(kind);
      const level = save.weaponLevels[kind] ?? 0;

      return {
        kind,
        name: definition.name,
        shortName: definition.shortName,
        level,
        damage: getWeaponDamage(kind, level),
        cooldownMs: Math.round(stats.cooldownMs * reloadMultiplier),
        projectileSpeed: stats.projectileSpeed,
        rangePx: stats.rangePx,
        shotCount: stats.shotCount,
        spreadRadians: stats.spreadRadians,
        jitterRadians: stats.jitterRadians,
        bounces: stats.bounces,
        pierce: stats.pierce,
        radius: stats.radius,
        recoilKick: stats.recoilKick,
      };
    });
}

/** Loads a cannon's stats onto a tank. */
export function applyWeaponToTank(tank: TankState, weapon: PlayerWeapon): void {
  tank.weapon = weapon.kind;
  tank.projectileDamage = weapon.damage;
  tank.fireCooldownMs = weapon.cooldownMs;
  tank.projectileSpeed = weapon.projectileSpeed;
  tank.projectileRangePx = weapon.rangePx;
  tank.shotCount = weapon.shotCount;
  tank.spreadRadians = weapon.spreadRadians;
  tank.aimJitterRadians = weapon.jitterRadians;
  tank.projectileBounces = weapon.bounces;
  tank.projectilePierce = weapon.pierce;
  tank.projectileRadius = weapon.radius;
  tank.recoilKick = weapon.recoilKick;
}

/** Switches the player to inventory slot `index` (0-based). Returns a click effect if it changed. */
export function selectPlayerWeapon(state: BattleState, index: number): SimulationEffect[] {
  const weapon = state.playerLoadout[index];

  if (!weapon || index === state.activeWeaponIndex || !state.player.alive) {
    return [];
  }

  state.activeWeaponIndex = index;
  applyWeaponToTank(state.player, weapon);
  state.player.fireCooldownRemainingMs = Math.max(
    state.player.fireCooldownRemainingMs,
    battleConfig.player.weaponSwitchDelayMs,
  );

  return [
    {
      type: "sound",
      sound: "weaponSwitch",
      x: state.player.position.x,
      y: state.player.position.y,
      color: 0xfff6cc,
      size: 0,
    },
  ];
}
