import { SeededRandom, seedRandom } from "@repo/game-logic";

// ─── Data Pools ───────────────────────────────────────────────────────────────
const TITLES = [
  "Captain",
  "Admiral",
  "Commodore",
  "Buccaneer",
  "Corsair",
  "Privateer",
  "Quartermaster",
  "Boatswain",
  "Sailing Master",
  "First Mate",
  "Gunner",
  "Swashbuckler",
  "Sea Wolf",
  "Sea Dog",
  "Plunderer",
  "Raider",
  "Reaver",
  "Scourge",
  "Dread",
  "Iron",
  "Bloody",
  "Black",
  "Red",
  "Mad",
  "Old",
  "Scurvy",
  "One-Eyed",
  "Peg-Leg",
  "Hook-Hand",
  "Grizzled",
] as const;

const NAMES = [
  "Jack",
  "Jack",
  "Jack", // weighted — very piratey
  "Will",
  "Billy",
  "Bones",
  "Peg",
  "Rum",
  "Sparrow",
  "Morgan",
  "Drake",
  "Hawkins",
  "Silver",
  "Flint",
  "Kidd",
  "Blackbeard",
  "Barbossa",
  "Rackham",
  "Teach",
  "Bonny",
  "Read",
  "Vane",
  "Skull",
  "Cutlass",
  "Barnacle",
  "Squint",
  "Grin",
  "Scurvy",
  "Plank",
  "Gibbet",
  "Havoc",
  "Storm",
  "Tide",
  "Crow",
] as const;

const ADJECTIVES = [
  "Salty",
  "Saucy",
  "Scurvy",
  "Rotten",
  "Dread",
  "Black",
  "Red",
  "Crimson",
  "Iron",
  "Bloody",
  "Fearsome",
  "Mighty",
  "Brave",
  "Bold",
  "Crafty",
  "Wily",
  "Cunning",
  "Vicious",
  "Ruthless",
  "Merciless",
  "Storm-Battered",
  "Barnacle-Crusted",
  "Rusty",
  "Shattered",
  "Thunderous",
] as const;

const NOUNS = [
  "Squid",
  "Kraken",
  "Octopus",
  "Shark",
  "Barracuda",
  "Manta Ray",
  "Seagull",
  "Albatross",
  "Pelican",
  "Swordfish",
  "Whale",
  "Dolphin",
  "Marlin",
  "Tuna",
  "Piranha",
  "Eel",
  "Jellyfish",
  "Starfish",
  "Crab",
  "Lobster",
  "Barnacle",
  "Clam",
  "Oyster",
  "Scallop",
  "Treasure",
  "Gold",
  "Doubloon",
  "Piece of Eight",
  "Ruby",
  "Emerald",
  "Pearl",
  "Amber",
  "Coins",
  "Booty",
  "Plunder",
  "Loot",
  "Rum",
  "Grog",
  "Ale",
  "Cider",
  "Mead",
  "Skull",
  "Crossbones",
  "Cutlass",
  "Sabre",
  "Pistol",
  "Cannon",
  "Anchor",
  "Compass",
  "Map",
  "Chart",
  "Spyglass",
  "Flag",
  "Sails",
  "Mast",
  "Rudder",
  "Wheel",
  "Deck",
  "Hull",
  "Bow",
  "Storm",
  "Hurricane",
  "Typhoon",
  "Monsoon",
  "Squall",
  "Gale",
  "Wave",
  "Tide",
  "Current",
  "Reef",
  "Shallows",
  "Deep",
  "Island",
  "Atoll",
  "Cove",
  "Bay",
  "Harbour",
  "Port",
  "Dawn",
  "Dusk",
  "Twilight",
  "Midnight",
  "Sunset",
  "Moonlight",
  "Raven",
  "Crow",
  "Vulture",
  "Hawk",
  "Falcon",
] as const;

const SHIP_PARTS = [
  "Revenge",
  "Vengeance",
  "Wrath",
  "Fury",
  "Rage",
  "Doom",
  "Fortune",
  "Fate",
  "Destiny",
  "Star",
  "Comet",
  "Meteor",
  "Serpent",
  "Dragon",
  "Wyrm",
  "Hydra",
  "Chimera",
  "Basilisk",
  "Shadow",
  "Ghost",
  "Spectre",
  "Phantom",
  "Wraith",
  "Haunt",
  "Rogue",
  "Outlaw",
  "Renegade",
  "Marauder",
  "Freebooter",
  "Dawn",
  "Rising Sun",
  "Setting Sun",
  "Night",
  "Darkness",
  "Sea Flower",
  "Mermaid",
  "Siren",
  "Lorelei",
  "Pearl",
  "Diamond",
  "Sapphire",
  "Ruby",
  "Emerald",
] as const;

