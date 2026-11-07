import type { Archetype, Weapon, WeaponId } from "./types";

export const COLS = 15;
export const ROWS = 9;
export const TILE = 64;
export const VIEW_W = COLS * TILE;
export const VIEW_H = ROWS * TILE;

export const SEED = 16480726;
export const MOVE_PER_AP = 3;
export const PRAYER_HEAL = 3;
export const PRAYER_AIM = 25;
export const HRADBA_RANGE = 2;
export const COVER_HALF = 25;
export const COVER_FULL = 50;

export const WEAPONS: Record<WeaponId, Weapon> = {
  pistol: {
    id: "pistol",
    name: "Kolečková pistole",
    short: "Pistole",
    range: 4,
    damage: 4,
    ap: 1,
    reloadAp: 1,
    accuracy: 78,
    falloff: 8,
    firearm: true,
    misfire: 0.04,
    pierce: 1,
    shred: 0,
    blast: 0,
    delivery: "shot",
  },
  carbine: {
    id: "carbine",
    name: "Dragounská karabina",
    short: "Karabina",
    range: 6,
    damage: 5,
    ap: 1,
    reloadAp: 1,
    accuracy: 68,
    falloff: 4,
    firearm: true,
    misfire: 0.08,
    pierce: 2,
    shred: 0,
    blast: 0,
    delivery: "shot",
  },
  rapier: {
    id: "rapier",
    name: "Rapír",
    short: "Rapír",
    range: 1,
    damage: 4,
    ap: 1,
    reloadAp: 0,
    accuracy: 90,
    falloff: 0,
    firearm: false,
    misfire: 0,
    pierce: 0,
    shred: 0,
    blast: 0,
    delivery: "shot",
  },
  musket: {
    id: "musket",
    name: "Doutnáková mušketa",
    short: "Mušketa",
    range: 8,
    damage: 7,
    ap: 1,
    reloadAp: 2,
    accuracy: 74,
    falloff: 3,
    firearm: true,
    misfire: 0.12,
    pierce: 3,
    shred: 0,
    blast: 0,
    delivery: "shot",
  },
  halberd: {
    id: "halberd",
    name: "Halapartna",
    short: "Halapartna",
    range: 2,
    damage: 5,
    ap: 1,
    reloadAp: 0,
    accuracy: 84,
    falloff: 0,
    firearm: false,
    misfire: 0,
    pierce: 2,
    shred: 0,
    blast: 0,
    delivery: "shot",
  },
  pike: {
    id: "pike",
    name: "Pika",
    short: "Pika",
    range: 2,
    damage: 5,
    ap: 1,
    reloadAp: 0,
    accuracy: 78,
    falloff: 0,
    firearm: false,
    misfire: 0,
    pierce: 1,
    shred: 0,
    blast: 0,
    delivery: "shot",
  },
  swedeMusket: {
    id: "swedeMusket",
    name: "Švédská mušketa",
    short: "Mušketa",
    range: 7,
    damage: 4,
    ap: 1,
    reloadAp: 1,
    accuracy: 62,
    falloff: 5,
    firearm: true,
    misfire: 0.08,
    pierce: 2,
    shred: 0,
    blast: 0,
    delivery: "shot",
  },
  grenade: {
    id: "grenade",
    name: "Ruční granát",
    short: "Granát",
    range: 3,
    damage: 5,
    ap: 2,
    reloadAp: 0,
    accuracy: 58,
    falloff: 4,
    firearm: false,
    misfire: 0.12,
    pierce: 1,
    shred: 2,
    blast: 1,
    delivery: "throw",
  },
  petard: {
    id: "petard",
    name: "Petarda",
    short: "Petarda",
    range: 1,
    damage: 6,
    ap: 2,
    reloadAp: 0,
    accuracy: 100,
    falloff: 0,
    firearm: false,
    misfire: 0.18,
    pierce: 2,
    shred: 2,
    blast: 1,
    delivery: "place",
  },
};

export const LOOK: Record<
  Archetype,
  {
    coat: string;
    trim: string;
    skin: string;
    hat: string;
    legs: string;
    metal: string;
    scale: number;
  }
> = {
  colloredo: {
    coat: "#7a1e2e",
    trim: "#e2c27a",
    skin: "#efd0b0",
    hat: "#241910",
    legs: "#1a1214",
    metal: "#d7c08a",
    scale: 1.02,
  },
  martin: {
    coat: "#8d5a30",
    trim: "#9a2433",
    skin: "#f0d2b2",
    hat: "#3a2816",
    legs: "#241910",
    metal: "#c9ccd2",
    scale: 1,
  },
  vaclav: {
    coat: "#1b2433",
    trim: "#ead9b8",
    skin: "#f3d5b8",
    hat: "#12161e",
    legs: "#14161c",
    metal: "#8d8272",
    scale: 0.96,
  },
  jakub: {
    coat: "#4e3828",
    trim: "#c4a15a",
    skin: "#c99268",
    hat: "#3a2618",
    legs: "#241910",
    metal: "#b7bdc4",
    scale: 1.08,
  },
  musketeer: {
    coat: "#d2b15c",
    trim: "#1d3e78",
    skin: "#f0d0ae",
    hat: "#243044",
    legs: "#2a2118",
    metal: "#9aa3ad",
    scale: 1,
  },
  pikeman: {
    coat: "#c6a24e",
    trim: "#1d3e78",
    skin: "#e8c8a4",
    hat: "#8e969e",
    legs: "#2a2118",
    metal: "#d5d8de",
    scale: 1.04,
  },
};

export const TILE_LABEL: Record<string, string> = {
  cobble: "Dlažba",
  palace: "Nádvoří paláce",
  wall: "Kamenná zeď",
  cart: "Vůz — poloviční kryt",
  river: "Vltava",
  boat: "Loďka",
  quay: "Nábřeží",
  rubble: "Suť — poloviční kryt",
};

export const SPAWNS: readonly (readonly [number, number])[] = [
  [0, 3],
  [0, 4],
  [0, 5],
  [0, 2],
  [1, 2],
  [0, 6],
  [2, 8],
  [3, 8],
  [1, 7],
  [2, 7],
];

export const HOLD_SPAWNS: readonly (readonly [number, number])[] = [
  [7, 2],
  [7, 6],
  [6, 3],
  [6, 5],
  [8, 1],
  [8, 7],
  [5, 2],
  [5, 6],
  ...SPAWNS,
];

