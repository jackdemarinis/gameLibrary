export interface WeaponDefinition {
  id: string;
  name: string;
  summary: string;
}

export const weaponCatalog: readonly WeaponDefinition[] = [
  {
    id: "starter-cannon",
    name: "Starter Cannon",
    summary: "Balanced stock gun for the opening contracts.",
  },
  {
    id: "burst-cannon",
    name: "Burst Cannon",
    summary: "An upgraded breech package staged after the first clear.",
  },
  {
    id: "longshot-cannon",
    name: "Longshot Cannon",
    summary: "High-pressure barrel package unlocked deeper in the campaign.",
  },
];

export const levelWeaponUnlocks: Readonly<Record<string, readonly string[]>> = {
  "training-yard": ["burst-cannon"],
  "relay-station": ["longshot-cannon"],
};

export function getWeaponDefinition(id: string): WeaponDefinition | undefined {
  return weaponCatalog.find((weapon) => weapon.id === id);
}

export function getWeaponLabel(id: string): string {
  return getWeaponDefinition(id)?.name ?? id;
}