const INSULTS = [
  "Dog",
  "Rat",
  "Cockroach",
  "Weasel",
  "Snake",
  "Eel",
  "Barnacle",
  "Louse",
  "Flea",
  "Maggot",
  "Leech",
  "Vulture",
  "Coward",
  "Scallywag",
  "Landlubber",
  "Pollywog",
  "Crab",
  "Squid",
  "Jellyfish",
  "Sea Slug",
] as const;

// ─── Generators ───────────────────────────────────────────────────────────────
const defaultSeed = seedRandom(1979);
function pick<T extends readonly unknown[]>(
  arr: T,
  seedRandom: SeededRandom = defaultSeed,
): T[number] {
  // return arr[Math.floor(Math.random() * arr.length)];
  return arr[seedRandom.nextInt(0, arr.length - 1)];
}

/**
 * Generates a random pirate-style name in one of several formats.
 *
 * Formats:
 * - `"Captain Jack Sparrow"`            (Title + Name + Surname)
 * - `"Blackbeard"`                       (Adjective + Noun)
 * - `"The Rotten Barnacle"`              (The + Adjective + Noun)
 * - `"Dread Pirate Roberts"`             (Title + Pirate + Surname)
 * - `"Salty Dog"`                        (Adjective + Insult)
 * - `"Scurvy Jack the Barnacle-Breath"`  (Adjective + Name + the + Insult-Noun)
 * - `"Revenge"`                          (Ship part / Single word)
 */
export function getPirateyName(seed?: number): string {
  let random = seed ? seedRandom(seed) : undefined;

  const roll = random ? random.nextFloat() : Math.random();

  // 20% — Full classic pirate name: "Captain Jack Sparrow"
  if (roll < 0.2) {
    const title = pick(TITLES, random);
    const name = pick(NAMES, random);
    const noun = pick(NOUNS, random);
    return `${title} ${name} ${noun}`;
  }

  // 15% — Adjective + Noun compound: "Blackbeard", "Red Shark"
  if (roll < 0.35) {
    const adj = pick(ADJECTIVES, random);
    const noun = pick(NOUNS, random);
    return `${adj}${noun}`;
  }

  // 12% — "The [Adjective] [Noun]": "The Rotten Barnacle"
  if (roll < 0.47) {
    return `The ${pick(ADJECTIVES, random)} ${pick(NOUNS, random)}`;
  }

  // 10% — "Dread Pirate [Surname]": "Dread Pirate Silver"
  if (roll < 0.57) {
    return `Dread Pirate ${pick(NAMES, random)}`;
  }

  // 10% — "Adjective + Insult": "Salty Dog", "Rotten Rat"
  if (roll < 0.67) {
    return `${pick(ADJECTIVES, random)} ${pick(INSULTS, random)}`;
  }

  // 10% — "Adjective Name the [Insult]-[Noun]": "Scurvy Jack the Barnacle-Breath"
  if (roll < 0.77) {
    const adj = pick(ADJECTIVES, random);
    const name = pick(NAMES, random);
    const insult = pick(INSULTS, random);
    const noun = pick(NOUNS, random);
    return `${adj} ${name} the ${insult}-${noun}`;
  }

  // 10% — Ship name / single dramatic word: "Revenge", "Sea Serpent"
  if (roll < 0.87) {
    const part1 = pick(SHIP_PARTS, random);
    const part2 = pick(NOUNS, random);
    const chance = random ? random.nextFloat() : Math.random();

    // 50% chance of two words
    if (chance < 0.5) {
      return `${part1} ${part2}`;
    }
    return String(part1);
  }

  // 8% — "Title the [Adjective]": "Captain the Fearsome"
  if (roll < 0.95) {
    return `${pick(TITLES, random)} the ${pick(ADJECTIVES, random)}`;
  }

  // 5% — Full colourful: "Old Peg the Sea Dog"
  const title = pick(TITLES, random);
  const name = pick(NAMES, random);
  const insult = pick(INSULTS, random);
  const noun = pick(NOUNS, random);
  return `${title} ${name} the ${insult} ${noun}`;
}

// ─── Convenience Exports ──────────────────────────────────────────────────────

/** Generates a simple, short pirate name (1-3 words, no long epithets). */
export function getShortPirateName(seed?: number): string {
  let random = seed ? seedRandom(seed) : undefined;

  const formats = [
    () => `${pick(ADJECTIVES, random)} ${pick(INSULTS, random)}`, // "Salty Dog"
    () => `${pick(NAMES, random)} the ${pick(NOUNS, random)}`, // "Jack the Shark"
    () => `${pick(TITLES, random)} ${pick(NAMES, random)}`, // "Captain Jack"
    () => pick(SHIP_PARTS, random) as string, // "Revenge"
    () => `${pick(ADJECTIVES, random)} ${pick(NAMES, random)}`, // "Black Jack"
  ];
  return pick(formats, random)();
}

/** Works well for room names: replaces spaces with hyphens, lowercased. */
export function getPirateyRoomName(seed?: number): string {
  return getPirateyName(seed)
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, ""); // strip punctuation like quotes/apostrophes
}
