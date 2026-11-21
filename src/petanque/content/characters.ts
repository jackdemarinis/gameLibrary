// Original Pétanque Park cast. Built from primitives and painted faces in view/characterModel.ts.

export type HatStyle = "beret" | "cap" | "sunhat" | "none";
export type HairStyle = "bob" | "short" | "bald" | "ponytail" | "buns" | "spiky" | "curly";
export type EyeShape = "round" | "tall" | "sleepy";

export interface CharacterDefinition {
  id: string;
  name: string;
  skin: number;
  hair: number;
  shirt: number;
  pants: number;
  hat: HatStyle;
  hatColor: number;
  hairStyle: HairStyle;
  eyeShape: EyeShape;
  hasMustache: boolean;
  hasFreckles: boolean;
  // Body proportions: 1 = average.
  height: number;
  girth: number;
}

export const characters: readonly CharacterDefinition[] = [
  { id: "margot", name: "Margot", skin: 0xf6d2b4, hair: 0x6a3f24, shirt: 0xff8fa3, pants: 0x3d5a80, hat: "sunhat", hatColor: 0xfff1c9, hairStyle: "bob", eyeShape: "tall", hasMustache: false, hasFreckles: true, height: 0.97, girth: 0.95 },
  { id: "papiLou", name: "Papi Lou", skin: 0xeec09c, hair: 0xe4e4e4, shirt: 0xf7f7f2, pants: 0x48566a, hat: "beret", hatColor: 0x26303b, hairStyle: "bald", eyeShape: "sleepy", hasMustache: true, hasFreckles: false, height: 0.95, girth: 1.15 },
  { id: "ziggy", name: "Ziggy", skin: 0x8d5a3b, hair: 0x1e1612, shirt: 0x3ccf91, pants: 0x2d3142, hat: "cap", hatColor: 0xffb627, hairStyle: "short", eyeShape: "round", hasMustache: false, hasFreckles: false, height: 1.05, girth: 0.92 },
  { id: "noor", name: "Noor", skin: 0xc68e66, hair: 0x2a1a12, shirt: 0xffd23f, pants: 0x6b4e9b, hat: "none", hatColor: 0x000000, hairStyle: "ponytail", eyeShape: "tall", hasMustache: false, hasFreckles: false, height: 1.0, girth: 0.95 },
  { id: "bruno", name: "Bruno", skin: 0xf2c6a0, hair: 0xb5522a, shirt: 0x5b8def, pants: 0x3a3a3a, hat: "none", hatColor: 0xe8463c, hairStyle: "spiky", eyeShape: "round", hasMustache: true, hasFreckles: false, height: 1.06, girth: 1.08 },
  { id: "kiki", name: "Kiki", skin: 0xffe0c7, hair: 0xf0c75e, shirt: 0xb18cff, pants: 0x2f6f73, hat: "none", hatColor: 0xe8463c, hairStyle: "buns", eyeShape: "round", hasMustache: false, hasFreckles: true, height: 0.93, girth: 0.92 },
  { id: "abel", name: "Abel", skin: 0x6b4430, hair: 0x15100d, shirt: 0xff7a3d, pants: 0x3b4f6b, hat: "none", hatColor: 0x000000, hairStyle: "curly", eyeShape: "round", hasMustache: false, hasFreckles: false, height: 1.02, girth: 1.0 },
  { id: "lucie", name: "Lucie", skin: 0xf3cfb3, hair: 0x2b2b2b, shirt: 0x4bb3a7, pants: 0xf2efe6, hat: "beret", hatColor: 0xe8463c, hairStyle: "bob", eyeShape: "sleepy", hasMustache: false, hasFreckles: false, height: 0.99, girth: 0.94 },
];

export function getCharacter(id: string): CharacterDefinition {
  return characters.find((character) => character.id === id) ?? characters[0];
}

export const teamNames = ["Poppies", "Cornflowers"] as const;
